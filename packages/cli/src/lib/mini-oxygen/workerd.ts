import {createRequire} from 'node:module';
import {dirname, resolvePath} from '@shopify/cli-kit/node/path';
import {readFile, createFileReadStream} from '@shopify/cli-kit/node/fs';
import {renderSuccess} from '@shopify/cli-kit/node/ui';
import {outputNewline} from '@shopify/cli-kit/node/output';
import colors from '@shopify/cli-kit/node/colors';
import type {MiniOxygenInstance, MiniOxygenOptions} from './types.js';
import {
  SUBREQUEST_PROFILER_ENDPOINT,
  handleMiniOxygenImportFail,
  logRequestLine,
} from './common.js';
import {getDebugBannerLine, getUtilityBannerlines} from '../dev-shared.js';
import {
  H2O_BINDING_NAME,
  handleDebugNetworkRequest,
  createLogRequestEvent,
  setConstructors,
} from '../request-events.js';

export async function startWorkerdServer({
  root,
  appPort,
  inspectorPort: publicInspectorPort,
  assetsPort,
  debug = false,
  watch = false,
  buildPathWorkerFile,
  buildPathClient,
  env,
}: MiniOxygenOptions): Promise<MiniOxygenInstance> {
  const {createMiniOxygen, Response} = await import(
    '@shopify/mini-oxygen'
  ).catch(handleMiniOxygenImportFail);

  setConstructors({Response});

  // TODO: Remove this workaround when CAA is fixed
  async function handleCustomerAccountSchema() {
    // Request coming from /graphiql
    const require = createRequire(import.meta.url);
    const filePath = require.resolve(
      '@shopify/hydrogen/customer-account.schema.json',
    );

    return new Response(createFileReadStream(filePath), {
      headers: {'Content-Type': 'application/json'},
    });
  }

  const absoluteBundlePath = resolvePath(root, buildPathWorkerFile);
  const mainWorkerName = 'hydrogen';

  const miniOxygen = createMiniOxygen({
    debug,
    logRequestLine,
    port: appPort,
    host: 'localhost',
    liveReload: watch,
    inspectorPort: publicInspectorPort,
    inspectWorkerName: mainWorkerName,
    assets: {port: assetsPort, directory: buildPathClient},
    workers: [
      {
        name: 'hydrogen-router',
        modules: true,
        script: `export default { fetch: (request, env) => {
          const {pathname} = new URL(request.url);
          return pathname === '${SUBREQUEST_PROFILER_ENDPOINT}'
            ? env.profiler.fetch(request)
            : pathname === '/graphiql/customer-account.schema.json'
            ? env.assets.fetch(request)
            : env.next.fetch(request)
          }
        }`,
        serviceBindings: {
          profiler: handleDebugNetworkRequest,
          assets: handleCustomerAccountSchema,
          next: mainWorkerName,
        },
      },
      {
        name: mainWorkerName,
        modulesRoot: dirname(absoluteBundlePath),
        modules: [
          {
            type: 'ESModule',
            path: absoluteBundlePath,
            contents: await readFile(absoluteBundlePath),
          },
        ],
        bindings: {...env},
        serviceBindings: {
          [H2O_BINDING_NAME]: createLogRequestEvent({
            transformLocation: () => absoluteBundlePath,
          }),
        },
      },
    ],
  });

  const {workerUrl, inspectorUrl} = await miniOxygen.ready;

  return {
    port: Number(workerUrl.port),
    listeningAt: workerUrl.origin,
    reload(nextOptions) {
      return miniOxygen.reload(async ({workers}) => {
        const mainWorker = workers.find(({name}) => name === mainWorkerName)!;

        if (Array.isArray(mainWorker.modules) && mainWorker.modules[0]) {
          mainWorker.modules[0].contents = await readFile(absoluteBundlePath);
        }

        if (nextOptions) {
          mainWorker.bindings = {...(nextOptions?.env ?? env)};
        }

        return {workers};
      });
    },
    showBanner(options) {
      outputNewline();

      const customSections = [];

      if (options?.host) {
        customSections.push({body: getUtilityBannerlines(options.host)});
      }

      if (inspectorUrl) {
        customSections.push({
          body: {warn: getDebugBannerLine(Number(inspectorUrl.port))},
        });
      }

      renderSuccess({
        headline: `${
          options?.headlinePrefix ?? ''
        }MiniOxygen (Worker Runtime) ${
          options?.mode ?? 'development'
        } server running.`,
        body: [
          `View ${
            options?.appName ? colors.cyan(options?.appName) : 'Hydrogen'
          } app:`,
          {link: {url: options?.host || workerUrl.origin}},
        ],
        customSections,
      });

      console.log('');
    },
    async close() {
      await miniOxygen.dispose();
    },
  };
}
