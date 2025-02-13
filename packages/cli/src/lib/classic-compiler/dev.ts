import fs from 'node:fs/promises';
import type {ChildProcess} from 'node:child_process';
import {outputDebug, outputInfo} from '@shopify/cli-kit/node/output';
import {fileExists} from '@shopify/cli-kit/node/fs';
import {renderFatalError} from '@shopify/cli-kit/node/ui';
import {relativePath, resolvePath} from '@shopify/cli-kit/node/path';
import {copyPublicFiles} from './build.js';
import {
  type RemixConfig,
  assertOxygenChecks,
  getProjectPaths,
  getRemixConfig,
  handleRemixImportFail,
  type ServerMode,
} from '../remix-config.js';
import {
  createRemixLogger,
  enhanceH2Logs,
  muteDevLogs,
  isH2Verbose,
  setH2OVerbose,
} from '../log.js';
import {DEFAULT_APP_PORT} from '../flags.js';
import {Config} from '@oclif/core';
import {
  type MiniOxygen,
  startMiniOxygen,
  buildAssetsUrl,
} from '../mini-oxygen/index.js';
import {addVirtualRoutes} from '../virtual-routes.js';
import {spawnCodegenProcess} from '../codegen.js';
import {getAllEnvironmentVariables} from '../environment-variables.js';
import {setupLiveReload} from '../live-reload.js';
import {checkRemixVersions} from '../remix-version-check.js';
import {displayDevUpgradeNotice} from '../../commands/hydrogen/upgrade.js';
import {findPort} from '../find-port.js';
import {
  startTunnelAndPushConfig,
  getDevConfigInBackground,
  isMockShop,
  notifyIssueWithTunnelAndMockShop,
} from '../dev-shared.js';
import {getCliCommand} from '../shell.js';
import {importLocal} from '../import-utils.js';
import {RouteManifest} from '@remix-run/dev/dist/config/routes.js';

const LOG_REBUILDING = '🧱 Rebuilding...';
const LOG_REBUILT = '🚀 Rebuilt';

type DevOptions = {
  port?: number;
  path?: string;
  codegen?: boolean;
  legacyRuntime?: boolean;
  codegenConfigPath?: string;
  disableVirtualRoutes?: boolean;
  disableVersionCheck?: boolean;
  env?: string;
  envBranch?: string;
  debug?: boolean;
  sourcemap?: boolean;
  inspectorPort?: number;
  customerAccountPush?: boolean;
  cliConfig: Config;
  shouldLiveReload?: boolean;
  verbose?: boolean;
  envFile: string;
};

function filterOutVirtualRoutes(config: RemixConfig): RemixConfig {
  let routes: RouteManifest = {};
  Object.entries(config.routes).forEach(([key, value]) => {
    if (!key.includes('virtual-routes')) {
      routes[key] = value;
    }
  });
  return {
    ...config,
    routes,
  };
}

