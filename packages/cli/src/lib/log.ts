import {
  renderInfo,
  renderWarning,
  renderFatalError,
} from '@shopify/cli-kit/node/ui';
import {BugError} from '@shopify/cli-kit/node/error';
import {outputContent, outputToken} from '@shopify/cli-kit/node/output';
import colors from '@shopify/cli-kit/node/colors';
import ansiEscapes from 'ansi-escapes';
import {getGraphiQLUrl} from './graphiql-url.js';
import {importLocal} from './import-utils.js';

type ConsoleMethod = 'log' | 'warn' | 'error' | 'debug' | 'info';
const originalConsole = {...console};
const methodsReplaced = new Set<ConsoleMethod>();

type Matcher = (args: Array<any>, existingMatches: number) => boolean;
type Replacer = (args: Array<any>) => void | string[];
const addedReplacers = new Set<string>();
const messageReplacers: Array<[Matcher, Replacer]> = [];

export function resetAllLogs() {
  Object.assign(console, originalConsole);
  methodsReplaced.clear();
}

export function addMessageReplacers(
  key: string,
  ...items: Array<[Matcher, Replacer]>
) {
  if (!addedReplacers.has(key)) {
    addedReplacers.add(key);
    messageReplacers.push(...items);
  }
}

const printedMessages = new Set<string | Object>();

/**
 * Certain messages like errors might be printed multiple times.
 * This ensures they are only printed once per second.
 */
function debounceMessage(args: unknown[], debounceFor?: true | number) {
  const key = args
    .map((item) => {
      const message = (item as Error)?.message ?? (item as string);
      return typeof message === 'string' ? message : '';
    })
    .filter(Boolean)
    .join('');

  if (printedMessages.has(key)) return true;

  printedMessages.add(key);
  if (debounceFor !== true) {
    setTimeout(() => printedMessages.delete(key), debounceFor ?? 1000);
  }

  return false;
}

function warningDebouncer([first]: unknown[]) {
  return typeof first === 'string' &&
    // Show these warnings only once.
    /\[h2:(warn|info):(createStorefrontClient|createCustomerAccountClient)\]/.test(
      first,
    )
    ? true
    : undefined;
}

function injectLogReplacer(
  method: ConsoleMethod,
  debouncer?: false | ((args: unknown[]) => true | number | undefined),
) {
  if (!methodsReplaced.has(method)) {
    methodsReplaced.add(method);
    console[method] = (...args: unknown[]) => {
      if (debouncer !== false && debounceMessage(args, debouncer?.(args))) {
        return;
      }

      const replacers = messageReplacers.reduce((acc, [matcher, replacer]) => {
        if (matcher(args, acc.length)) acc.push(replacer);
        return acc;
      }, [] as Replacer[]);

      if (replacers.length === 0) return originalConsole[method](...args);

      const result = replacers.reduce(
        (resultArgs, replacer) => resultArgs && replacer(resultArgs),
        args as void | string[],
      );

      if (result) return originalConsole[method](...result);
    };
  }
}

/**
 * Mute logs from Miniflare / Workerd
 */
