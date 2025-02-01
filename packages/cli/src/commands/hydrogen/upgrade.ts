import {createRequire} from 'node:module';
import semver from 'semver';
import cliTruncate from 'cli-truncate';
import {Flags} from '@oclif/core';
import {isClean, ensureInsideGitDirectory} from '@shopify/cli-kit/node/git';
import Command from '@shopify/cli-kit/node/base-command';
import {
  renderConfirmationPrompt,
  renderInfo,
  renderSelectPrompt,
  renderSuccess,
  renderTasks,
  renderWarning,
} from '@shopify/cli-kit/node/ui';
import {
  fileExists,
  isDirectory,
  mkdir,
  removeFile,
  touchFile,
  writeFile,
  readFile,
} from '@shopify/cli-kit/node/fs';
import {
  getDependencies,
  installNodeModules,
  getPackageManager,
  type PackageJson,
} from '@shopify/cli-kit/node/node-package-manager';
import {AbortError} from '@shopify/cli-kit/node/error';
import {dirname, joinPath, resolvePath} from '@shopify/cli-kit/node/path';
import {getCliCommand} from '../../lib/shell.js';
import {commonFlags, flagsToCamelObject} from '../../lib/flags.js';
import {getProjectPaths} from '../../lib/remix-config.js';
import {hydrogenPackagesPath, isHydrogenMonorepo} from '../../lib/build.js';

type ReleaseItem = {
  breaking?: boolean;
  docs?: string;
  id: string | null;
  info?: string;
  pr: `https://${string}` | null;
  title: string;
  steps?: Array<{
    code: string;
    file?: string;
    info?: string;
    reel?: string;
    title: string;
  }>;
};

export type Release = {
  commit: `https://${string}`;
  date: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  dependenciesMeta?: Record<string, {required: boolean}>;
  features: Array<ReleaseItem>;
  fixes: Array<ReleaseItem>;
  hash: string;
  pr: `https://${string}`;
  title: string;
  version: string;
};

type ChangeLog = {
  url: string;
  releases: Array<Release>;
  version: string;
};

export type CumulativeRelease = {
  features: Array<ReleaseItem>;
  fixes: Array<ReleaseItem>;
};

const INSTRUCTIONS_FOLDER = '.hydrogen';

export default class Upgrade extends Command {
  static descriptionWithMarkdown =
    'Upgrade Hydrogen project dependencies, preview features, fixes and breaking changes. The command also generates an instruction file for each upgrade.';

  static description = 'Upgrade Remix and Hydrogen npm dependencies.';

  static flags = {
    ...commonFlags.path,
    version: Flags.string({
      description: 'A target hydrogen version to update to',
      required: false,
      char: 'v',
    }),
    force: Flags.boolean({
      description:
        'Ignore warnings and force the upgrade to the target version',
      env: 'SHOPIFY_HYDROGEN_FLAG_FORCE',
      char: 'f',
    }),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(Upgrade);

    await runUpgrade({
      ...flagsToCamelObject(flags),
      appPath: flags.path ? resolvePath(flags.path) : process.cwd(),
    });
  }
}

let CACHED_CHANGELOG: ChangeLog | null = null;

type UpgradeOptions = {
  appPath: string;
  version?: string;
  force?: boolean;
};

