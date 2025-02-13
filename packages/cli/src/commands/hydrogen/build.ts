import {Flags} from '@oclif/core';
import Command from '@shopify/cli-kit/node/base-command';
import {resolvePath, joinPath} from '@shopify/cli-kit/node/path';
import {
  outputWarn,
  collectLog,
  outputInfo,
  outputContent,
  outputToken,
} from '@shopify/cli-kit/node/output';
import {fileSize, removeFile} from '@shopify/cli-kit/node/fs';
import {getPackageManager} from '@shopify/cli-kit/node/node-package-manager';
import {commonFlags, flagsToCamelObject} from '../../lib/flags.js';
import {prepareDiffDirectory} from '../../lib/template-diff.js';
import {getViteConfig, isViteProject} from '../../lib/vite-config.js';
import {checkLockfileStatus} from '../../lib/check-lockfile.js';
import {
  findMissingRoutes,
  findReservedRoutes,
  warnReservedRoutes,
} from '../../lib/route-validator.js';
import {runClassicCompilerBuild} from '../../lib/classic-compiler/build.js';
import {hydrogenBundleAnalyzer} from '../../lib/bundle/vite-plugin.js';
import {
  BUNDLE_ANALYZER_HTML_FILE,
  getBundleAnalysisSummary,
} from '../../lib/bundle/analyzer.js';
import {codegen, spawnCodegenProcess} from '../../lib/codegen.js';
import {isCI} from '../../lib/is-ci.js';
import {importVite} from '../../lib/import-utils.js';
import {deferPromise, type DeferredPromise} from '../../lib/defer.js';
import {setupResourceCleanup} from '../../lib/resource-cleanup.js';

export default class Build extends Command {
  static descriptionWithMarkdown = `Builds a Hydrogen storefront for production. The client and app worker files are compiled to a \`/dist\` folder in your Hydrogen project directory.`;

  static description = 'Builds a Hydrogen storefront for production.';
  static flags = {
    ...commonFlags.path,
    ...commonFlags.entry,
    ...commonFlags.sourcemap,
    ...commonFlags.lockfileCheck,
    ...commonFlags.disableRouteWarning,
    ...commonFlags.codegen,
    ...commonFlags.diff,
    watch: Flags.boolean({
      description:
        'Watches for changes and rebuilds the project writing output to disk.',
      env: 'SHOPIFY_HYDROGEN_FLAG_WATCH',
    }),
    'bundle-stats': Flags.boolean({
      description:
        'Show a bundle size summary after building. Defaults to true, use `--no-bundle-stats` to disable.',
      allowNo: true,
    }),
    'force-client-sourcemap': Flags.boolean({
      description:
        'Client sourcemapping is avoided by default because it makes backend code visible in the browser. Use this flag to force enabling it.',
      env: 'SHOPIFY_HYDROGEN_FLAG_FORCE_CLIENT_SOURCEMAP',
    }),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(Build);
    const originalDirectory = flags.path
      ? resolvePath(flags.path)
      : process.cwd();

    const diff = flags.diff
      ? await prepareDiffDirectory(originalDirectory, flags.watch)
      : undefined;

    const directory = diff?.targetDirectory ?? originalDirectory;

    const buildParams = {
      ...flagsToCamelObject(flags),
      useCodegen: flags.codegen,
      directory,
    };

    const result = (await isViteProject(directory))
      ? await runBuild(buildParams)
      : await runClassicCompilerBuild(buildParams);

    if (buildParams.watch) {
      if (diff || result?.close) {
        setupResourceCleanup(async () => {
          await result?.close();

          if (diff) {
            await diff.copyDiffBuild();
            if (flags.codegen) await diff.copyDiffCodegen();
            await diff.cleanup();
          }
        });
      }
    } else {
      if (diff) {
        await diff.copyDiffBuild();
        if (flags.codegen) await diff.copyDiffCodegen();
        await diff.cleanup();
      }

      // The Remix compiler hangs due to a bug in ESBuild:
      // https://github.com/evanw/esbuild/issues/2727
      // The actual build has already finished so we can kill the process.
      process.exit(0);
    }
  }
}

