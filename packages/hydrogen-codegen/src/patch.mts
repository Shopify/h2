import path from 'node:path';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

/**
 * Patch graphql-tag-pluck to allow it to work with `#graphql` comment and other features.
 */
const require = createRequire(import.meta.url);
const realGqlTagPluck = require.resolve('@graphql-tools/graphql-tag-pluck');
// During tests, this file is in src/xyz.ts but in dev/prod,
// the file is in dist/(esm|cjs)/xyz.js
const depth = path.extname(import.meta.url) === '.mts' ? '../' : '../../';
const vendorGqlTagPluck = fileURLToPath(
  new URL(depth + '/vendor/graphql-tag-pluck', import.meta.url),
);

// Copy files sequencially to avoid `EBUSY` errors in Windows
await fs.copyFile(
  path.join(vendorGqlTagPluck, 'visitor.cjs'),
  realGqlTagPluck.replace(/index\.js$/, 'visitor.js'),
);

await fs.copyFile(
  path.join(vendorGqlTagPluck, 'visitor.mjs'),
  realGqlTagPluck.replace('cjs', 'esm').replace(/index\.js$/, 'visitor.js'),
);

/**
 * Temporary patch for a bug in another package
 * https://github.com/dotansimha/graphql-code-generator/pull/9709
 */
const visitorPluginCommon = require.resolve(
  '@graphql-codegen/visitor-plugin-common',
);
const selectionSetToObjectFileCJS = visitorPluginCommon.replace(
  'index.js',
  'selection-set-to-object.js',
);
const selectionSetToObjectFileESM = selectionSetToObjectFileCJS.replace(
  'cjs',
  'esm',
);

await fs.writeFile(
  selectionSetToObjectFileCJS,
  patchSelectionSet(await fs.readFile(selectionSetToObjectFileCJS, 'utf-8')),
  'utf-8',
);

await fs.writeFile(
  selectionSetToObjectFileESM,
  patchSelectionSet(await fs.readFile(selectionSetToObjectFileESM, 'utf-8')),
  'utf-8',
);

function patchSelectionSet(content: string) {
  return content.replace('&& s.union', '&& s?.union');
}
