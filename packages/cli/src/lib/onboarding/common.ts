import {readdir, symlink} from 'node:fs/promises';
import {
  installNodeModules,
  packageManagerFromUserAgent,
  type PackageManager,
} from '@shopify/cli-kit/node/node-package-manager';
import {
  renderSuccess,
  renderInfo,
  renderSelectPrompt,
  renderTextPrompt,
  renderConfirmationPrompt,
  renderFatalError,
  renderWarning,
} from '@shopify/cli-kit/node/ui';
import {capitalize, hyphenate} from '@shopify/cli-kit/common/string';
import {basename, resolvePath, joinPath} from '@shopify/cli-kit/node/path';
import {
  initializeGitRepository,
  addAllToGitFromDirectory,
  createGitCommit,
} from '@shopify/cli-kit/node/git';
import {AbortError} from '@shopify/cli-kit/node/error';
import {AbortController} from '@shopify/cli-kit/node/abort';
import {
  rmdir,
  fileExists,
  isDirectory,
  writeFile,
  copyFile,
} from '@shopify/cli-kit/node/fs';
import {
  outputDebug,
  formatPackageManagerCommand,
} from '@shopify/cli-kit/node/output';
import {currentProcessIsGlobal} from '@shopify/cli-kit/node/is-global';
import colors from '@shopify/cli-kit/node/colors';
import {type AdminSession, login, renderLoginSuccess} from '../auth.js';
import {
  type I18nStrategy,
  I18N_STRATEGY_NAME_MAP,
  setupI18nStrategy,
  I18nSetupConfig,
  renderI18nPrompt,
  I18nChoice,
} from '../setups/i18n/index.js';
import {titleize} from '../string.js';
import {ALIAS_NAME, createPlatformShortcut, type CliCommand} from '../shell.js';
import {transpileProject} from '../transpile/index.js';
import {
  CSS_STRATEGY_NAME_MAP,
  setupCssStrategy,
  renderCssPrompt,
  type CssStrategy,
  type StylingChoice,
} from '../setups/css/index.js';
import {
  generateProjectFile,
  generateRoutes,
  renderRoutePrompt,
} from '../setups/routes/generate.js';
import {execAsync} from '../process.js';
import {getStorefronts} from '../graphql/admin/link-storefront.js';
import {
  getRepoNodeModules,
  getSkeletonSourceDir,
  isHydrogenMonorepo,
} from '../build.js';
import {enhanceAuthLogs} from '../log.js';

export type InitOptions = {
  path?: string;
  template?: string;
  language?: Language;
  mockShop?: boolean;
  styling?: StylingChoice;
  i18n?: I18nChoice;
  token?: string;
  force?: boolean;
  routes?: boolean;
  shortcut?: boolean;
  installDeps?: boolean;
  git?: boolean;
  quickstart?: boolean;
  packageManager?: PackageManager;
};

export const LANGUAGES = {
  js: 'JavaScript',
  ts: 'TypeScript',
} as const;
type Language = keyof typeof LANGUAGES;

export async function handleI18n(
  controller: AbortController,
  cliCommand: string,
  flagI18n?: I18nChoice,
) {
  let selection =
    flagI18n ??
    (await renderI18nPrompt({
      abortSignal: controller.signal,
      extraChoices: {
        none:
          'Set up later ' + colors.dim(`(run \`${cliCommand} setup markets\`)`),
      },
    }));

  const i18nStrategy = selection === 'none' ? undefined : selection;

  return {
    i18nStrategy,
    setupI18n: async (options: I18nSetupConfig) => {
      if (i18nStrategy) {
        await setupI18nStrategy(i18nStrategy, options);
      }
    },
  };
}

export async function handleRouteGeneration(
  controller: AbortController,
  flagRoutes?: boolean,
) {
  // TODO: Need a multi-select UI component
  const routesToScaffold =
    flagRoutes === true
      ? 'all'
      : flagRoutes === false
      ? []
      : await renderRoutePrompt({
          abortSignal: controller.signal,
        });

  const needsRouteGeneration =
    routesToScaffold === 'all' || routesToScaffold.length > 0;

  return {
    needsRouteGeneration,
    setupRoutes: async (
      directory: string,
      language: Language,
      options?: {i18nStrategy?: I18nStrategy; overwriteFileDeps?: boolean},
    ) => {
      if (needsRouteGeneration) {
        const result = await generateRoutes(
          {
            routeName: routesToScaffold,
            directory,
            force: true,
            typescript: language === 'ts',
            localePrefix:
              options?.i18nStrategy === 'subfolders' ? 'locale' : false,
            signal: controller.signal,
            ...options,
          },
          {
            rootDirectory: directory,
            appDirectory: joinPath(directory, 'app'),
          },
        );

        return result.routeGroups;
      }
    },
  };
}