export async function runUpgrade({
  appPath,
  version: targetVersion,
  force,
}: UpgradeOptions) {
  if (!force) {
    await checkIsGitRepo(appPath);

    await checkDirtyGitBranch(appPath);
  }

  const {currentVersion, currentDependencies} = await getHydrogenVersion({
    appPath,
  });

  const isPrerelease = semver.prerelease(currentVersion);

  if (isPrerelease) {
    throw new AbortError(
      'The upgrade command cannot be run over a prerelease Hydrogen version',
    );
  }

  const changelog = await getChangelog();

  const {availableUpgrades} = getAvailableUpgrades({
    releases: changelog.releases,
    currentVersion,
    currentDependencies,
  });

  if (!availableUpgrades?.length) {
    renderSuccess({
      headline: `You are on the latest Hydrogen version: ${getAbsoluteVersion(
        currentVersion,
      )}`,
    });

    return;
  }

  let confirmed = false;
  let selectedRelease: Release | undefined = undefined;
  let cumulativeRelease: CumulativeRelease | undefined = undefined;

  do {
    // Prompt the user to select a version from the list of available upgrades
    selectedRelease = await getSelectedRelease({
      currentVersion,
      targetVersion,
      availableUpgrades,
    });

    // Get an aggregate list of features and fixes included in the upgrade versions range
    cumulativeRelease = getCummulativeRelease({
      availableUpgrades,
      currentVersion,
      currentDependencies,
      selectedRelease,
    });

    confirmed = await displayConfirmation({
      cumulativeRelease,
      selectedRelease,
    });
  } while (!confirmed);

  // Generate a markdown file with upgrade instructions
  const instrunctionsFilePathPromise = generateUpgradeInstructionsFile({
    appPath,
    cumulativeRelease,
    currentVersion,
    selectedRelease,
  });

  await upgradeNodeModules({appPath, selectedRelease, currentDependencies});
  await validateUpgrade({
    appPath,
    selectedRelease,
  });

  const instrunctionsFilePath = await instrunctionsFilePathPromise;

  // Display a summary of the upgrade and next steps
  await displayUpgradeSummary({
    appPath,
    currentVersion,
    instrunctionsFilePath,
    selectedRelease,
  });
}

/**
 * Checks if the target folder is a git repo and throws an error if it's not
 */
function checkIsGitRepo(appPath: string) {
  return ensureInsideGitDirectory(appPath).catch(() => {
    throw new AbortError(
      'The upgrade command can only be run on a git repository',
      `Please run the command inside a git repository or run 'git init' to create one`,
    );
  });
}

/**
 * Checks if the current git branch is clean and throws an error if it's not
 */
async function checkDirtyGitBranch(appPath: string) {
  if (!(await isClean(appPath))) {
    throw new AbortError(
      'The upgrade command can only be run on a clean git branch',
      'Please commit your changes or re-run the command on a clean branch',
    );
  }
}

/**
 * Gets the current @shopify/hydrogen version from the app's package.json
 */
export async function getHydrogenVersion({appPath}: {appPath: string}) {
  const {root} = getProjectPaths(appPath);
  const packageJsonPath = joinPath(root, 'package.json');

  let packageJson: PackageJson | undefined;

  try {
    packageJson = JSON.parse(await readFile(packageJsonPath));
  } catch {
    throw new AbortError(
      'Could not find a valid package.json',
      'Please make sure you are running the command in a npm project',
    );
  }

  const currentDependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
  };

  const currentVersion = currentDependencies['@shopify/hydrogen'];

  if (!currentVersion) {
    throw new AbortError(
      'Could not find a valid Hydrogen version in package.json',
      'Please make sure you are running the command in a Hydrogen project',
    );
  }

  return {currentVersion, currentDependencies};
}

/**
 * Fetches the changelog.json file from the Hydrogen repo
 */
export async function getChangelog(): Promise<ChangeLog> {
  if (CACHED_CHANGELOG) return CACHED_CHANGELOG;

  // For local testing
  if (
    isHydrogenMonorepo &&
    hydrogenPackagesPath &&
    process.env.FORCE_CHANGELOG_SOURCE !== 'remote'
  ) {
    const require = createRequire(import.meta.url);
    return require(joinPath(
      dirname(hydrogenPackagesPath),
      'docs',
      'changelog.json',
    )) as ChangeLog;
  }

  try {
    const response = await fetch('https://hydrogen.shopify.dev/changelog.json');

    if (!response.ok) {
      throw new Error('Failed to fetch changelog.json');
    }

    const json: ChangeLog = await response.json();

    if ('releases' in json && 'url' in json) {
      CACHED_CHANGELOG = json;
      return CACHED_CHANGELOG;
    }
  } catch {}

  throw new AbortError(
    'Failed to fetch Hydrogen changelog',
    'Ensure you have internet connection and try again',
  );
}

function hasOutdatedDependencies({
  release,
  currentDependencies,
}: {
  release: Release;
  currentDependencies: Record<string, string>;
}) {
  return Object.entries({
    ...release.dependencies,
    ...release.devDependencies,
  }).some(([name, version]) => {
    // Skip checking the bundled CLI for now because it's always outdated.
    // (we release a new version of the CLI after every Hydrogen release)
    if (name === '@shopify/cli') return false;

    const currentDependencyVersion = currentDependencies?.[name];
    if (!currentDependencyVersion) return false;

    const isDependencyOutdated = semver.gt(
      getAbsoluteVersion(version),
      getAbsoluteVersion(currentDependencyVersion),
    );

    return isDependencyOutdated;
  });
}

