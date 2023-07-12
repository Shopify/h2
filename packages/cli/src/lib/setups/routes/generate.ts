import {readdir} from 'fs/promises';
import {
  fileExists,
  readFile,
  writeFile,
  copyFile,
  mkdir,
} from '@shopify/cli-kit/node/fs';
import {
  joinPath,
  dirname,
  relativizePath,
  relativePath,
  resolvePath,
  basename,
} from '@shopify/cli-kit/node/path';
import {AbortError} from '@shopify/cli-kit/node/error';
import {AbortSignal} from '@shopify/cli-kit/node/abort';
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui';
import {
  transpileFile,
  type TranspilerOptions,
} from '../../../lib/transpile-ts.js';
import {
  type FormatOptions,
  formatCode,
  getCodeFormatOptions,
} from '../../../lib/format-code.js';
import {
  GENERATOR_APP_DIR,
  GENERATOR_ROUTE_DIR,
  getStarterDir,
  getTemplateAppFile,
} from '../../../lib/build.js';
import {
  convertRouteToV2,
  convertTemplateToRemixVersion,
  getV2Flags,
  type RemixV2Flags,
} from '../../../lib/remix-version-interop.js';
import {getRemixConfig} from '../../../lib/config.js';
import {findFileWithExtension} from '../../file.js';

export const ROUTE_MAP: Record<string, string | string[]> = {
  home: 'index',
  page: 'pages/$pageHandle',
  cart: 'cart',
  products: 'products/$productHandle',
  collections: 'collections/$collectionHandle',
  policies: ['policies/index', 'policies/$policyHandle'],
  robots: '[robots.txt]',
  sitemap: '[sitemap.xml]',
  account: ['account/login', 'account/register'],
};

export const ALL_ROUTE_CHOICES = [...Object.keys(ROUTE_MAP), 'all'];

type GenerateRoutesResult = {
  sourceRoute: string;
  destinationRoute: string;
  operation: 'created' | 'skipped' | 'replaced';
};

type GenerateRoutesOptions = Omit<
  GenerateProjectFileOptions,
  'localePrefix'
> & {
  routeName: string | string[];
  directory: string;
  localePrefix?: GenerateProjectFileOptions['localePrefix'] | false;
};

export async function generateRoutes(options: GenerateRoutesOptions) {
  const routePath =
    options.routeName === 'all'
      ? Object.values(ROUTE_MAP).flat()
      : typeof options.routeName === 'string'
      ? ROUTE_MAP[options.routeName as keyof typeof ROUTE_MAP]
      : options.routeName
          .flatMap(
            (item: keyof typeof ROUTE_MAP) =>
              ROUTE_MAP[item as keyof typeof ROUTE_MAP] as string | string[],
          )
          .filter(Boolean);

  if (!routePath) {
    throw new AbortError(
      `No route found for ${
        options.routeName
      }. Try one of ${ALL_ROUTE_CHOICES.join()}.`,
    );
  }

  const {rootDirectory, appDirectory, future, tsconfigPath} =
    await getRemixConfig(options.directory);

  const routesArray = (Array.isArray(routePath) ? routePath : [routePath]).map(
    (item) => GENERATOR_ROUTE_DIR + '/' + item,
  );

  const v2Flags = await getV2Flags(rootDirectory, future);
  const formatOptions = await getCodeFormatOptions(rootDirectory);
  const localePrefix = await getLocalePrefix(
    appDirectory,
    options,
    v2Flags.isV2RouteConvention,
  );
  const typescript = options.typescript ?? !!tsconfigPath;
  const transpilerOptions = typescript
    ? undefined
    : await getJsTranspilerOptions(rootDirectory);

  const routes: GenerateRoutesResult[] = [];
  for (const route of routesArray) {
    routes.push(
      await generateProjectFile(route, {
        ...options,
        typescript,
        localePrefix,
        rootDirectory,
        appDirectory,
        formatOptions,
        transpilerOptions,
        v2Flags,
      }),
    );
  }

  return {
    routes,
    isTypescript: typescript,
    transpilerOptions,
    v2Flags,
    formatOptions,
  };
}

