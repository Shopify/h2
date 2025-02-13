import type {ViteDevServer} from 'vite';
import {Flags, Config} from '@oclif/core';
import Command from '@shopify/cli-kit/node/base-command';
import colors from '@shopify/cli-kit/node/colors';
import {joinPath, resolvePath} from '@shopify/cli-kit/node/path';
import {collectLog} from '@shopify/cli-kit/node/output';
import {
  type AlertCustomSection,
  renderSuccess,
  renderInfo,
} from '@shopify/cli-kit/node/ui';
import {AbortError} from '@shopify/cli-kit/node/error';
import {removeFile} from '@shopify/cli-kit/node/fs';
import {
  enhanceH2Logs,
  isH2Verbose,
  muteDevLogs,
  setH2OVerbose,
} from '../../lib/log.js';
import {
  DEFAULT_APP_PORT,
  DEFAULT_INSPECTOR_PORT,
  commonFlags,
  deprecated,
  flagsToCamelObject,
  overrideFlag,
} from '../../lib/flags.js';
import {spawnCodegenProcess} from '../../lib/codegen.js';
import {getAllEnvironmentVariables} from '../../lib/environment-variables.js';
import {displayDevUpgradeNotice} from './upgrade.js';
import {prepareDiffDirectory} from '../../lib/template-diff.js';
import {
  getDebugBannerLine,
  startTunnelAndPushConfig,
  isMockShop,
  notifyIssueWithTunnelAndMockShop,
  getDevConfigInBackground,
  getUtilityBannerlines,
  TUNNEL_DOMAIN,
} from '../../lib/dev-shared.js';
import {getCliCommand} from '../../lib/shell.js';
import {findPort} from '../../lib/find-port.js';
import {logRequestLine} from '../../lib/mini-oxygen/common.js';
import {
  findHydrogenPlugin,
  findOxygenPlugin,
  isViteProject,
} from '../../lib/vite-config.js';
import {runClassicCompilerDev} from '../../lib/classic-compiler/dev.js';
import {importVite} from '../../lib/import-utils.js';
import {createEntryPointErrorHandler} from '../../lib/deps-optimizer.js';
import {getCodeFormatOptions} from '../../lib/format-code.js';
import {setupResourceCleanup} from '../../lib/resource-cleanup.js';
import {hydrogenPackagesPath} from '../../lib/build.js';

export default class Dev extends Command {
  static descriptionWithMarkdown = `Runs a Hydrogen storefront in a local runtime that emulates an Oxygen worker for development.

  If your project is [linked](https://shopify.dev/docs/api/shopify-cli/hydrogen/hydrogen-link) to a Hydrogen storefront, then its environment variables will be loaded with the runtime.`;

  static description =
    'Runs Hydrogen storefront in an Oxygen worker for development.';
  static flags = {
    ...commonFlags.path,
    ...commonFlags.entry,
    ...overrideFlag(commonFlags.port, {
      port: {default: undefined, required: false},
    }),
    ...commonFlags.codegen,
    'disable-virtual-routes': Flags.boolean({
      description:
        "Disable rendering fallback routes when a route file doesn't exist.",
      env: 'SHOPIFY_HYDROGEN_FLAG_DISABLE_VIRTUAL_ROUTES',
      default: false,
    }),
    ...commonFlags.debug,
    ...commonFlags.inspectorPort,
    ...commonFlags.env,
    ...commonFlags.envBranch,
    ...commonFlags.envFile,
    'disable-version-check': Flags.boolean({
      description: 'Skip the version check when running `hydrogen dev`',
      default: false,
      required: false,
    }),
    ...commonFlags.diff,
    ...commonFlags.customerAccountPush,
    ...commonFlags.verbose,
    host: Flags.boolean({
      description: 'Expose the server to the local network',
      default: false,
      required: false,
    }),
    'disable-deps-optimizer': Flags.boolean({
      description:
        "Disable adding dependencies to Vite's `ssr.optimizeDeps.include` automatically",
      env: 'SHOPIFY_HYDROGEN_FLAG_DISABLE_DEPS_OPTIMIZER',
      default: false,
    }),

    // For the classic compiler:
    ...overrideFlag(commonFlags.legacyRuntime, {
      'legacy-runtime': {
        description:
          '[Classic Remix Compiler] ' +
          commonFlags.legacyRuntime['legacy-runtime'].description,
      },
    }),
    ...overrideFlag(commonFlags.sourcemap, {
      sourcemap: {
        description:
          '[Classic Remix Compiler] ' +
          commonFlags.sourcemap.sourcemap.description,
      },
    }),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(Dev);
    const originalDirectory = flags.path
      ? resolvePath(flags.path)
      : process.cwd();

    const diff = flags.diff
      ? await prepareDiffDirectory(originalDirectory, true)
      : undefined;

    const directory = diff?.targetDirectory ?? originalDirectory;

    const devParams = {
      ...flagsToCamelObject(flags),
      customerAccountPush: flags['customer-account-push__unstable'],
      path: directory,
      cliConfig: this.config,
    };

    const {close} = (await isViteProject(directory))
      ? await runDev(devParams)
      : await runClassicCompilerDev(devParams);

    setupResourceCleanup(async () => {
      await close();

      if (diff) {
        await diff.copyShopifyConfig();
        await diff.cleanup();
      }
    });
  }
}