function isUpgradeableRelease({
  currentDependencies,
  currentPinnedVersion,
  release,
}: {
  currentDependencies: Record<string, string>;
  currentPinnedVersion: string;
  release: Release;
}) {
  const isHydrogenOutdated = semver.gt(release.version, currentPinnedVersion);

  if (isHydrogenOutdated) return true;

  // check if any of the other dependencies of the selected release are outdated
  const isCurrentHydrogen =
    getAbsoluteVersion(release.version) === currentPinnedVersion;

  if (!isCurrentHydrogen) return false;

  return hasOutdatedDependencies({release, currentDependencies});
}

/**
 * Gets the list of available upgrades based on the current version
 */
export function getAvailableUpgrades({
  releases,
  currentVersion,
  currentDependencies,
}: {
  releases: ChangeLog['releases'];
  currentVersion: string;
  currentDependencies: Record<string, string>;
}) {
  const currentPinnedVersion = getAbsoluteVersion(currentVersion);
  let currentMajorVersion = '';

  const availableUpgrades = releases.filter((release) => {
    const isUpgradeable = isUpgradeableRelease({
      release,
      currentPinnedVersion,
      currentDependencies,
    });

    if (!isUpgradeable) return false;

    if (currentMajorVersion !== release.version) {
      currentMajorVersion = release.version;
      return true;
    }

    return false;
  }) as Array<Release>;

  const uniqueAvailableUpgrades = availableUpgrades.reduce((acc, release) => {
    if (acc[release.version]) return acc;
    acc[release.version] = release;
    return acc;
  }, {} as Record<string, Release>);

  return {availableUpgrades, uniqueAvailableUpgrades};
}

/**
 * Gets the selected release based on the --version flag or the user's prompt selection
 */
export async function getSelectedRelease({
  targetVersion,
  availableUpgrades,
  currentVersion,
}: {
  targetVersion?: string;
  availableUpgrades: Array<Release>;
  currentVersion: string;
}) {
  const targetRelease = targetVersion
    ? availableUpgrades.find(
        (release) =>
          getAbsoluteVersion(release.version) ===
          getAbsoluteVersion(targetVersion),
      )
    : undefined;

  return (
    targetRelease ?? promptUpgradeOptions(currentVersion, availableUpgrades)
  );
}

/**
 * Gets an aggregate list of features and fixes included in the upgrade versions range
 */
export function getCummulativeRelease({
  availableUpgrades,
  selectedRelease,
  currentVersion,
  currentDependencies,
}: {
  availableUpgrades: Array<Release>;
  selectedRelease: Release;
  currentVersion: string;
  currentDependencies?: Record<string, string>;
}): CumulativeRelease {
  const currentPinnedVersion = getAbsoluteVersion(currentVersion);

  if (!availableUpgrades?.length) {
    return {features: [], fixes: []};
  }

  const upgradingReleases = availableUpgrades.filter((release) => {
    const isHydrogenUpgrade =
      semver.gt(release.version, currentPinnedVersion) &&
      semver.lte(release.version, selectedRelease.version);

    if (isHydrogenUpgrade) return true;

    const isSameHydrogenVersion =
      getAbsoluteVersion(release.version) === currentPinnedVersion;

    if (!isSameHydrogenVersion || !currentDependencies) return false;

    return hasOutdatedDependencies({release, currentDependencies});
  });

  return upgradingReleases.reduce(
    (acc, release) => {
      acc.features = [...acc.features, ...release.features];
      acc.fixes = [...acc.fixes, ...release.fixes];
      return acc;
    },
    {features: [], fixes: []} as CumulativeRelease,
  );
}

/**
 * Displays a confirmation prompt to the user with a list of features and fixes
 * included in the upgrade versions range. The user can also return to the
 * version selection prompt if they want to choose a different version.
 **/