type GenerateProjectFileOptions = {
  typescript?: boolean;
  force?: boolean;
  adapter?: string;
  templatesRoot?: string;
  localePrefix?: string;
  signal?: AbortSignal;
};

async function getLocalePrefix(
  appDirectory: string,
  {localePrefix, routeName}: GenerateRoutesOptions,
  isV2RouteConvention = true,
) {
  if (localePrefix) return localePrefix;
  if (localePrefix !== undefined || routeName === 'all') return;

  const existingFiles = await readdir(joinPath(appDirectory, 'routes')).catch(
    () => [],
  );

  const homeRouteWithLocaleRE = isV2RouteConvention
    ? /^\(\$(\w+)\)\._index.[jt]sx?$/
    : /^\(\$(\w+)\)$/;

  const homeRouteWithLocale = existingFiles.find((file) =>
    homeRouteWithLocaleRE.test(file),
  );

  if (homeRouteWithLocale) {
    return homeRouteWithLocale.match(homeRouteWithLocaleRE)?.[1];
  }
}

export async function generateProjectFile(
  routeFrom: string,
  {
    rootDirectory,
    appDirectory,
    typescript,
    force,
    adapter,
    templatesRoot = getStarterDir(),
    transpilerOptions,
    formatOptions,
    localePrefix,
    v2Flags = {},
    signal,
  }: GenerateProjectFileOptions & {
    rootDirectory: string;
    appDirectory: string;
    transpilerOptions?: TranspilerOptions;
    formatOptions?: FormatOptions;
    v2Flags?: RemixV2Flags;
  },
): Promise<GenerateRoutesResult> {
  const routeTemplatePath = getTemplateAppFile(
    routeFrom + '.tsx',
    templatesRoot,
  );
  const allFilesToGenerate = (
    await findRouteDependencies(
      routeTemplatePath,
      getTemplateAppFile('', templatesRoot),
    )
  ).map((item) =>
    relativePath(joinPath(templatesRoot, GENERATOR_APP_DIR), item),
  );

  const routeDestinationPath = joinPath(
    appDirectory,
    getDestinationRoute(routeFrom, localePrefix, v2Flags) +
      `.${typescript ? 'tsx' : 'jsx'}`,
  );

  const result: GenerateRoutesResult = {
    operation: 'created',
    sourceRoute: routeFrom,
    destinationRoute: relativizePath(routeDestinationPath, rootDirectory),
  };

  if (!force && (await fileExists(routeDestinationPath))) {
    const shouldOverwrite = await renderConfirmationPrompt({
      message: `The file ${result.destinationRoute} already exists. Do you want to replace it?`,
      defaultValue: false,
      confirmationMessage: 'Yes',
      cancellationMessage: 'No',
      abortSignal: signal,
    });

    if (!shouldOverwrite) return {...result, operation: 'skipped'};

    result.operation = 'replaced';
  }

  for (const filePath of allFilesToGenerate) {
    const isRoute = filePath.startsWith(GENERATOR_ROUTE_DIR + '/');
    const destinationPath = isRoute
      ? routeDestinationPath
      : joinPath(
          appDirectory,
          filePath.replace(/\.ts(x?)$/, `.${typescript ? 'ts$1' : 'js$1'}`),
        );

    // Create the directory if it doesn't exist.
    if (!(await fileExists(dirname(destinationPath)))) {
      await mkdir(dirname(destinationPath));
    }

    if (!/\.[jt]sx?$/.test(filePath)) {
      // Nothing to transform for non-JS files.
      await copyFile(
        getTemplateAppFile(filePath, templatesRoot),
        destinationPath,
      );
      continue;
    }

    let templateContent = convertTemplateToRemixVersion(
      await readFile(getTemplateAppFile(filePath, templatesRoot)),
      v2Flags,
    );

    // If the project is not using TS, we need to compile the template to JS.
    if (!typescript) {
      templateContent = transpileFile(templateContent, transpilerOptions);
    }

    // If the command was run with an adapter flag, we replace the default
    // import with the adapter that was passed.
    if (adapter) {
      templateContent = templateContent.replace(
        /@shopify\/remix-oxygen/g,
        adapter,
      );
    }

    // We format the template content with Prettier.
    // TODO use @shopify/cli-kit's format function once it supports TypeScript
    // templateContent = await file.format(templateContent, destinationPath);
    templateContent = formatCode(
      templateContent,
      formatOptions,
      destinationPath,
    );

    // Write the final file to the user's project.
    await writeFile(destinationPath, templateContent);
  }

  return result;
}

