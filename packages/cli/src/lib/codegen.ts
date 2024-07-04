import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {formatCode, getCodeFormatOptions} from './format-code.js';
import {renderWarning} from '@shopify/cli-kit/node/ui';
import {
  joinPath,
  relativePath,
  basename,
  resolvePath,
} from '@shopify/cli-kit/node/path';
import {AbortError} from '@shopify/cli-kit/node/error';
import type {LoadCodegenConfigResult} from '@graphql-codegen/cli';
import type {GraphQLConfig} from 'graphql-config';
import {importLocal} from './import-utils.js';

const nodePath = process.argv[1];
const modulePath = fileURLToPath(import.meta.url);
const isStandaloneProcess = nodePath === modulePath;

if (isStandaloneProcess) {
  codegen({
    rootDirectory: process.argv[2]!,
    appDirectory: process.argv[3]!,
    configFilePath: process.argv[4],
    watch: true,
  });
}

function normalizeCodegenError(errorMessage: string, rootDirectory?: string) {
  if (errorMessage.includes('AbortError: ')) {
    const parsedError = errorMessage.split('AbortError: ')[1] ?? '';
    const message = parsedError.split('\n')[0];
    const details = parsedError.match(/tryMessage: '(.*)',$/m)?.[1];

    if (message) return {message, details};
  }

  const [first = '', ...rest] = errorMessage
    .replaceAll('[FAILED]', '')
    .replace(/\s{2,}/g, '\n')
    .replace(/\n,\n/, '\n')
    .trim()
    .split('\n');

  const message = '[Codegen] ' + first;

  let details = rest.join('\n');
  if (rootDirectory) {
    // Codegen CLI shows errors using forward slashes even on Windows.
    const forwardSlashRootDir = rootDirectory.replaceAll('\\', '/') + '/';
    details = details.replaceAll(forwardSlashRootDir, '');
  }

  return {message, details};
}

/**
 * Spawns a child process to run GraphlQL CLI Codegen.
 * Running on a separate process splits work from this processor
 * and also allows us to filter out logs.
 */
export function spawnCodegenProcess({
  rootDirectory,
  appDirectory,
  configFilePath,
}: CodegenOptions) {
  let command: string;
  let args: string[];

  const hydrogenArgvIndex = process.argv.findIndex((a) => a === 'hydrogen');

  if (hydrogenArgvIndex >= 1) {
    // Call the `h2 codegen --watch` command in a separate process.
    command = process.argv[0]!;
    args = [
      ...process.argv.slice(1, hydrogenArgvIndex + 1),
      'codegen',
      '--watch',
      '--path',
      rootDirectory,
    ];

    if (configFilePath) {
      args.push('--codegen-config-path', configFilePath);
    }
  } else {
    // Legacy: in case this command wasn't run using our CLI
    // (is this even possible?) just do what we used to do
    // before CLI bundling:
    command = 'node';
    args = [
      fileURLToPath(import.meta.url),
      rootDirectory,
      appDirectory ?? resolvePath('app'),
      configFilePath ?? '',
    ];
  }

  const child = spawn(command, args, {stdio: ['inherit', 'ignore', 'pipe']});

  child.stderr.on('data', (data) => {
    const dataString: string =
      typeof data === 'string' ? data : data?.toString?.('utf8') ?? '';

    if (!dataString) return;

    const {message, details} = normalizeCodegenError(dataString, rootDirectory);

    // Filter these logs even on verbose mode because it floods the terminal:
    if (/`punycode`/.test(message)) return;
    if (/\.body\[\d\]/.test(message)) return;
    if (/console\.time(End)?\(\)/.test(message)) return;

    console.log('');
    renderWarning({headline: message, body: details});
  });

  child.on('close', (code) => {
    if (code && code > 0) {
      renderWarning({
        headline: 'Codegen process exited with code ' + code,
        body: 'There should be more logs above.',
      });
    }
  });

  return child;
}

type ProjectDirs = {
  rootDirectory: string;
  appDirectory?: string;
};

type CodegenOptions = ProjectDirs & {
  watch?: boolean;
  configFilePath?: string;
  forceSfapiVersion?: string;
};

export function codegen(options: CodegenOptions) {
  return generateTypes(options).catch((error: Error) => {
    if (error instanceof AbortError) throw error;

    const {message, details} = normalizeCodegenError(
      error.message,
      options.rootDirectory,
    );

    throw new AbortError(message, details);
  });
}

async function generateTypes({
  watch,
  configFilePath,
  forceSfapiVersion,
  ...dirs
}: CodegenOptions) {
  type CodegeType = typeof import('@graphql-codegen/cli');

  const {generate, loadCodegenConfig, CodegenContext} =
    await importLocal<CodegeType>(
      '@graphql-codegen/cli',
      dirs.rootDirectory,
    ).catch(() => {
      throw new AbortError(
        'Could not load GraphQL Codegen CLI.',
        'Please make sure you have `@graphql-codegen/cli` installed as a dev dependency.',
      );
    });

  const {config: codegenConfig} =
    // Load <root>/codegen.ts if available
    (await loadCodegenConfig({
      configFilePath: configFilePath ?? dirs.rootDirectory,
    })) ||
    // Fall back to default config
    (await generateDefaultConfig(dirs, forceSfapiVersion));

  await addHooksToHydrogenOptions(codegenConfig, dirs);

  const codegenContext = new CodegenContext({
    config: {
      ...codegenConfig,
      watch,
      // Note: do not use `silent` without `watch`, it will swallow errors and
      // won't hide all logs. `errorsOnly` flag doesn't work either.
      silent: !watch,

      // @ts-expect-error this is to avoid process.cwd() in tests
      cwd: dirs.rootDirectory,
    },
    // https://github.com/dotansimha/graphql-code-generator/issues/9490
    filepath: 'not-used-but-must-be-set',
  });

  codegenContext.cwd = dirs.rootDirectory;

  await generate(codegenContext, true);

  return Object.entries(codegenConfig.generates).reduce((acc, [key, value]) => {
    if ('documents' in value) {
      acc[key] = (
        Array.isArray(value.documents) ? value.documents : [value.documents]
      ).filter((document) => typeof document === 'string') as string[];
    }

    return acc;
  }, {} as Record<string, string[]>);
}