export function displayConfirmation({
  cumulativeRelease,
  selectedRelease,
}: {
  cumulativeRelease: CumulativeRelease;
  selectedRelease: Release;
}) {
  const {features, fixes} = cumulativeRelease;
  if (features.length || fixes.length) {
    renderInfo({
      headline: `Included in this upgrade:`,
      //@ts-ignore we know that filter(Boolean) will always return an array
      customSections: [
        features.length && {
          title: 'Features',
          body: [
            {
              list: {
                items: features.map((item) => item.title),
              },
            },
          ],
        },
        fixes.length && {
          title: 'Fixes',
          body: [
            {
              list: {
                items: fixes.map((item) => item.title),
              },
            },
          ],
        },
      ].filter(Boolean),
    });
  }

  return renderConfirmationPrompt({
    message: `Are you sure you want to upgrade to ${selectedRelease.version}?`,
    cancellationMessage: `No, choose another version`,
    defaultValue: true,
  });
}

function isRemixDependency([name]: [string, string]) {
  if (name.includes('@remix-run')) {
    return true;
  }
  return false;
}

/**
 * Checks if a dependency should be included in the upgrade command
 */
function maybeIncludeDependency({
  currentDependencies,
  dependency: [name, version],
  selectedRelease,
}: {
  dependency: [string, string];
  currentDependencies: Record<string, string>;
  selectedRelease: Release;
}) {
  const existingDependencyVersion = currentDependencies[name];

  const isRemixPackage = isRemixDependency([name, version]);

  // Remix dependencies are handled later
  if (isRemixPackage) return false;

  const isNextVersion = existingDependencyVersion === 'next';

  if (isNextVersion) return false;

  // Handle required/conditional dependenciesMeta deps
  const depMeta = selectedRelease.dependenciesMeta?.[name];

  if (!depMeta) return true;

  const isRequired = Boolean(
    selectedRelease.dependenciesMeta?.[name]?.required,
  );

  if (!isRequired) return false;

  // Dep meta is required...
  if (!existingDependencyVersion) return true;

  const isOlderVersion = semver.lt(
    getAbsoluteVersion(existingDependencyVersion),
    getAbsoluteVersion(version),
  );

  if (isOlderVersion) return true;

  return false;
}

/**
 * Builds the arguments for the `npm|yarn|pnpm install` command
 */
export function buildUpgradeCommandArgs({
  selectedRelease,
  currentDependencies,
}: {
  selectedRelease: Release;
  currentDependencies: Record<string, string>;
}) {
  const args: string[] = [];

  // upgrade dependencies
  for (const dependency of Object.entries(selectedRelease.dependencies)) {
    const shouldUpgradeDep = maybeIncludeDependency({
      currentDependencies,
      dependency,
      selectedRelease,
    });
    if (!shouldUpgradeDep) continue;
    args.push(`${dependency[0]}@${getAbsoluteVersion(dependency[1])}`);
  }

  // upgrade devDependencies
  for (const dependency of Object.entries(selectedRelease.devDependencies)) {
    const shouldUpgradeDep = maybeIncludeDependency({
      currentDependencies,
      dependency,
      selectedRelease,
    });
    if (!shouldUpgradeDep) continue;
    args.push(`${dependency[0]}@${getAbsoluteVersion(dependency[1])}`);
  }

  // Maybe upgrade Remix dependencies
  const currentRemix =
    Object.entries(currentDependencies).find(isRemixDependency);
  const selectedRemix = Object.entries(selectedRelease.dependencies).find(
    isRemixDependency,
  );

  if (currentRemix && selectedRemix) {
    const shouldUpgradeRemix = semver.lt(
      getAbsoluteVersion(currentRemix[1]),
      getAbsoluteVersion(selectedRemix[1]),
    );

    if (shouldUpgradeRemix) {
      args.push(
        ...appendRemixDependencies({currentDependencies, selectedRemix}),
      );
    }
  }

  return args;
}

/**
 * Installs the new Hydrogen dependencies
 */
export async function upgradeNodeModules({
  appPath,
  selectedRelease,
  currentDependencies,
}: {
  appPath: string;
  selectedRelease: Release;
  currentDependencies: Record<string, string>;
}) {
  await renderTasks(
    [
      {
        title: `Upgrading dependencies`,
        task: async () => {
          await installNodeModules({
            directory: appPath,
            packageManager: await getPackageManager(appPath),
            args: buildUpgradeCommandArgs({
              selectedRelease,
              currentDependencies,
            }),
          });
        },
      },
    ],
    {},
  );
}