export function generateProjectEntries(
  options: Parameters<typeof generateProjectFile>[1],
) {
  return Promise.all(
    [
      'routes.ts',
      'layout.tsx',
      'root',
      'entry.server',
      'entry.client',
      '../server.ts',
    ].map((filename) => generateProjectFile(filename, options)),
  );
}

/**
 * Prompts the user to create a global alias (h2) for the Hydrogen CLI.
 * @returns A function that creates the shortcut, or undefined if the user chose not to create a shortcut.
 */
export async function handleCliShortcut(
  controller: AbortController,
  cliCommand: CliCommand,
  flagShortcut?: boolean,
) {
  if (cliCommand === ALIAS_NAME) return {};

  const shouldCreateShortcut =
    flagShortcut ??
    (await renderConfirmationPrompt({
      confirmationMessage: 'Yes',
      cancellationMessage: 'No',
      message: [
        'Create a global',
        {command: ALIAS_NAME},
        'alias to run commands instead of',
        {command: cliCommand},
        '?',
      ],
      abortSignal: controller.signal,
    }));

  if (!shouldCreateShortcut) return {};

  return {
    createShortcut: async () => {
      try {
        const shortcuts = await createPlatformShortcut();
        return shortcuts.length > 0;
      } catch (error: any) {
        // Ignore errors.
        // We'll inform the user to create the
        // shortcut manually in the next step.
        outputDebug(
          'Failed to create shortcut.' +
            (error?.stack ?? error?.message ?? error),
        );

        return false;
      }
    },
    showShortcutBanner: () =>
      renderInfo({
        body: `You'll need to restart your terminal session to make \`${ALIAS_NAME}\` alias available.`,
      }),
  };
}

type StorefrontInfo = {
  id?: string;
  title: string;
  shop: string;
  shopName: string;
  email: string;
  session: AdminSession;
};

/**
 * Prompts the user to link a Hydrogen storefront to their project.
 * @returns The linked shop and storefront.
 */
export async function handleStorefrontLink(
  controller: AbortController,
): Promise<StorefrontInfo> {
  enhanceAuthLogs(true);
  const {session, config} = await login();
  renderLoginSuccess(config);

  const storefronts = await getStorefronts(session);

  let selectedStorefront = await handleStorefrontSelection(storefronts);

  let title;

  if (selectedStorefront) {
    title = selectedStorefront.title;
  } else {
    title = await renderTextPrompt({
      message: 'New storefront name',
      defaultValue: titleize(config.shopName),
      abortSignal: controller.signal,
    });
  }

  return {
    ...config,
    id: selectedStorefront?.id,
    title,
    session,
  };
}

export type HydrogenStorefront = {
  id: string;
  title: string;
  productionUrl: string;
};

export type ParsedHydrogenStorefront = HydrogenStorefront & {parsedId: string};

export async function handleStorefrontSelection(
  storefronts: HydrogenStorefront[],
): Promise<HydrogenStorefront | undefined> {
  const choices = [
    {
      label: 'Create a new storefront',
      value: null,
    },
    ...storefronts.map(({id, title, productionUrl}) => ({
      label: `${title} (${productionUrl})`,
      value: id,
    })),
  ];

  if (choices.length === 1) {
    return;
  }

  const storefrontId = await renderSelectPrompt({
    message: 'Select a Hydrogen storefront to link',
    choices,
  });

  return storefrontId
    ? storefronts.find(({id}) => id === storefrontId)
    : undefined;
}

type Project = {
  location: string;
  name: string;
  directory: string;
  storefrontTitle?: string;
};

/**
 * Prompts the user to select a project directory location.
 * @returns Project information, or undefined if the user chose not to force project creation.
 */