type DevOptions = {
  entry?: string;
  port?: number;
  path?: string;
  codegen?: boolean;
  host?: boolean;
  codegenConfigPath?: string;
  disableVirtualRoutes?: boolean;
  disableVersionCheck?: boolean;
  disableDepsOptimizer?: boolean;
  envBranch?: string;
  env?: string;
  debug?: boolean;
  sourcemap?: boolean;
  inspectorPort?: number;
  customerAccountPush?: boolean;
  cliConfig: Config;
  verbose?: boolean;
  envFile: string;
};

export async function runDev({
  entry: ssrEntry,
  port: appPort,
  path: appPath,
  host,
  codegen: useCodegen = false,
  codegenConfigPath,
  disableVirtualRoutes,
  disableDepsOptimizer = false,
  envBranch,
  env: envHandle,
  debug = false,
  disableVersionCheck = false,
  inspectorPort,
  customerAccountPush: customerAccountPushFlag = false,
  envFile,
  cliConfig,
  verbose,
}: DevOptions) {
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

  if (verbose) setH2OVerbose();
  if (!isH2Verbose()) muteDevLogs();

  const root = appPath ?? process.cwd();

  const cliCommandPromise = getCliCommand(root);
  const backgroundPromise = getDevConfigInBackground(
    root,
    customerAccountPushFlag,
    envFile,
  );

  const envPromise = backgroundPromise.then(({fetchRemote, localVariables}) =>
    getAllEnvironmentVariables({
      root,
      envBranch,
      envHandle,
      fetchRemote,
      localVariables,
      envFile,
    }),
  );

  if (debug && !inspectorPort) {
    // The Vite plugin can find and return a port for the inspector
    // but we need to print the URLs before the runtime is ready,
    // so we find a port early here.
    inspectorPort = await findPort(DEFAULT_INSPECTOR_PORT);
  }

  const vite = await importVite(root);

  if (hydrogenPackagesPath) {
    // Force reoptimizing deps without printing the message
    await removeFile(joinPath(root, 'node_modules/.vite'));
  }

  const formatOptionsPromise = Promise.resolve().then(() =>
    getCodeFormatOptions(root),
  );

  const viteServer = await vite.createServer({
    root,
    clearScreen: false,
    customLogger: process.env.SHOPIFY_UNIT_TEST
      ? Object.assign(vite.createLogger(), {
          info: (msg: string) => collectLog('info', msg),
          warn: (msg: string) => collectLog('warn', msg),
          error: (msg: string) => collectLog('error', msg),
        })
      : undefined,
    server: {
      host: host ? true : undefined,
      // Allow Vite to read files from the Hydrogen packages in local development.
      fs: hydrogenPackagesPath
        ? {allow: [root, hydrogenPackagesPath]}
        : undefined,
    },
    plugins: [
      {
        name: 'hydrogen:cli',
        configResolved(config) {
          findHydrogenPlugin(config)?.api?.registerPluginOptions({
            disableVirtualRoutes,
          });

          findOxygenPlugin(config)?.api?.registerPluginOptions({
            debug,
            entry: ssrEntry,
            envPromise: envPromise.then(({allVariables}) => allVariables),
            inspectorPort,
            logRequestLine,
            entryPointErrorHandler: createEntryPointErrorHandler({
              disableDepsOptimizer,
              configFile: config.configFile,
              formatOptionsPromise,
              showSuccessBanner: () =>
                showSuccessBanner({
                  disableVirtualRoutes,
                  debug,
                  inspectorPort,
                  finalHost,
                  storefrontTitle,
                }),
            }),
          });
        },
        configureServer: (viteDevServer) => {
          if (customerAccountPushFlag) {
            viteDevServer.middlewares.use((req, res, next) => {
              const host = req.headers.host;

              if (host?.includes(TUNNEL_DOMAIN.ORIGINAL)) {
                req.headers.host = host.replace(
                  TUNNEL_DOMAIN.ORIGINAL,
                  TUNNEL_DOMAIN.REBRANDED,
                );
              }

              next();
            });
          }
        },
      },
    ],
  });

  const h2Plugin = findHydrogenPlugin(viteServer.config);
  if (!h2Plugin) {
    await viteServer.close();
    throw new AbortError(
      'Hydrogen plugin not found.',
      'Add `hydrogen()` plugin to your Vite config.',
    );
  }

  const h2PluginOptions = h2Plugin.api?.getPluginOptions?.();

  let codegenProcess: ReturnType<typeof spawnCodegenProcess> | undefined;
  const setupCodegen = useCodegen
    ? () => {
        codegenProcess?.kill(0);
        codegenProcess = spawnCodegenProcess({
          rootDirectory: root,
          configFilePath: codegenConfigPath,
          appDirectory: h2PluginOptions?.remixConfig?.appDirectory,
        });
      }
    : undefined;

  setupCodegen?.();

  if (hydrogenPackagesPath) {
    setupMonorepoReload(viteServer, hydrogenPackagesPath, setupCodegen);
  }

  // Store the port passed by the user in the config.
  const publicPort =
    appPort ?? viteServer.config.server.port ?? DEFAULT_APP_PORT;

  const [tunnel, cliCommand] = await Promise.all([
    backgroundPromise.then(({customerAccountPush, storefrontId}) =>
      customerAccountPush
        ? startTunnelAndPushConfig(root, cliConfig, publicPort, storefrontId)
        : undefined,
    ),
    cliCommandPromise,
    viteServer.listen(publicPort),
  ]);

  const publicUrl = new URL(
    viteServer.resolvedUrls!.local[0] ?? viteServer.resolvedUrls!.network[0]!,
  );

  const finalHost = tunnel?.host || publicUrl.toString() || publicUrl.origin;

  // Start the public facing server with the port passed by the user.
  enhanceH2Logs({
    rootDirectory: root,
    host: finalHost,
    cliCommand,
  });

  const {logInjectedVariables, allVariables} = await envPromise;

  logInjectedVariables();
  console.log('');
  viteServer.printUrls();
  viteServer.bindCLIShortcuts({print: true});
  console.log('\n');

  const storefrontTitle = (await backgroundPromise).storefrontTitle;
  showSuccessBanner({
    disableVirtualRoutes,
    debug,
    inspectorPort,
    finalHost,
    storefrontTitle,
  });

  if (!disableVersionCheck) {
    displayDevUpgradeNotice({targetPath: root});
  }

  if (customerAccountPushFlag && isMockShop(allVariables)) {
    notifyIssueWithTunnelAndMockShop(cliCommand);
  }

  return {
    getUrl: () => finalHost,
    async close() {
      codegenProcess?.removeAllListeners('close');
      codegenProcess?.kill('SIGINT');
      await Promise.allSettled([viteServer.close(), tunnel?.cleanup?.()]);
      viteServer.watcher.close();
    },
  };
}

