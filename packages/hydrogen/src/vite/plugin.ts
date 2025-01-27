import type {Plugin, ConfigEnv} from 'vite';
import type {Preset as RemixPreset} from '@remix-run/dev';
import {
  setupHydrogenMiddleware,
  type HydrogenMiddlewareOptions,
} from './hydrogen-middleware.js';
import type {HydrogenPluginOptions} from './types.js';
import {type RequestEventPayload, emitRequestEvent} from './request-events.js';
import {getVirtualRoutes} from './get-virtual-routes.js';

// Do not import JS from here, only types
import type {OxygenPlugin} from '~/mini-oxygen/vite/plugin.js';
import {getCompatDate} from './compat-date.js';

export type {HydrogenPluginOptions};

type HydrogenSharedOptions = Partial<
  Pick<HydrogenPluginOptions, 'disableVirtualRoutes'> &
    Pick<ConfigEnv, 'command'> & {
      remixConfig?: Parameters<
        NonNullable<RemixPreset['remixConfigResolved']>
      >[0]['remixConfig'];
    }
>;

const sharedOptions: HydrogenSharedOptions = {};

/**
 * For internal use only.
 * @private
 */
export type HydrogenPlugin = Plugin<{
  registerPluginOptions(newOptions: HydrogenPluginOptions): void;
  getPluginOptions(): HydrogenSharedOptions;
}>;

/**
 * Enables Hydrogen utilities for local development
 * such as GraphiQL, Subrequest Profiler, etc.
 */
export function hydrogen(pluginOptions: HydrogenPluginOptions = {}): Plugin[] {
  let middlewareOptions: HydrogenMiddlewareOptions = {};

  return [
    {
      name: 'hydrogen:main',
      config(_, env) {
        sharedOptions.command = env.command;

        const isHydrogenMonorepo = new URL(
          '../../..',
          import.meta.url,
        ).pathname.endsWith('/hydrogen/packages/');

        return {
          ssr: {
            optimizeDeps: {
              // Add CJS dependencies that break code in workerd
              // with errors like "require/module/exports is not defined":
              include: [
                // React deps:
                'react',
                'react/jsx-runtime',
                'react/jsx-dev-runtime',
                'react-dom',
                'react-dom/server',
                '@remix-run/server-runtime',
              ],
            },
          },
          // Vite performs an initial reload after optimizing these dependencies.
          // Do it early to avoid the initial reload:
          optimizeDeps: {
            // Avoid optimizing Hydrogen itself in the monorepo
            // to prevent caching source code changes:
            include: isHydrogenMonorepo
              ? ['content-security-policy-builder', 'worktop/cookie']
              : ['@shopify/hydrogen'],
          },
        };
      },
      api: {
        registerPluginOptions(newOptions) {
          middlewareOptions = mergeOptions(middlewareOptions, newOptions);
          if ('disableVirtualRoutes' in middlewareOptions) {
            sharedOptions.disableVirtualRoutes =
              middlewareOptions.disableVirtualRoutes;
          }
        },
        getPluginOptions() {
          return sharedOptions;
        },
      },
      configResolved(resolvedConfig) {
        // Pass the setup functions to the Oxygen runtime.
        const oxygenPlugin = resolvedConfig.plugins.find(
          (plugin) => plugin.name === 'oxygen:main',
        ) as undefined | OxygenPlugin;

        middlewareOptions.isOxygen = !!oxygenPlugin;

        oxygenPlugin?.api?.registerPluginOptions?.({
          compatibilityDate: getCompatDate(),
          requestHook: ({request, response, meta}) => {
            // Emit events for requests
            emitRequestEvent(
              {
                __fromVite: true,
                eventType: 'request',
                url: request.url,
                requestId: request.headers['request-id'],
                purpose: request.headers['purpose'],
                startTime: meta.startTimeMs,
                endTime: meta.endTimeMs,
                responseInit: {
                  status: response.status,
                  statusText: response.statusText,
                  headers: Object.entries(response.headers),
                },
              },
              resolvedConfig.root,
            );
          },
          crossBoundarySetup: [
            {
              // Setup the global function in the Oxygen worker
              script: (binding) => {
                globalThis.__H2O_LOG_EVENT = binding;
              },
              binding: (data) => {
                // Emit events for subrequests from the parent process
                emitRequestEvent(
                  data as RequestEventPayload,
                  resolvedConfig.root,
                );
              },
            },
            /**
             * To avoid initial CSS flash during development,
             * most frameworks implement a way to gather critical CSS.
             * Remix does this by calling a global function that their
             * Vite plugin creates in the Node.js process:
             * @see https://github.com/remix-run/remix/blob/b07921efd5e8eed98e2996749852777c71bc3e50/packages/remix-server-runtime/dev.ts#L37-L47
             *
             * Here we are setting up a stub function in the Oxygen worker
             * that will be called by Remix during development. Then, we forward
             * this request to the Node.js process (Vite server) where the actual
             * Remix function is called and the critical CSS is returned to the worker.
             */
            {
              script: (binding) => {
                // Setup global dev hooks in Remix in the worker environment
                // using the binding function passed from Node environment:
                globalThis.__remix_devServerHooks = {getCriticalCss: binding};
              },
              binding: (...args) => {
                // Call the global Remix dev hook for critical CSS in Node environment:
                return globalThis.__remix_devServerHooks?.getCriticalCss?.(
                  ...args,
                );
              },
            },
          ],
        });
      },
      configureServer: {
        order: 'pre',
        handler: (viteDevServer) => {
          return () => {
            setupHydrogenMiddleware(
              viteDevServer,
              mergeOptions(pluginOptions, middlewareOptions),
            );
          };
        },
      },
    } satisfies HydrogenPlugin,
  ];
}