export function muteDevLogs({workerReload}: {workerReload?: boolean} = {}) {
  injectLogReplacer('log');
  injectLogReplacer('error');
  injectLogReplacer('warn', warningDebouncer);
  injectLogReplacer('debug', false);

  let isFirstWorkerReload = true;
  addMessageReplacers('dev-node', [
    ([first]) => typeof first === 'string' && first.includes('[mf:'),
    (args: string[]) => {
      const first = args[0] as string;

      if (workerReload !== false && first.includes('Worker reloaded')) {
        if (isFirstWorkerReload) {
          isFirstWorkerReload = false;
          // return args as string[];
          return;
        }

        return [first.replace('[mf:inf] ', '🔄 ') + '\n', ...args.slice(1)];
      }

      if (!first.includes('[mf:err]')) {
        // Hide logs except errors
        return;
      }
    },
  ]);

  addMessageReplacers(
    'dev-workerd',
    // Workerd logs
    [
      ([first]) =>
        typeof first === 'string' &&
        /^\x1B\[31m(workerd\/|stack:( (0|[a-f\d]{4,})){3,})/.test(first),
      () => {},
    ],
    [
      ([first]) =>
        typeof first === 'string' &&
        /\$LLVM_SYMBOLIZER|recursive isolate lock/.test(first),
      () => {},
    ],

    // Non-actionable warnings:
    [
      ([first]) =>
        typeof first === 'string' && /^A promise rejection/i.test(first),
      () => {},
    ],
    [
      ([first]) =>
        typeof first === 'string' &&
        /resolved to multiple addresses/i.test(first), // For win32
      () => {},
    ],

    // Non-actionable errors:
    [
      ([first]) => {
        const message = first?.message ?? first;
        return (
          typeof message === 'string' &&
          /^Network connection lost/i.test(message)
        );
      },
      () => {},
    ],
  );

  let isLastLineBlank = false;
  let isLastLineRequestLog = false;
  addMessageReplacers(
    'dev-vite',
    // Vite logs
    [
      // This log must come from Rollup and does not go through Vite's customLogger
      ([first]) =>
        typeof first === 'string' && /^Sourcemap for .*@remix-run/i.test(first),
      () => {},
    ],
    [
      // Log generated from Workerd HMR connection to Vite
      ([first]) =>
        typeof first === 'string' &&
        /^\[vite\] (connected|program reload)/i.test(first),
      () => {},
    ],
    [
      // Log that gets entangled with our initial dev logs
      ([first]) =>
        typeof first === 'string' &&
        /^Re-optimizing dependencies because/i.test(first),
      () => {},
    ],
    [
      // This error is fixed in new Remix versions:
      // https://github.com/remix-run/remix/pull/9194
      ([first]) => {
        const message: string = first?.message ?? first;
        return (
          /virtual-routes/.test(message) &&
          /(Failed to load url|Could not resolve module for file)/i.test(
            message,
          )
        );
      },
      () => {},
    ],
    [
      // This log must come from Rollup and does not go through Vite's customLogger
      ([first]) =>
        typeof first === 'string' && /^Generated an empty chunk:/i.test(first),
      () => {},
    ],
    [
      // Log new lines between Request logs and other logs
      ([first], existingMatches) => {
        // If this log is not going to be filtered by other replacers:
        if (existingMatches === 0 && typeof first === 'string') {
          // Example: "  GET  200  render  /products/1234  0.0ms"
          const isRequestLog = /^\s+[A-Z]+\s+\d{3}\s+[a-z]+\s+\//.test(
            // Clear ANSI colors before matching
            first.replace(/\u001b\[.*?m/g, ''),
          );

          if (
            !isLastLineBlank &&
            ((isRequestLog && !isLastLineRequestLog) ||
              (!isRequestLog && isLastLineRequestLog))
          ) {
            process.stdout.write('\n');
          }

          isLastLineRequestLog = isRequestLog;
          isLastLineBlank = /\n$/.test(first);
        }

        return false;
      },
      (params) => params,
    ],
  );

  // TODO: Remove this when this warning is fixed in @shopify/cli
  // This is printed using the `debug` package, which prints to stderr.
  const processStderrWrite = process.stderr.write;
  const timeout = setTimeout(() => {
    process.stderr.write = processStderrWrite;
  }, 5000);
  process.stderr.write = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Could not find ts-node')
    ) {
      clearTimeout(timeout);
      process.stderr.write = processStderrWrite;
      return false;
    }

    // @ts-ignore
    return processStderrWrite.apply(process.stderr, args);
  };
}

export function enhanceAuthLogs(hideInitialLog = false) {
  injectLogReplacer('log', warningDebouncer);

  addMessageReplacers(
    'auth',
    [
      ([first]) =>
        hideInitialLog &&
        typeof first === 'string' &&
        first.includes('To run this command,'),
      ([first]) => {
        return;
      },
    ],
    [
      ([first]) => typeof first === 'string' && first.includes('Logged in.'),
      () => {
        process.stdout.write(ansiEscapes.eraseLines(hideInitialLog ? 5 : 6));
        return;
      },
    ],
  );
}

/**
 * Modify logs from Hydrogen to use cli-kit banners
 * Format: `[h2:type:scope] message`. Example: `[h2:error:storefront.query] Wrong query`
 * Where the message can be multiline and the last line
 * can contain links to docs or other resources.
 */