function showSuccessBanner({
  disableVirtualRoutes,
  debug,
  inspectorPort,
  finalHost,
  storefrontTitle,
}: Pick<DevOptions, 'disableVirtualRoutes' | 'debug' | 'inspectorPort'> & {
  finalHost: string;
  storefrontTitle?: string;
}) {
  const customSections: AlertCustomSection[] = [];

  if (!disableVirtualRoutes) {
    customSections.push({body: getUtilityBannerlines(finalHost)});
  }

  if (debug && inspectorPort) {
    customSections.push({
      body: {warn: getDebugBannerLine(inspectorPort)},
    });
  }

  renderSuccess({
    body: [
      `View ${
        storefrontTitle ? colors.cyan(storefrontTitle) : 'Hydrogen'
      } app:`,
      {link: {url: finalHost}},
    ],
    customSections,
  });
}

function setupMonorepoReload(
  viteServer: ViteDevServer,
  monorepoPackagesPath: string,
  setupCodegen?: () => void,
) {
  // Note: app code is already tracked by Vite in monorepos
  // so there is no need to watch it and do manual work here.
  // We need to track, however, code that is not imported in
  // the app and manually reload things here.

  viteServer.httpServer?.once('listening', () => {
    // Watch the Hydrogen plugin for changes and restart Vite server.
    // Virtual routes are already tracked by Vite because they are in-app code.
    viteServer.watcher.add(
      monorepoPackagesPath + 'hydrogen/dist/vite/plugin.js',
    );

    // Any change in MiniOxygen will overwrite every file in `dist`.
    // We watch the plugin file for example and restart Vite server,
    // which also restarts the MiniOxygen worker.
    // The only exception is worker-entry because it follows a separate
    // build in TSUP.
    viteServer.watcher.add(
      monorepoPackagesPath + 'mini-oxygen/dist/vite/plugin.js',
    );
    viteServer.watcher.add(
      monorepoPackagesPath + 'mini-oxygen/dist/vite/worker-entry.js',
    );

    // Watch any file in hydrogen-codegen to restart the codegen process.
    viteServer.watcher.add(
      monorepoPackagesPath + 'hydrogen-codegen/dist/esm/index.js',
    );

    viteServer.watcher.on('change', async (file) => {
      if (file.includes(monorepoPackagesPath)) {
        if (file.includes('/packages/hydrogen-codegen/')) {
          if (setupCodegen) {
            setupCodegen();
            renderInfo({
              headline: 'The Hydrogen Codegen source has been modified.',
              body: 'The codegen process has been restarted.',
            });
          }
        } else {
          // Restart Vite server, which also restarts MiniOxygen
          await viteServer.restart(true);
          console.log('');
          renderInfo({
            headline: 'The H2O Vite plugins have been modified.',
            body: 'The Vite server has been restarted to reflect the changes.',
          });
        }
      }
    });
  });
}