/**
 * Appends the current @remix-run dependencies to the upgrade command
 */
function appendRemixDependencies({
  currentDependencies,
  selectedRemix,
}: {
  currentDependencies: Record<string, string>;
  selectedRemix: [string, string];
}) {
  const command: string[] = [];
  for (const [name, version] of Object.entries(currentDependencies)) {
    const isRemixPackage = isRemixDependency([name, version]);
    if (!isRemixPackage) {
      continue;
    }
    command.push(`${name}@${getAbsoluteVersion(selectedRemix[1])}`);
  }
  return command;
}

/**
 * Gets the absolute version from a pinned or unpinned version
 */
export function getAbsoluteVersion(version: string) {
  const result = semver.minVersion(version);
  if (!result) {
    throw new AbortError(`Invalid version: ${version}`);
  }
  return result.version;
}

/**
 * Prompts the user to select a version from the list of available upgrades
 */
async function promptUpgradeOptions(
  currentVersion: string,
  availableUpgrades: Release[],
) {
  if (!availableUpgrades?.length) {
    throw new AbortError('No upgrade options available');
  }

  // Build the list of upgrade options to display to the user
  const choices = availableUpgrades.map((release, index) => {
    const {version, title} = release;

    const tag =
      index === 0
        ? '(latest)'
        : semver.patch(version) === 0
        ? '(major)'
        : getAbsoluteVersion(currentVersion) === getAbsoluteVersion(version)
        ? '(outdated)'
        : '';

    // TODO: add group sorting function to cli-kit select prompt
    // so that we can group by major version
    const majorVersion = `${semver.major(version)}.${semver.minor(version)}`;

    return {
      // group: majorVersion,
      label: `${version} ${tag} - ${cliTruncate(title, 54)}`,
      value: release,
    };
  });

  return renderSelectPrompt({
    message: `Available Hydrogen versions (current: ${currentVersion})`,
    choices,
    defaultValue: choices[0]?.value, // Latest version
  });
}

/**
 * Displays a summary of the upgrade and next steps
 */
async function displayUpgradeSummary({
  appPath,
  currentVersion,
  selectedRelease,
  instrunctionsFilePath,
}: {
  appPath: string;
  currentVersion: string;
  selectedRelease: Release;
  instrunctionsFilePath?: string;
}) {
  const updatedDependenciesList = [
    ...Object.entries(selectedRelease.dependencies || {}).map(
      ([name, version]) => `${name}@${version}`,
    ),
    ...Object.entries(selectedRelease.devDependencies || {}).map(
      ([name, version]) => `${name}@${version}`,
    ),
  ];

  let nextSteps = [];

  if (typeof instrunctionsFilePath === 'string') {
    let instructions = `Upgrade instructions created at:\nfile://${instrunctionsFilePath}`;
    nextSteps.push(instructions);
  }

  const releaseNotesUrl = `https://hydrogen.shopify.dev/releases/${selectedRelease.version}`;

  nextSteps.push(`Release notes:\n${releaseNotesUrl}`);

  const currentPinnedVersion = getAbsoluteVersion(currentVersion);
  const selectedPinnedVersion = getAbsoluteVersion(selectedRelease.version);

  const upgradedDependenciesOnly =
    currentPinnedVersion === selectedPinnedVersion;

  const fromToMsg = `${currentPinnedVersion} → ${selectedPinnedVersion}`;

  const headline = upgradedDependenciesOnly
    ? `You've upgraded Hydrogen ${selectedPinnedVersion} dependencies`
    : `You've upgraded from ${fromToMsg}`;

  const packageManager = await getPackageManager(appPath);

  return renderSuccess({
    headline,
    // @ts-ignore we know that filter(Boolean) will always return an array
    customSections: [
      {
        title: 'Updated dependencies',
        body: [
          {
            list: {
              items: updatedDependenciesList,
            },
          },
        ],
      },
      {
        title: 'What’s next?',
        body: [
          {
            list: {
              items: nextSteps,
            },
          },
        ],
      },
      {
        title: 'Undo these upgrades?',
        body: [
          {
            list: {
              items: [
                `Run \`git restore . && git clean -df && ${packageManager} i\``,
              ],
            },
          },
        ],
      },
    ].filter(Boolean),
  });
}