function mergeOptions(
  acc: HydrogenPluginOptions,
  newOptions: HydrogenPluginOptions,
) {
  const newOptionsWithoutUndefined = Object.fromEntries(
    Object.entries(newOptions).filter(([_, value]) => value !== undefined),
  );

  return {...acc, ...newOptionsWithoutUndefined};
}

hydrogen.v3preset = () =>
  ({
    name: 'hydrogen',
    remixConfigResolved({remixConfig}) {
      sharedOptions.remixConfig = remixConfig;
    },
  } satisfies RemixPreset);

hydrogen.preset = () =>
  ({
    name: 'hydrogen',
    remixConfigResolved({remixConfig}) {
      sharedOptions.remixConfig = remixConfig;
    },
    remixConfig() {
      if (sharedOptions.disableVirtualRoutes) return {};

      return {
        buildDirectory: 'dist',
        async routes(defineRoutes) {
          if (
            sharedOptions.disableVirtualRoutes ||
            sharedOptions.command !== 'serve'
          ) {
            return {};
          }

          const {root, routes: virtualRoutes} = await getVirtualRoutes();

          const result = defineRoutes((route) => {
            route(root.path, root.file, {id: root.id}, () => {
              virtualRoutes.map(({path, file, index, id}) => {
                route(path, file, {id, index});
              });
            });
          });

          // - Goal: stop matching the user's root with our virtual routes
          // to avoid adding layouts and calling user loaders.
          //
          // - Problem: Even though root-less routes work in Remix, it always
          // adds the user root as the parentId of every route when we leave it
          // as undefined. Even if we delete it manually here, it adds it back:
          // https://github.com/remix-run/remix/blob/b07921efd5e8eed98e2996749852777c71bc3e50/packages/remix-dev/config.ts#L565
          //
          // - Solution:
          // The String object tricks Remix into thinking that the
          // parentId is defined (!!new String('') === true) so it doesn't
          // overwrite it with `root`. Later, this value acts as an
          // undefined / empty string when matching routes so it
          // doesn't match the user root.
          // @ts-expect-error
          result[root.id].parentId = new String('');

          return result;
        },
      };
    },
  } satisfies RemixPreset);
