import {createRequire} from 'node:module';
import path from 'node:path';
import {readdir} from 'node:fs/promises';
import type {ServerMode} from '@remix-run/dev/dist/config/serverModes.js';
import type {RemixConfig, AppConfig} from '@remix-run/dev/dist/config.js';
import {AbortError} from '@shopify/cli-kit/node/error';
import {outputWarn} from '@shopify/cli-kit/node/output';
import {fileExists} from '@shopify/cli-kit/node/fs';
import {muteRemixLogs} from './log.js';
import {REQUIRED_REMIX_VERSION} from './remix-version-check.js';
import {findFileWithExtension} from './file.js';
import {getViteConfig, isViteProject} from './vite-config.js';
import {importLocal} from './import-utils.js';
import {hydrogenPackagesPath, isHydrogenMonorepo} from './build.js';

type RawRemixConfig = AppConfig;

export type {RemixConfig, ServerMode, RawRemixConfig};

export async function hasRemixConfigFile(root: string) {
  const result = await findFileWithExtension(root, 'remix.config');
  return !!result.filepath;
}

export async function isClassicProject(root: string) {
  const isVite = await isViteProject(root);
  if (isVite) return false;

  return hasRemixConfigFile(root);
}

const BUILD_DIR = 'dist'; // Hardcoded in Oxygen
const CLIENT_SUBDIR = 'client';
const WORKER_SUBDIR = 'worker'; // Hardcoded in Oxygen

const oxygenServerMainFields = ['browser', 'module', 'main'];

export function getProjectPaths(appPath?: string) {
  const root = appPath ?? process.cwd();
  const publicPath = path.join(root, 'public');
  const buildPath = path.join(root, BUILD_DIR);
  const buildPathClient = path.join(buildPath, CLIENT_SUBDIR);
  const buildPathWorkerFile = path.join(buildPath, WORKER_SUBDIR, 'index.js');

  return {
    root,
    buildPath,
    buildPathClient,
    buildPathWorkerFile,
    publicPath,
  };
}

export function handleRemixImportFail(): never {
  const remixVersion = REQUIRED_REMIX_VERSION;
  throw new AbortError(
    'Could not load Remix packages.',
    `Please make sure you have \`@remix-run/dev@${remixVersion}\` installed` +
      ` and all the other Remix packages have the same version.`,
  );
}

export function getRawRemixConfig(root: string) {
  return findFileWithExtension(root, 'remix.config').then(({filepath}) => {
    if (!filepath) throw new AbortError('No remix.config.js file found.');
    return createRequire(import.meta.url)(filepath) as RawRemixConfig;
  });
}

export async function getRemixConfig(
  root: string,
  mode = process.env.NODE_ENV as ServerMode,
) {
  if (await isViteProject(root)) {
    return (await getViteConfig(root)).remixConfig;
  }

  await muteRemixLogs(root);

  type RemixConfig = typeof import('@remix-run/dev/dist/config.js');

  const {resolveConfig} = await importLocal<RemixConfig>(
    '@remix-run/dev/dist/config.js',
    root,
  ).catch(handleRemixImportFail);

  type RemixViteNodeConfig =
    typeof import('@remix-run/dev/dist/vite/vite-node.js');

  const {createContext} = await importLocal<RemixViteNodeConfig>(
    '@remix-run/dev/dist/vite/vite-node.js',
    root,
  ).catch(handleRemixImportFail);

  type RemixViteESMConfig =
    typeof import('@remix-run/dev/dist/vite/import-vite-esm-sync.js');

  const {importViteEsmSync} = await importLocal<RemixViteESMConfig>(
    '@remix-run/dev/dist/vite/import-vite-esm-sync.js',
    root,
  ).catch(handleRemixImportFail);

  const appConfig = await getRawRemixConfig(root);
  const routesViteNodeContext = await createContext({root, mode});
  const vite = importViteEsmSync();
  const config = await resolveConfig(appConfig, {
    rootDirectory: root,
    serverMode: mode,
    vite,
    routesViteNodeContext,
  });

  if (isHydrogenMonorepo && hydrogenPackagesPath) {
    // Watch local packages when developing in Hydrogen repo
    const packagesPath = hydrogenPackagesPath;
    config.watchPaths ??= [];

    config.watchPaths.push(
      ...(await readdir(packagesPath)).map((pkg) =>
        pkg === 'hydrogen-react'
          ? path.resolve(packagesPath, pkg, 'dist', 'browser-dev', 'index.mjs')
          : path.resolve(packagesPath, pkg, 'dist', 'development', 'index.js'),
      ),
    );

    config.watchPaths.push(
      path.join(packagesPath, 'cli', 'dist', 'virtual-routes', '**', '*'),
    );
  }

  // Shut this down so that it doesn't cause the process to fail
  // when it finishes running.
  routesViteNodeContext.server.server.close();

  return config;
}