function getDestinationRoute(
  routeFrom: string,
  localePrefix: string | undefined,
  v2Flags: RemixV2Flags,
) {
  const routePath = routeFrom.replace(GENERATOR_ROUTE_DIR + '/', '');
  const filePrefix =
    localePrefix && !/\.(txt|xml)/.test(routePath)
      ? `($${localePrefix})` + (v2Flags.isV2RouteConvention ? '.' : '/')
      : '';

  return (
    GENERATOR_ROUTE_DIR +
    '/' +
    filePrefix +
    (v2Flags.isV2RouteConvention ? convertRouteToV2(routePath) : routePath)
  );
}

async function findRouteDependencies(
  routeFilePath: string,
  appDirectory: string,
) {
  const filesToCheck = new Set([routeFilePath]);
  const fileDependencies = new Set([routeFilePath]);

  for (const filePath of filesToCheck) {
    const fileContent = await readFile(filePath, {encoding: 'utf8'});
    const importMatches = fileContent.matchAll(
      /^(import|export)\s+.*?\s+from\s+['"](.*?)['"];?$/gims,
    );

    for (let [, , match] of importMatches) {
      if (match && /^(\.|~)/.test(match)) {
        match = match.replace(
          '~', // import from '~/components/...'
          relativePath(dirname(filePath), appDirectory) || '.',
        );

        const resolvedMatchPath = resolvePath(dirname(filePath), match);
        const absoluteFilepath =
          // Keep file extensions when present. E.g. './app.css'
          (!basename(match).includes('.') &&
            // Resolve common extensions like `.tsx` or `/index.ts`
            (
              await findFileWithExtension(
                dirname(resolvedMatchPath),
                basename(resolvedMatchPath),
              )
            ).filepath) ||
          resolvedMatchPath;

        if (!absoluteFilepath.includes(`/${GENERATOR_ROUTE_DIR}/`)) {
          fileDependencies.add(absoluteFilepath);
          if (/\.[jt]sx?$/.test(absoluteFilepath)) {
            // Check for dependencies in the imported file if it's a TS/JS file.
            filesToCheck.add(absoluteFilepath);
          }
        }
      }
    }
  }

  return [...fileDependencies];
}

async function getJsTranspilerOptions(rootDirectory: string) {
  const jsConfigPath = joinPath(rootDirectory, 'jsconfig.json');
  if (!(await fileExists(jsConfigPath))) return;

  return JSON.parse(
    (await readFile(jsConfigPath, {encoding: 'utf8'})).replace(
      /^\s*\/\/.*$/gm,
      '',
    ),
  )?.compilerOptions as undefined | TranspilerOptions;
}

export async function renderRoutePrompt(options?: {abortSignal: AbortSignal}) {
  const generateAll = await renderConfirmationPrompt({
    message:
      'Scaffold all standard route files? ' + Object.keys(ROUTE_MAP).join(', '),
    confirmationMessage: 'Yes',
    cancellationMessage: 'No',
    ...options,
  });

  return generateAll ? 'all' : ([] as string[]);
}