/**
 * Validate if a h2 upgrade was successful by comparing the previous and current
 * @shopify/hydrogen versions
 */
async function validateUpgrade({
  appPath,
  selectedRelease,
}: {
  appPath: string;
  selectedRelease: Release;
}) {
  const dependencies = await getDependencies(joinPath(appPath, 'package.json'));

  const updatedVersion = dependencies['@shopify/hydrogen'];

  if (!updatedVersion) {
    throw new AbortError('Hydrogen version not found in package.json');
  }

  const updatedPinnedVersion = getAbsoluteVersion(updatedVersion);

  if (updatedPinnedVersion !== selectedRelease.version) {
    throw new AbortError(
      `Failed to upgrade to Hydrogen version ${selectedRelease.version}`,
      `You are still on version ${updatedPinnedVersion}`,
    );
  }
}

/**
 * Generates markdown for a release item
 */
function generateStepMd(item: ReleaseItem) {
  const {steps} = item;
  const heading = `### ${item.title} [#${item.id}](${item.pr})\n`;
  const body = steps
    ?.map((step, stepIndex) => {
      const pr = item.pr ? `[#${item.id}](${item.pr})\n` : '';
      const multiStep = steps.length > 1;
      const title = multiStep
        ? `#### Step: ${stepIndex + 1}. ${step.title} ${pr}\n`
        : `#### ${step.title.trim()}\n`;
      const info = step.info ? `> ${step.info}\n` : '';
      const code = step.code ? `${Buffer.from(step.code, 'base64')}\n` : '';
      const docs = item.docs ? `[docs](${item.docs})\n` : '';
      return `${title}${info}${docs}${pr}${code}`;
    })
    .join('\n');
  return `${heading}\n${body}`;
}

/**
 * Generates a markdown file with upgrade instructions
 */
async function generateUpgradeInstructionsFile({
  appPath,
  cumulativeRelease,
  currentVersion,
  selectedRelease,
}: {
  appPath: string;
  cumulativeRelease: CumulativeRelease;
  currentVersion: string;
  selectedRelease: Release;
}) {
  let filename = '';

  const {featuresMd, breakingChangesMd} = cumulativeRelease.features
    .filter((feature) => feature.steps)
    .reduce(
      (acc, feature) => {
        if (feature.breaking) {
          acc.breakingChangesMd.push(generateStepMd(feature));
        } else {
          acc.featuresMd.push(generateStepMd(feature));
        }
        return acc;
      },
      {featuresMd: [], breakingChangesMd: []} as {
        featuresMd: string[];
        breakingChangesMd: string[];
      },
    );

  const fixesMd = cumulativeRelease.fixes
    .filter((fixes) => fixes.steps)
    .map(generateStepMd);

  if (!featuresMd.length && !fixesMd.length) {
    renderInfo({
      headline: `No upgrade instructions generated`,
      body: `There are no additional upgrade instructions for this version.`,
    });
    return;
  }

  const absoluteFrom = getAbsoluteVersion(currentVersion);
  const absoluteTo = getAbsoluteVersion(selectedRelease.version);
  filename = `upgrade-${absoluteFrom}-to-${absoluteTo}.md`;

  const instructionsFolderPath = joinPath(appPath, INSTRUCTIONS_FOLDER);

  const h1 = `# Hydrogen upgrade guide: ${absoluteFrom} to ${absoluteTo}`;

  let md = `${h1}\n\n----\n`;

  if (breakingChangesMd.length) {
    md += `\n## Breaking changes\n\n${breakingChangesMd.join('\n')}\n----\n`;
  }

  if (featuresMd.length) {
    md += `\n## Features\n\n${featuresMd.join('\n')}\n----\n`;
  }

  if (fixesMd.length) {
    md += `\n${featuresMd.length ? '----\n\n' : ''}## Fixes\n\n${fixesMd.join(
      '\n',
    )}`;
  }

  const filePath = joinPath(instructionsFolderPath, filename);

  try {
    await isDirectory(instructionsFolderPath);
  } catch (error) {
    await mkdir(instructionsFolderPath);
  }

  if (!(await fileExists(filePath))) {
    await touchFile(filePath);
  } else {
    const overwriteMdFile = await renderConfirmationPrompt({
      message: `A previous upgrade instructions file already exists for this version.\nDo you want to overwrite it?`,
      defaultValue: false,
    });

    if (overwriteMdFile) {
      await removeFile(`${filePath}.old`);
    } else {
      return;
    }
    await touchFile(filePath);
  }

  await writeFile(filePath, md);

  return `${INSTRUCTIONS_FOLDER}/${filename}`;
}