export async function handleProjectLocation({
  storefrontInfo,
  controller,
  force,
  path: flagPath,
}: {
  path?: string;
  force?: boolean;
  controller: AbortController;
  storefrontInfo?: StorefrontInfo;
}): Promise<Project | undefined> {
  const storefrontDirectory = storefrontInfo && hyphenate(storefrontInfo.title);

  let location =
    flagPath ??
    storefrontDirectory ??
    (await renderTextPrompt({
      message: 'Where would you like to create your storefront?',
      defaultValue: 'hydrogen-storefront',
      abortSignal: controller.signal,
    }));

  let directory = resolvePath(process.cwd(), location);

  if (await projectExists(directory)) {
    if (!force && storefrontDirectory) {
      location = await renderTextPrompt({
        message: `There's already a folder called \`${storefrontDirectory}\`. Where do you want to create the app?`,
        defaultValue: storefrontDirectory,
        abortSignal: controller.signal,
      });

      directory = resolvePath(process.cwd(), location);

      if (!(await projectExists(directory))) {
        force = true;
      }
    }

    if (!force) {
      const deleteFiles = await renderConfirmationPrompt({
        message: `The directory ${colors.cyan(
          location,
        )} is not empty. Do you want to delete the existing files and continue?`,
        defaultValue: false,
        abortSignal: controller.signal,
      });

      if (!deleteFiles) {
        renderInfo({
          body: `Destination path ${colors.cyan(
            location,
          )} already exists and is not an empty directory. You may use \`--force\` or \`-f\` to override it.`,
        });

        return;
      }
    }

    await rmdir(directory, {force: true});
  }

  return {
    name: basename(location),
    location, // User input. E.g. "./hydrogen-storefront"
    directory, // Absolute path to location
    storefrontTitle: storefrontInfo?.title,
  };
}

/**
 * Prompts the user to select a JS or TS.
 * @returns A function that optionally transpiles the project to JS, if that was chosen.
 */
export async function handleLanguage(
  projectDir: string,
  controller: AbortController,
  flagLanguage?: Language,
) {
  const language =
    flagLanguage ??
    (await renderSelectPrompt({
      message: 'Select a language',
      choices: [
        {label: 'JavaScript', value: 'js'},
        {label: 'TypeScript', value: 'ts'},
      ],
      defaultValue: 'js',
      abortSignal: controller.signal,
    }));

  return {
    language,
    async transpileProject() {
      if (language !== 'ts') {
        await transpileProject(projectDir);
      }
    },
  };
}

/**
 * Prompts the user to select a CSS strategy.
 * @returns The chosen strategy name and a function that sets up the CSS strategy.
 */
export async function handleCssStrategy(
  projectDir: string,
  controller: AbortController,
  flagStyling?: StylingChoice,
) {
  const selection =
    flagStyling ??
    (await renderCssPrompt({
      abortSignal: controller.signal,
      extraChoices: {none: 'Skip and set up later'},
    }));

  const cssStrategy = selection === 'none' ? undefined : selection;

  return {
    cssStrategy,
    async setupCss() {
      if (cssStrategy) {
        if (cssStrategy === 'postcss' || cssStrategy === 'css-modules') {
          // Nothing to do in Vite projects
          return;
        }

        const result = await setupCssStrategy(
          cssStrategy,
          {
            rootDirectory: projectDir,
            appDirectory: joinPath(projectDir, 'app'), // Default value in new projects
          },
          true,
        );

        if (result) {
          await result.workPromise;
        }
      }
    },
  };
}

/**
 * Prompts the user to choose whether to install dependencies and which package manager to use.
 * It infers the package manager used for creating the project and uses that as the default.
 * @returns The chosen pacakge manager and a function that optionally installs dependencies.
 */
export async function handleDependencies(
  projectDir: string,
  controller: AbortController,
  packageManagerFromFlag?: PackageManager,
  shouldInstallDeps?: boolean,
) {
  const detectedPackageManager =
    packageManagerFromFlag ?? packageManagerFromUserAgent();
  let actualPackageManager: PackageManager = 'npm';

  if (shouldInstallDeps !== false) {
    if (detectedPackageManager === 'unknown') {
      const result = await renderSelectPrompt<'no' | PackageManager>({
        message: `Select package manager to install dependencies`,
        choices: [
          {label: 'NPM', value: 'npm'},
          {label: 'PNPM', value: 'pnpm'},
          {label: 'Yarn v1', value: 'yarn'},
          {label: 'Skip and install later', value: 'no'},
        ],
        defaultValue: 'npm',
        abortSignal: controller.signal,
      });

      if (result === 'no') {
        shouldInstallDeps = false;
      } else {
        actualPackageManager = result;
        shouldInstallDeps = true;
      }
    } else if (shouldInstallDeps === undefined) {
      actualPackageManager = detectedPackageManager;
      shouldInstallDeps = await renderConfirmationPrompt({
        message: `Install dependencies with ${detectedPackageManager}?`,
        confirmationMessage: 'Yes',
        cancellationMessage: 'No',
        abortSignal: controller.signal,
      });
    }
  }

  if (isHydrogenMonorepo) {
    // In Hydrogen monorepo, add `.npmrc` to bypass Shopify registry
    // and symlink `node_modules` to monorepo's node_modules.

    await copyFile(
      joinPath(getSkeletonSourceDir(), '.npmrc'),
      joinPath(projectDir, '.npmrc'),
    ).catch(() => {});

    if (!shouldInstallDeps) {
      await symlink(
        await getRepoNodeModules(),
        joinPath(projectDir, 'node_modules'),
      ).catch(() => {});
    }
  }

  return {
    packageManager: actualPackageManager,
    shouldInstallDeps,
    installDeps: shouldInstallDeps
      ? async () => {
          await installNodeModules({
            directory: projectDir,
            packageManager: actualPackageManager,
            args: [],
            signal: controller.signal,
          });
        }
      : () => {},
  };
}