export function enhanceH2Logs(options: {
  rootDirectory: string;
  host: string;
  cliCommand?: string;
}) {
  injectLogReplacer('error');
  injectLogReplacer('warn', warningDebouncer);
  injectLogReplacer('log', warningDebouncer);
  injectLogReplacer('info', warningDebouncer);

  addMessageReplacers('h2-warn', [
    ([first]) => {
      const message = first?.message ?? first;
      return typeof message === 'string' && message.includes('[h2:');
    },
    (args: any[]) => {
      const firstArg = args[0];
      const errorObject =
        typeof firstArg === 'object' && !!firstArg.stack
          ? (firstArg as Error)
          : undefined;

      let stringArg = errorObject?.message ?? (firstArg as string);

      if (
        stringArg.startsWith('[h2:info:createStorefrontClient]') &&
        stringArg.includes('defaulting to mock.shop')
      ) {
        // This message comes from hydrogen-react. Let's enhance it:
        stringArg += '\nRun `h2 link` to link your store.';
      }

      const [, type, scope, message] =
        stringArg.match(/\[h2:([^:]+):([^\]]+)\]\s+(.*)$/ims) || [];

      if (!type || !scope || !message) return args;

      const headline = `In Hydrogen's \`${scope.trim()}\`:\n\n`;

      const lines = message.split('\n');
      let lastLine = lines.at(-1) ?? '';
      const hasLinks = /https?:\/\//.test(lastLine);
      const hasCommands = /`h2 [^`]+`/.test(lastLine);

      if (hasCommands && lastLine) {
        lastLine = lastLine.replace(
          /`(h2) ([^`]+)`/g,
          colors.magentaBright(`\`${options.cliCommand ?? '$1'} $2\``),
        );
      }

      if (hasLinks || hasCommands) lines.pop();

      if (type === 'error' || errorObject) {
        let tryMessage = hasLinks || hasCommands ? lastLine : undefined;
        let stack = errorObject?.stack;
        let cause = errorObject?.cause as
          | {[key: string]: any; graphql?: {query: string; variables: string}}
          | string
          | undefined;

        if (typeof cause === 'string') {
          try {
            cause = JSON.parse(cause);
          } catch {}
        }

        if (typeof cause !== 'string' && !!cause?.graphql?.query) {
          const link = getGraphiQLUrl({
            host: options.host,
            graphql: cause.graphql,
          });

          const [, queryType, queryName] =
            cause.graphql.query.match(/(query|mutation)\s+(\w+)/) || [];

          tryMessage =
            (tryMessage ? `${tryMessage}\n\n` : '') +
            outputContent`To debug the ${queryType || 'query'}${
              queryName ? ` \`${colors.whiteBright(queryName)}\`` : ''
            }, try it in ${outputToken.link(colors.bold('GraphiQL'), link)}.`
              .value;
        }

        // Sanitize stack trace to only show app code
        const stackLines = stack?.split('\n') ?? [];
        const isAppLine = (line: string) =>
          line.includes(options.rootDirectory) &&
          !line.includes('node_modules');
        const firstAppLineIndex = stackLines.findIndex(isAppLine);
        const lastAppLineIndex =
          stackLines.length -
          [...stackLines]
            .reverse() // findLastIndex requires Node 18
            .findIndex(isAppLine);

        if (firstAppLineIndex > 0 && lastAppLineIndex > firstAppLineIndex) {
          stack =
            [
              stackLines[0], // Error message
              ...stackLines.slice(firstAppLineIndex, lastAppLineIndex), // App code
            ]
              .join('\n')
              .trim() || undefined;
        }

        const error = new BugError(
          headline +
            colors.bold(lines.join('\n').replace(' - Request', '\nRequest')),
          tryMessage,
        );

        error.cause = cause;
        error.stack = stack;
        renderFatalError(error);

        return;
      }

      let reference: undefined | string[] = undefined;

      if (hasLinks) {
        reference = [];
        for (const link of lastLine.matchAll(/https?:\/\/[^\s]+/g)) {
          reference.push(link[0]);
        }
      }

      const render = type === 'warn' ? renderWarning : renderInfo;

      render({
        body: headline + colors.bold(lines.join('\n')),
        reference,
        nextSteps: hasCommands ? [lastLine] : undefined,
      });

      return;
    },
  ]);
}

const warnings = new Set<string>();
export const warnOnce = (string: string) => {
  if (!warnings.has(string)) {
    console.warn(string);
    warnings.add(string);
  }
};

export function createRemixLogger() {
  const noop = () => {};
  const buildMessageBody = (message: string, details?: string[]) =>
    `In Remix:\n\n` +
    colors.bold(message) +
    (details ? '\n\n' + details.join('\n') : '');

  return {
    dev: noop,
    info: noop,
    debug: noop,
    warn: (message: string, options?: {details?: string[]; key?: string}) => {
      renderWarning({body: buildMessageBody(message, options?.details)});
    },
    error: (message: string, options?: {details?: string[]}) => {
      // As of Remix 1.19.1, only Chokidar calls the error logger.
      renderFatalError({
        name: 'error',
        type: 0,
        message: buildMessageBody(message, options?.details),
        skipOclifErrorHandling: true,
        tryMessage: '',
      });
    },
  };
}

export async function muteRemixLogs(root: string) {
  // Remix 1.19.1 warns about `serverNodeBuiltinsPolyfill` being deprecated
  // using a global logger that cannot be modified. Mute it here.
  try {
    type RemixLog = typeof import('@remix-run/dev/dist/tux/logger.js');

    const {logger} = await importLocal<RemixLog>(
      '@remix-run/dev/dist/tux/logger.js',
      root,
    );
    logger.warn = logger.debug = logger.info = () => {};
  } catch {
    // --
  }
}

export function setH2OVerbose() {
  if (!process.env.DEBUG || process.env.DEBUG === '*') {
    process.env.DEBUG = 'h2:*,o2:*';
  } else {
    process.env.DEBUG += ',h2:*,o2:*';
  }
}

export function isH2Verbose() {
  return !!(process.env.DEBUG === '*' || process.env.DEBUG?.includes('h2:*'));
}