/**
 * Displays a notice to the user if there are new Hydrogen versions available
 * This function is executed by the `dev` command
 */
export async function displayDevUpgradeNotice({
  targetPath,
}: {
  targetPath?: string;
}) {
  try {
    const appPath = targetPath ? resolvePath(targetPath) : process.cwd();
    const {currentVersion, currentDependencies} = await getHydrogenVersion({
      appPath,
    });

    const isPrerelease = semver.prerelease(currentVersion);

    if (isPrerelease || /^[a-z]+$/i.test(currentVersion)) {
      // Skip prereleases or versions like 'next' or 'latest'
      return;
    }

    const changelog = await getChangelog();

    const {availableUpgrades, uniqueAvailableUpgrades} = getAvailableUpgrades({
      releases: changelog.releases,
      currentVersion,
      currentDependencies,
    });

    if (availableUpgrades.length === 0 || !availableUpgrades[0]?.version) {
      // Using latest version already or changelog fetch errored
      return;
    }

    const pinnedLatestVersion = getAbsoluteVersion(
      availableUpgrades[0].version,
    );
    const pinnedCurrentVersion = getAbsoluteVersion(currentVersion);

    // If we are on the latest Hydrogen package version and we are still running
    // this code, it means there's an outdated dependency. Use the first
    // outdated version as the current release index to show the upgrade info:
    const isLatestHydrogenPackage =
      pinnedCurrentVersion === pinnedLatestVersion;
    const currentReleaseIndex = isLatestHydrogenPackage
      ? changelog.releases.findIndex(
          (release) =>
            getAbsoluteVersion(release.version) !== pinnedCurrentVersion,
        )
      : changelog.releases.findIndex(
          (release) =>
            getAbsoluteVersion(release.version) === pinnedCurrentVersion,
        );

    const relevantReleases = changelog.releases.slice(0, currentReleaseIndex);

    // By reversing the releases array, we give priority to older releases
    // for the same version. Older releases (the first one of a version) probably
    // have more information than a newer release that only changes dependencies.
    const nextReleases = Object.values(
      [...relevantReleases].reverse().reduce((acc, release) => {
        acc[release.version] ??= `${release.version} - ${release.title}`;
        return acc;
      }, {} as Record<string, string>),
    ).slice(0, 5);

    let headline =
      Object.keys(uniqueAvailableUpgrades).length > 1
        ? `There are ${
            Object.keys(uniqueAvailableUpgrades).length
          } new @shopify/hydrogen versions available.`
        : `There's a new @shopify/hydrogen version available.`;

    const cliCommand = await getCliCommand();

    renderInfo({
      headline,
      body: [
        `Current: ${currentVersion} | Latest: ${pinnedLatestVersion}` +
          (isLatestHydrogenPackage ? ' with updated dependencies' : ''),
      ],
      customSections: [
        ...(nextReleases.length > 0
          ? [
              {
                title: `The next ${nextReleases.length} version(s) include`,
                body: [
                  {
                    list: {
                      items: [
                        ...nextReleases,
                        availableUpgrades.length > 5 ? `...more` : '',
                      ]
                        .flat()
                        .filter(Boolean),
                    },
                  },
                ].filter(Boolean),
              },
            ]
          : []),
        {
          title: 'Next steps',
          body: [
            {
              list: {
                items: [
                  `Run \`${cliCommand} upgrade\` or \`${cliCommand} upgrade --version ${
                    relevantReleases[0]?.version ?? '<version>'
                  }\``,
                  `Read release notes at https://hydrogen.shopify.dev/releases`,
                ],
              },
            },
          ],
        },
      ],
    });
  } catch (error) {
    const abortError = error as AbortError;
    renderWarning({
      headline: abortError.message,
      body: abortError.tryMessage ?? undefined,
    });
  }
}