export function assertOxygenChecks(config: RemixConfig) {
  try {
    createRequire(import.meta.url).resolve('@shopify/remix-oxygen');
  } catch {
    return;
  }

  if (!config.serverEntryPoint) {
    throw new AbortError(
      'Could not find a server entry point.',
      'Please add a server option to your remix.config.js pointing to an Oxygen worker entry file.',
    );
  } else {
    assertEntryFileExists(config.rootDirectory, config.serverEntryPoint);
  }

  if (config.serverPlatform !== 'neutral') {
    throw new AbortError(
      'The serverPlatform in remix.config.js must be "neutral".',
    );
  }

  if (config.serverModuleFormat !== 'esm') {
    throw new AbortError(
      'The serverModuleFormat in remix.config.js must be "esm".',
    );
  }

  if (config.serverDependenciesToBundle !== 'all') {
    throw new AbortError(
      'The serverDependenciesToBundle in remix.config.js must be "all".',
    );
  }

  if (!config.serverConditions?.includes('worker')) {
    throw new AbortError(
      'The serverConditions in remix.config.js must include "worker".',
    );
  }

  if (
    process.env.NODE_ENV === 'development' &&
    !config.serverConditions?.includes('development')
  ) {
    outputWarn(
      'Add `process.env.NODE_ENV` value to serverConditions in remix.config.js to enable debugging features in development.',
    );
  }

  if (
    !config.serverMainFields ||
    !oxygenServerMainFields.every((v, i) => config.serverMainFields?.[i] === v)
  ) {
    throw new AbortError(
      `The serverMainFields in remix.config.js must be ${JSON.stringify(
        oxygenServerMainFields,
      )}.`,
    );
  }

  const cdnUrl = process.env.HYDROGEN_ASSET_BASE_URL;
  if (cdnUrl && !config.publicPath.startsWith(cdnUrl)) {
    throw new AbortError(
      'The publicPath in remix.config.js must be prepended with the value of `process.env.HYDROGEN_ASSET_BASE_URL`.',
    );
  }

  const expectedServerBuildPath = path.join(
    BUILD_DIR,
    WORKER_SUBDIR,
    'index.js',
  );
  if (
    config.serverBuildPath !==
    path.resolve(config.rootDirectory, expectedServerBuildPath)
  ) {
    throw new AbortError(
      `The serverBuildPath in remix.config.js must be "${expectedServerBuildPath}".`,
    );
  }

  const expectedAssetsBuildDirectory = path.join(BUILD_DIR, CLIENT_SUBDIR);
  if (
    !config.assetsBuildDirectory.startsWith(
      path.resolve(config.rootDirectory, expectedAssetsBuildDirectory),
    )
  ) {
    throw new AbortError(
      `The assetsBuildDirectory in remix.config.js must be in "${expectedAssetsBuildDirectory}".`,
    );
  }
}

async function assertEntryFileExists(root: string, fileRelative: string) {
  const fileAbsolute = path.resolve(root, fileRelative);
  const exists = await fileExists(fileAbsolute);

  if (!exists) {
    if (!path.extname(fileAbsolute)) {
      const files = await readdir(path.dirname(fileAbsolute));
      const exists = files.some((file) => {
        const {name, ext} = path.parse(file);
        return name === path.basename(fileAbsolute) && /^\.[jt]s$/.test(ext);
      });

      if (exists) return;
    }

    throw new AbortError(
      `Entry file "${fileRelative}" not found.`,
      'Please ensure the file exists and that the path is correctly added to the `server` property in remix.config.js.',
    );
  }
}