async function generateDefaultConfig(
  {
    rootDirectory,
    appDirectory = resolvePath(rootDirectory, 'app'),
  }: ProjectDirs,
  forceSfapiVersion?: string,
): Promise<LoadCodegenConfigResult> {
  type HydrogenCodegen = typeof import('@shopify/hydrogen-codegen');
  const {getSchema, preset, pluckConfig} = await importLocal<HydrogenCodegen>(
    '@shopify/hydrogen-codegen',
    rootDirectory,
  ).catch(() => {
    throw new AbortError(
      'Could not load Hydrogen Codegen.',
      'Please make sure you have `@shopify/hydrogen-codegen` installed as a dev dependency.',
    );
  });

  type GraphQLConfigType = typeof import('graphql-config');
  const {loadConfig} = await importLocal<GraphQLConfigType>(
    'graphql-config',
    rootDirectory,
  ).catch(() => {
    throw new AbortError(
      'Could not load GraphQL Config.',
      'Please make sure you have `graphql-config` installed as a dev dependency.',
    );
  });

  const gqlConfig = await loadConfig({
    rootDir: rootDirectory,
    throwOnEmpty: false,
    throwOnMissing: false,
    legacy: false,
  }).catch(() => undefined);

  const sfapiSchema = getSchema('storefront');
  const sfapiProject = findGqlProject(sfapiSchema, gqlConfig);

  const defaultGlob = '*!(*.d).{ts,tsx,js,jsx}'; // No d.ts files
  const appDirRelative = relativePath(rootDirectory, appDirectory);

  const caapiSchema = getSchema('customer-account', {throwIfMissing: false});
  const caapiProject = caapiSchema
    ? findGqlProject(caapiSchema, gqlConfig)
    : undefined;

  const customerAccountAPIConfig = caapiProject?.documents
    ? {
        ['customer-accountapi.generated.d.ts']: {
          preset,
          schema: caapiSchema,
          documents: caapiProject?.documents,
        },
      }
    : undefined;

  return {
    filepath: 'virtual:codegen',
    config: {
      overwrite: true,
      pluckConfig: pluckConfig as any,
      generates: {
        ['storefrontapi.generated.d.ts']: {
          preset,
          schema: sfapiSchema,
          documents: sfapiProject?.documents ?? [
            defaultGlob, // E.g. ./server.(t|j)s
            joinPath(appDirRelative, '**', defaultGlob), // E.g. app/routes/_index.(t|j)sx
          ],

          ...(!!forceSfapiVersion && {
            presetConfig: {importTypes: false},
            schema: {
              [`https://hydrogen-preview.myshopify.com/api/${
                forceSfapiVersion.split(':')[0]
              }/graphql.json`]: {
                headers: {
                  'content-type': 'application/json',
                  'X-Shopify-Storefront-Access-Token':
                    forceSfapiVersion.split(':')[1] ??
                    '3b580e70970c4528da70c98e097c2fa0',
                },
              },
            },
            config: {
              defaultScalarType: 'string',
              scalars: {JSON: 'unknown'},
            },
          }),
        },
        ...customerAccountAPIConfig,
      },
    },
  };
}

function findGqlProject(schemaFilepath: string, gqlConfig?: GraphQLConfig) {
  if (!gqlConfig) return;

  const schemaFilename = basename(schemaFilepath);
  return Object.values(gqlConfig.projects || {}).find(
    (project) =>
      typeof project.schema === 'string' &&
      project.schema.endsWith(schemaFilename),
  ) as GraphQLConfig['projects'][number];
}

async function addHooksToHydrogenOptions(
  codegenConfig: LoadCodegenConfigResult['config'],
  {rootDirectory}: ProjectDirs,
) {
  // Find generated files that use the Hydrogen preset
  const hydrogenProjectsOptions = Object.values(codegenConfig.generates).filter(
    (value) => {
      const foundPreset = (Array.isArray(value) ? value[0] : value)?.preset;
      if (typeof foundPreset === 'object') {
        const name = Symbol.for('name');
        if (name in foundPreset) {
          return foundPreset[name] === 'hydrogen';
        }
      }
    },
  );

  // Add hooks to run Prettier before writing files
  for (const options of hydrogenProjectsOptions) {
    const hydrogenOptions = Array.isArray(options) ? options[0] : options;

    if (hydrogenOptions) {
      const formatConfig = await getCodeFormatOptions(rootDirectory);

      hydrogenOptions.hooks = {
        beforeOneFileWrite: (file: string, content: string) =>
          formatCode(content, formatConfig, file),
        ...hydrogenOptions.hooks,
      };
    }
  }
}