const gitIgnoreContent = `
node_modules
/.cache
/build
/dist
/public/build
/.mf
.env
.shopify
`.slice(1);

export async function createInitialCommit(directory: string) {
  try {
    await initializeGitRepository(directory);
    await writeFile(joinPath(directory, '.gitignore'), gitIgnoreContent);

    if (process.env.NODE_ENV === 'test' && process.env.CI) {
      // CI environments don't have a git user configured
      await execAsync(`git config --global user.name "hydrogen"`);
      await execAsync(`git config --global user.email "hydrogen@shopify.com"`);
    }

    return commitAll(directory, 'Scaffold Storefront');
  } catch (error: any) {
    // Ignore errors
    outputDebug(
      'Failed to initialize Git.\n' + (error?.stack ?? error?.message ?? error),
    );
  }
}

export async function commitAll(directory: string, message: string) {
  try {
    await addAllToGitFromDirectory(directory);
    await createGitCommit(message, {directory});
  } catch (error: any) {
    // Ignore errors
    outputDebug(
      'Failed to commit code.\n' + (error?.stack ?? error?.message ?? error),
    );
  }
}

export type SetupSummary = {
  language?: Language;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
  cssStrategy?: CssStrategy;
  cliCommand: CliCommand;
  depsInstalled: boolean;
  depsError?: Error;
  i18n?: I18nStrategy;
  i18nError?: Error;
  routes?: Record<string, string | string[]>;
  routesError?: Error;
};

/**
 * Shows a summary success message with next steps.
 */
export async function renderProjectReady(
  project: Project,
  {
    language,
    packageManager,
    depsInstalled,
    cssStrategy,
    cliCommand,
    routes,
    i18n,
    depsError,
    i18nError,
    routesError,
  }: SetupSummary,
) {
  const hasErrors = Boolean(depsError || i18nError || routesError);
  const bodyLines: [string, string][] = [];

  if (project.storefrontTitle) {
    bodyLines.push(['Shopify', project.storefrontTitle]);
  }

  if (language) {
    bodyLines.push(['Language', LANGUAGES[language]]);
  }

  if (cssStrategy) {
    bodyLines.push(['Styling', CSS_STRATEGY_NAME_MAP[cssStrategy]]);
  }

  if (!i18nError && i18n) {
    bodyLines.push(['Markets', I18N_STRATEGY_NAME_MAP[i18n].split(' (')[0]!]);
  }

  let routeSummary = '';

  if (!routesError && routes && Object.keys(routes).length) {
    bodyLines.push(['Routes', '']);

    for (let [routeName, routePaths] of Object.entries(routes)) {
      routePaths = Array.isArray(routePaths) ? routePaths : [routePaths];

      let urls = [
        ...new Set(routePaths.map((item) => '/' + normalizeRoutePath(item))),
      ].sort();

      if (urls.length > 2) {
        // Shorten the summary by grouping them by prefix when there are more than 2
        // e.g. /account/.../... => /account/*
        const prefixesSet = new Set(urls.map((url) => url.split('/')[1] ?? ''));
        urls = [...prefixesSet].map((item) => '/' + item + '/*');
      }

      routeSummary += `\n    • ${capitalize(routeName)} ${colors.dim(
        '(' + urls.join(' & ') + ')',
      )}`;
    }
  }

  const padMin =
    1 + bodyLines.reduce((max, [label]) => Math.max(max, label.length), 0);

  const render = hasErrors ? renderWarning : renderSuccess;

  // Dynamically set "Next steps" for success message
  const nextSteps = [];

  if (true) {
    nextSteps.push(['Dependencies', 'were installed']);
  }

  render({
    headline:
      `Storefront setup complete` +
      (hasErrors ? ' with errors (see warnings below).' : '!'),

    body:
      bodyLines
        .map(
          ([label, value]) =>
            `  ${(label + ':').padEnd(padMin, ' ')}  ${colors.dim(value)}`,
        )
        .join('\n') + routeSummary,

    // Use `customSections` instead of `nextSteps` and `references`
    // here to enforce a newline between title and items.
    customSections: [
      hasErrors && {
        title: 'Warnings\n',
        body: [
          {
            list: {
              items: [
                depsError && [
                  'Failed to install dependencies:',
                  {subdued: depsError.message},
                ],
                i18nError && [
                  'Failed to scaffold Markets:',
                  {subdued: i18nError.message},
                ],
                routesError && [
                  'Failed to scaffold routes:',
                  {subdued: routesError.message},
                ],
              ].filter((step): step is string[] => Boolean(step)),
            },
          },
        ],
      },
      {
        title: 'Next steps\n',
        body: [
          {
            list: {
              items: [
                [
                  'Run',
                  {
                    command: [
                      project.directory === process.cwd()
                        ? undefined
                        : `cd ${project.location.replace(/^\.\//, '')}`,
                      depsInstalled ? undefined : `${packageManager} install`,
                      currentProcessIsGlobal()
                        ? 'npm run dev'
                        : formatPackageManagerCommand(packageManager, 'dev'),
                    ]
                      .filter(Boolean)
                      .join(' && '),
                  },
                ],
              ].filter((step): step is string[] => Boolean(step)),
            },
          },
        ],
      },
    ].filter((step): step is {title: string; body: any} => Boolean(step)),
  });
}

