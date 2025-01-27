import path from 'node:path';
import fs from 'node:fs/promises';
import {defineConfig} from 'tsup';

const outDir = 'dist';
const cjsEntryContent = `module.exports = process.env.NODE_ENV === 'development' ? require('./development/index.cjs') : require('./production/index.cjs');`;
const cjsEntryFile = path.resolve(process.cwd(), outDir, 'index.cjs');

const commonConfig = defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  treeshake: true,
  sourcemap: true,
});

export default defineConfig([
  {
    ...commonConfig,
    env: {NODE_ENV: 'development'},
    outDir: path.join(outDir, 'development'),
  },
  {
    ...commonConfig,
    env: {NODE_ENV: 'production'},
    // Bundle types from hydrogen-codgen so that we
    // don't need to add it as a dependency in Hydrogen.
    dts: {resolve: ['@shopify/hydrogen-codegen']},
    outDir: path.join(outDir, 'production'),
    minify: true,
    onSuccess: async () => {
      await fs.writeFile(cjsEntryFile, cjsEntryContent, 'utf-8');

      const hydrogenReact = path.resolve('..', 'hydrogen-react');
      const sfSchemaFile = 'storefront.schema.json';
      const sfTypeFile = 'storefront-api-types.d.ts';

      await fs.copyFile(
        path.resolve(hydrogenReact, sfSchemaFile),
        path.resolve(outDir, sfSchemaFile),
      );
      await fs.copyFile(
        path.resolve(hydrogenReact, 'src', sfTypeFile),
        path.resolve(outDir, sfTypeFile),
      );

      console.log(
        '\n',
        'Storefront API types copied from hydrogen-react',
        '\n',
      );

      const caSchemaFile = 'customer-account.schema.json';
      const caTypeFile = 'customer-account-api-types.d.ts';

      await fs.copyFile(
        path.resolve(hydrogenReact, caSchemaFile),
        path.resolve(outDir, caSchemaFile),
      );
      await fs.copyFile(
        path.resolve(hydrogenReact, 'src', caTypeFile),
        path.resolve(outDir, caTypeFile),
      );

      console.log('\n', 'Customer API types copied from hydrogen-react', '\n');
    },
  },
  {
    entry: [
      'src/vite/**/*.ts',
      '!src/vite/**/*.test.ts',
      '!src/vite/virtual-routes/**/*',
    ],
    outDir: 'dist/vite',
    format: 'esm',
    minify: false,
    bundle: true,
    sourcemap: false,
    dts: true,
  },
  {
    entry: ['src/dev/**/*.ts', '!src/dev/**/*.test.ts'],
    outDir: 'dist/dev',
    format: 'esm',
    minify: false,
    bundle: true,
    sourcemap: false,
    dts: true,
  },
  {
    entry: ['src/vite/virtual-routes/**/*.tsx'],
    outDir: `${outDir}/vite/virtual-routes`,
    outExtension: () => ({js: '.jsx'}),
    format: 'esm',
    minify: false,
    bundle: false,
    splitting: false,
    treeshake: false,
    sourcemap: false,
    publicDir: false,
    dts: false,
    clean: false, // Avoid deleting the assets folder
    async onSuccess() {
      await fs.cp(
        'src/vite/virtual-routes/assets',
        `${outDir}/vite/virtual-routes/assets`,
        {recursive: true},
      );

      console.log('\n', 'Copied virtual route assets to build directory', '\n');
    },
  },
]);