const WORKER_BUILD_SIZE_LIMIT = 5;

type RunBuildOptions = {
  entry?: string;
  directory?: string;
  useCodegen?: boolean;
  codegenConfigPath?: string;
  sourcemap?: boolean;
  forceClientSourcemap?: boolean;
  disableRouteWarning?: boolean;
  assetPath?: string;
  bundleStats?: boolean;
  lockfileCheck?: boolean;
  watch?: boolean;
  onServerBuildStart?: () => void | Promise<void>;
  onServerBuildFinish?: () => void | Promise<void>;
};

export async function runBuild({
  entry: ssrEntry,
  directory,
  useCodegen = false,
  codegenConfigPath,
  sourcemap = true,
  forceClientSourcemap,
  disableRouteWarning = false,
  lockfileCheck = true,
  assetPath = '/',
  bundleStats = !isCI(),
  watch = false,
  onServerBuildStart,
  onServerBuildFinish,
}: RunBuildOptions) {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  const root = directory ?? process.cwd();

  if (lockfileCheck) {
    await checkLockfileStatus(root, isCI());
  }

  const [
    vite,
    {userViteConfig, remixConfig, clientOutDir, serverOutDir, serverOutFile},
  ] = await Promise.all([
    // Avoid static imports because this file is imported by `deploy` command,
    // which must have a hard dependency on 'vite'.
    importVite(root),
    getViteConfig(root, ssrEntry),
  ]);

  const customLogger = vite.createLogger(watch ? 'warn' : undefined);
  if (process.env.SHOPIFY_UNIT_TEST) {
    // Make logs from Vite visible in tests
    customLogger.info = (msg) => collectLog('info', msg);
    customLogger.warn = (msg) => collectLog('warn', msg);
    customLogger.error = (msg) => collectLog('error', msg);
  }

  const serverMinify = userViteConfig.build?.minify ?? true;
  const commonConfig = {
    root,
    mode: process.env.NODE_ENV,
    base: assetPath,
    customLogger,
  };

  let clientBuildStatus: DeferredPromise;

  // Client build first
  const clientBuild = await vite.build({
    ...commonConfig,
    build: {
      emptyOutDir: true,
      copyPublicDir: true,
      // Disable client sourcemaps in production by default
      sourcemap:
        forceClientSourcemap ??
        (process.env.NODE_ENV !== 'production' && sourcemap),
      watch: watch ? {} : null,
    },
    server: {
      watch: watch ? {} : null,
    },
    plugins: [
      {
        name: 'hydrogen:cli:client',
        buildStart() {
          clientBuildStatus?.resolve();
          clientBuildStatus = deferPromise();
        },
        buildEnd(error) {
          if (error) clientBuildStatus.reject(error);
        },
        writeBundle() {
          clientBuildStatus.resolve();
        },
        closeWatcher() {
          // End build process if watcher is closed
          this.error(new Error('Process exited before client build finished.'));
        },
      },
    ],
  });

  console.log('');

  let serverBuildStatus: DeferredPromise;

  // Server/SSR build
  const serverBuild = await vite.build({
    ...commonConfig,
    build: {
      sourcemap,
      ssr: ssrEntry ?? true,
      emptyOutDir: false,
      copyPublicDir: false,
      minify: serverMinify,
      // Ensure the server rebuild start after the client one
      watch: watch ? {buildDelay: 100} : null,
    },
    server: {
      watch: watch ? {} : null,
    },
    plugins: [
      {
        name: 'hydrogen:cli:server',
        async buildStart() {
          // Wait for the client build to finish in watch mode
          // before starting the server build to access the
          // Remix manifest from file disk.
          await clientBuildStatus.promise;

          // Keep track of server builds to wait for them to finish
          // before cleaning up resources in watch mode. Otherwise,
          // it might complain about missing files and loop infinitely.
          serverBuildStatus?.resolve();
          serverBuildStatus = deferPromise();
          await onServerBuildStart?.();
        },
        async writeBundle() {
          if (serverBuildStatus?.state !== 'rejected') {
            await onServerBuildFinish?.();
          }

          serverBuildStatus.resolve();
        },
        closeWatcher() {
          // End build process if watcher is closed
          this.error(new Error('Process exited before server build finished.'));
        },
      },
      ...(bundleStats
        ? [
            hydrogenBundleAnalyzer({
              minify: serverMinify
                ? (code, filepath) =>
                    vite
                      .transformWithEsbuild(code, filepath, {
                        minify: true,
                        minifyWhitespace: true,
                        minifySyntax: true,
                        minifyIdentifiers: true,
                        sourcemap: false,
                        treeShaking: false, // Tree-shaking would drop most exports in routes
                        legalComments: 'none',
                        target: 'esnext',
                      })
                      .then((result) => result.code)
                : undefined,
            }),
          ]
        : []),
    ],
  });

  if (!watch) {
    await Promise.all([
      removeFile(joinPath(clientOutDir, '.vite')),
      removeFile(joinPath(serverOutDir, '.vite')),
      removeFile(joinPath(serverOutDir, 'assets')),
    ]);
  }

  const codegenOptions = {
    rootDirectory: root,
    appDirectory: remixConfig.appDirectory,
    configFilePath: codegenConfigPath,
  };

  const codegenProcess = useCodegen
    ? watch
      ? spawnCodegenProcess(codegenOptions)
      : await codegen(codegenOptions).then(() => undefined)
    : undefined;

  if (!watch && process.env.NODE_ENV !== 'development') {
    if (bundleStats) {
      const bundleAnalysisPath =
        'file://' + joinPath(serverOutDir, BUNDLE_ANALYZER_HTML_FILE);

      outputInfo(
        outputContent`${
          (await getBundleAnalysisSummary(serverOutDir)) || '\n'
        }\n    │\n    └─── ${outputToken.link(
          'Complete analysis: ' + bundleAnalysisPath,
          bundleAnalysisPath,
        )}\n\n`,
      );
    }

    const sizeMB = (await fileSize(serverOutFile)) / (1024 * 1024);

    if (sizeMB >= WORKER_BUILD_SIZE_LIMIT) {
      outputWarn(
        `🚨 Smaller worker bundles are faster to deploy and run.${
          serverMinify
            ? ''
            : '\n   Minify your bundle by adding `build.minify: true` to vite.config.js.'
        }\n   Learn more about optimizing your worker bundle file: https://h2o.fyi/debugging/bundle-size\n`,
      );
    }
  }

  if (!watch && !disableRouteWarning) {
    const missingRoutes = findMissingRoutes(remixConfig);
    if (missingRoutes.length) {
      const packageManager = await getPackageManager(root);
      const exec = packageManager === 'npm' ? 'npx' : packageManager;

      outputWarn(
        `Heads up: Shopify stores have a number of standard routes that aren’t set up yet.\n` +
          `Some functionality and backlinks might not work as expected until these are created or redirects are set up.\n` +
          `This build is missing ${missingRoutes.length} route${
            missingRoutes.length > 1 ? 's' : ''
          }. For more details, run \`${exec} shopify hydrogen check routes\`.\n`,
      );
    }
  }

  if (!watch && !disableRouteWarning) {
    warnReservedRoutes(findReservedRoutes(remixConfig));
  }

  return {
    async close() {
      codegenProcess?.removeAllListeners('close');
      codegenProcess?.kill('SIGINT');

      const promises: Array<Promise<void>> = [];
      if ('close' in clientBuild) promises.push(clientBuild.close());
      if ('close' in serverBuild) promises.push(serverBuild.close());

      await Promise.allSettled(promises);

      if (
        clientBuildStatus?.state === 'pending' ||
        serverBuildStatus?.state === 'pending'
      ) {
        clientBuildStatus?.promise.catch(() => {});
        clientBuildStatus?.reject();
        serverBuildStatus?.promise.catch(() => {});
        serverBuildStatus?.reject();

        // Give time for Rollup to stop builds before removing files
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    },
  };
}