export function createAbortHandler(
  controller: AbortController,
  project?: {directory: string},
) {
  return async function abort(error: AbortError): Promise<never> {
    controller.abort();

    // Give time to hide prompts before showing error
    await Promise.resolve();

    if (project?.directory) {
      await rmdir(project!.directory, {force: true}).catch(() => {});
    }

    renderFatalError(
      new AbortError(
        'Failed to initialize project: ' + (error?.message ?? ''),
        error?.tryMessage ?? error?.stack,
      ),
    );

    if (process.env.SHOPIFY_UNIT_TEST && process.exit.name !== 'spy') {
      // This is not an artificial error for testing, print it and
      // throw an unhandled rejection. Otherwise, the error will be
      // swallowed by the test runner after process.exit is called.
      console.error('Error during test before process.exit:', error);
      throw error;
    }

    // This code runs asynchronously so throwing here
    // turns into an unhandled rejection. Exit process instead:
    process.exit(1);
  };
}

/**
 * @returns Whether the project directory exists and is not empty.
 */
async function projectExists(projectDir: string) {
  return (
    (await fileExists(projectDir)) &&
    (await isDirectory(projectDir)) &&
    (await readdir(projectDir)).length > 0
  );
}

function normalizeRoutePath(routePath: string) {
  return routePath
    .replace(/(^|\.)_index$/, '') // Remove index segments
    .replace(/((^|\.)[^\.]+)_\./g, '$1.') // Replace rootless segments
    .replace(/\.(?!\w+\])/g, '/') // Replace dots with slashes, except for dots in brackets
    .replace(/\$$/g, ':catchAll') // Replace catch-all
    .replace(/\$/g, ':') // Replace dollar signs with colons
    .replace(/[\[\]]/g, '') // Remove brackets
    .replace(/:\w*Handle/i, ':handle'); // Replace arbitrary handle names with a standard `:handle`
}

export function generateRandomName() {
  function getRandomElement(arr: string[]) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  const geographicalFeature = getRandomElement([
    'Bay',
    'Bend',
    'Cape',
    'Cliff',
    'Cove',
    'Creek',
    'Dale',
    'Dune',
    'Fjord',
    'Glade',
    'Gulf',
    'Hill',
    'Isle',
    'Knoll',
    'Lake',
    'Loch',
    'Mesa',
    'Peak',
    'Pond',
    'Quay',
    'Reef',
    'Ridge',
    'Rise',
    'River',
    'Road',
    'Shore',
    'Strait',
    'Stream',
    'Vale',
    'Valley',
    'View',
    'Vista',
  ]);
  const colorNames = getRandomElement([
    'Crimson',
    'Azure',
    'Coral',
    'Fuchsia',
    'Indigo',
    'Ivory',
    'Lavender',
    'Lime',
    'Magenta',
    'Maroon',
    'Orchid',
    'Peach',
    'Plum',
    'Quartz',
    'Salmon',
    'Teal',
    'Turquoise',
    'Violet',
    'Yellow',
    'Ebony',
    'Jade',
    'Lilac',
    'Mint',
    'Onyx',
    'Pearl',
    'Ruby',
    'Sapphire',
    'Topaz',
  ]);
  return `${colorNames} ${geographicalFeature}`;
}