export async function runClassicCompilerDev({
  port: appPort,
  path: appPath,
  codegen: useCodegen = false,
  legacyRuntime = false,
  codegenConfigPath,
  disableVirtualRoutes,
  env: envHandle,
  envBranch,
  debug = false,
  sourcemap = true,
  disableVersionCheck = false,
  inspectorPort,
  customerAccountPush: customerAccountPushFlag = false,
  shouldLiveReload = true,
  envFile,
  cliConfig,
  verbose,
}: DevOptions) {
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

  if (verbose) setH2OVerbose();
  if (!isH2Verbose()) muteDevLogs();

  const {root, publicPath, buildPathClient, buildPathWorkerFile} =
    getProjectPaths(appPath);

  const copyFilesPromise = copyPublicFiles(publicPath, buildPathClient);
  const cliCommandPromise = getCliCommand(root);

  const reloadConfig = async () => {
    const config = (await getRemixConfig(root)) as RemixConfig;

    return disableVirtualRoutes
      ? filterOutVirtualRoutes(config)
      : addVirtualRoutes(config).catch((error) => {
          // Seen this fail when somehow NPM doesn't publish
          // the full 'virtual-routes' directory.
          // E.g. https://unpkg.com/browse/@shopify/cli-hydrogen@0.0.0-next-aa15969-20230703072007/dist/virtual-routes/
          outputDebug(
            'Could not add virtual routes: ' +
              (error?.stack ?? error?.message ?? error),
          );

          return config;
        });
  };

  const getFilePaths = (file: string) => {
    const fileRelative = relativePath(root, file);
    return [fileRelative, resolvePath(root, fileRelative)] as const;
  };

  const serverBundleExists = () => fileExists(buildPathWorkerFile);

  if (!appPort) {
    appPort = await findPort(DEFAULT_APP_PORT);
  }

  const assetsPort = legacyRuntime ? 0 : await findPort(appPort + 100);
  if (assetsPort) {
    // Note: Set this env before loading Remix config!
    process.env.HYDROGEN_ASSET_BASE_URL = await buildAssetsUrl(
      assetsPort,
      root,
    );
  }

  const backgroundPromise = getDevConfigInBackground(
    root,
    customerAccountPushFlag,
    envFile,
  );

  const tunnelPromise =
    cliConfig &&
    backgroundPromise.then(({customerAccountPush, storefrontId}) => {
      if (customerAccountPush) {
        return startTunnelAndPushConfig(
          root,
          cliConfig,
          appPort!,
          storefrontId,
        );
      }
    });

  const remixConfig = await reloadConfig();
  assertOxygenChecks(remixConfig);

  const envPromise = backgroundPromise.then(({fetchRemote, localVariables}) =>
    getAllEnvironmentVariables({
      root,
      fetchRemote,
      envBranch,
      envHandle,
      localVariables,
      envFile,
    }),
  );

  type RemixWatch = typeof import('@remix-run/dev/dist/compiler/watch.js');
  type RemixFileWatchCache =
    typeof import('@remix-run/dev/dist/compiler/fileWatchCache.js');

  const [{watch}, {createFileWatchCache}] = await Promise.all([
    importLocal<RemixWatch>('@remix-run/dev/dist/compiler/watch.js', root),
    importLocal<RemixFileWatchCache>(
      '@remix-run/dev/dist/compiler/fileWatchCache.js',
      root,
    ),
  ]).catch(handleRemixImportFail);

  let isInitialBuild = true;
  let initialBuildDurationMs = 0;
  let initialBuildStartTimeMs = Date.now();

  const liveReload = shouldLiveReload
    ? await setupLiveReload(remixConfig.dev?.port ?? 8002, root)
    : undefined;

  let miniOxygen: MiniOxygen;
  let codegenProcess: ChildProcess;
  async function safeStartMiniOxygen() {
    if (miniOxygen) return;

    const {allVariables, logInjectedVariables} = await envPromise;

    miniOxygen = await startMiniOxygen(
      {
        root,
        debug,
        appPort,
        assetsPort,
        inspectorPort,
        watch: !liveReload,
        buildPathWorkerFile,
        buildPathClient,
        env: allVariables,
      },
      legacyRuntime,
    );

    logInjectedVariables();

    const host = (await tunnelPromise)?.host ?? miniOxygen.listeningAt;

    const cliCommand = await cliCommandPromise;
    enhanceH2Logs({host, cliCommand, ...remixConfig});

    const {storefrontTitle} = await backgroundPromise;

    miniOxygen.showBanner({
      appName: storefrontTitle,
      headlinePrefix:
        initialBuildDurationMs > 0
          ? `Initial build: ${initialBuildDurationMs}ms\n`
          : '',
      host,
    });

    if (useCodegen) {
      codegenProcess = spawnCodegenProcess({
        ...remixConfig,
        configFilePath: codegenConfigPath,
      });
    }

    checkRemixVersions(root);

    if (!disableVersionCheck) {
      displayDevUpgradeNotice({targetPath: appPath});
    }

    if (customerAccountPushFlag && isMockShop(allVariables)) {
      notifyIssueWithTunnelAndMockShop(cliCommand);
    }
  }

  const fileWatchCache = createFileWatchCache();
  let skipRebuildLogs = false;

  const closeWatcher = await watch(
    {
      config: remixConfig,
      options: {
        mode: process.env.NODE_ENV as ServerMode,
        sourcemap,
      },
      fileWatchCache,
      logger: createRemixLogger(),
    },
    {
      reloadConfig,
      onBuildStart(ctx) {
        if (!isInitialBuild && !skipRebuildLogs) {
          outputInfo(LOG_REBUILDING);
          console.time(LOG_REBUILT);
        }

        liveReload?.onBuildStart(ctx);
      },
      onBuildManifest: liveReload?.onBuildManifest,
      async onBuildFinish(context, duration, succeeded) {
        if (isInitialBuild) {
          await copyFilesPromise;
          initialBuildDurationMs = Date.now() - initialBuildStartTimeMs;
          isInitialBuild = false;
        } else if (!skipRebuildLogs) {
          skipRebuildLogs = false;
          console.timeEnd(LOG_REBUILT);
          if (!miniOxygen) console.log(''); // New line
        }

        if (!miniOxygen && !(await serverBundleExists())) {
          return renderFatalError({
            name: 'BuildError',
            type: 0,
            message:
              'MiniOxygen cannot start because the server bundle has not been generated.',
            skipOclifErrorHandling: true,
            tryMessage:
              'This is likely due to an error in your app and Remix is unable to compile. Try fixing the app and MiniOxygen will start.',
          });
        }

        if (succeeded) {
          if (!miniOxygen) {
            await safeStartMiniOxygen();
          } else if (liveReload) {
            await miniOxygen.reload();
          }

          liveReload?.onAppReady(context);
        }
      },
      async onFileCreated(file: string) {
        const [relative, absolute] = getFilePaths(file);
        outputInfo(`\n📄 File created: ${relative}`);

        if (absolute.startsWith(publicPath)) {
          await copyPublicFiles(
            absolute,
            absolute.replace(publicPath, buildPathClient),
          );
        }
      },
      async onFileChanged(file: string) {
        fileWatchCache.invalidateFile(file);

        const [relative, absolute] = getFilePaths(file);
        outputInfo(`\n📄 File changed: ${relative}`);

        if (relative.endsWith(envFile)) {
          skipRebuildLogs = true;
          const {fetchRemote} = await backgroundPromise;
          const {allVariables, logInjectedVariables} =
            await getAllEnvironmentVariables({
              root,
              fetchRemote,
              envBranch,
              envHandle,
              envFile,
            });

          logInjectedVariables();

          await miniOxygen.reload({
            env: allVariables,
          });
        }

        if (absolute.startsWith(publicPath)) {
          await copyPublicFiles(
            absolute,
            absolute.replace(publicPath, buildPathClient),
          );
        }
      },
      async onFileDeleted(file: string) {
        fileWatchCache.invalidateFile(file);

        const [relative, absolute] = getFilePaths(file);
        outputInfo(`\n📄 File deleted: ${relative}`);

        if (absolute.startsWith(publicPath)) {
          await fs.unlink(absolute.replace(publicPath, buildPathClient));
        }
      },
    },
  );

  return {
    getUrl: () => miniOxygen.listeningAt,
    async close() {
      codegenProcess?.removeAllListeners('close');
      codegenProcess?.kill('SIGINT');
      await Promise.allSettled([
        closeWatcher(),
        miniOxygen?.close(),
        Promise.resolve(tunnelPromise).then((tunnel) => tunnel?.cleanup?.()),
      ]);
    },
  };
}
