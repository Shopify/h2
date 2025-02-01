/// <reference types="vitest" />
import {resolve} from 'path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

export default defineConfig(({mode, isSsrBuild}) => {
  if (mode.includes('umdbuild')) {
    // config for our UMD builds, which are distinct enough that they need their own
    return {
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'hydrogenreact',
          fileName: () =>
            `hydrogen-react.${mode === 'umdbuilddev' ? 'dev' : 'prod'}.js`,
          formats: ['umd'],
        },
        sourcemap: true,
        minify: mode !== 'umdbuilddev',
        emptyOutDir: false,
        outDir: `dist/umd/`,
        rollupOptions: {
          // don't bundle these packages into our lib
          external: ['react', 'react-dom'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
            },
          },
        },
      },
      define: {
        __HYDROGEN_DEV__: mode === 'umdbuilddev',
        __HYDROGEN_TEST__: false,
        'process.env.NODE_ENV':
          mode === 'umdbuilddev' ? '"development"' : '"production"',
      },
      plugins: [
        react({
          // use classic runtime so that it can rely on the global 'React' variable to createElements
          jsxRuntime: 'classic',
        }),
      ],
    };
  }

  return {
    build: {
      outDir: `dist/${isSsrBuild ? 'node' : 'browser'}-${
        mode === 'devbuild' ? 'dev' : 'prod'
      }/`,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'hydrogen-react',
        /**
         * we keep the default to commonjs (and package.json#type to "commonjs")
         * because there are issues when we try to convert to "module"; when we build, there are some files in
         * `/dist/{folder}/node_modules/{packages and files}` that are esm but end in .js, as that's what Vite is configured to do.
         * So the package.json doesn't transfer the settings from this package to the nested node_modules package.
         */
        fileName: (format) => `[name].${format === 'cjs' ? '' : 'm'}js`,
        formats: isSsrBuild ? ['es', 'cjs'] : ['es'],
      },
      sourcemap: true,
      minify: false,
      emptyOutDir: false,
      rollupOptions: {
        external: (id) => {
          /**
            xstate is marked as "not external" because it has import paths that don't work in a pure-esm resolution algo (yet).
            For example, `import {} from '@xstate/react/fsm'` doesn't actually exist in the file path, so we need Vite to process it so it does
            Hypothetically, if they update their package to do so, then we can externalize it at that point.

            Note that this has no effect on the ssr builds; we need to mark xstate as "not external" in 'ssr.noExternal' https://vitejs.dev/config/ssr-options.html#ssr-noexternal
           */
          if (id.includes('xstate')) {
            return false;
          }

          return externals.includes(id);
        },
        output: {
          // keep the folder structure of the components in the dist folder
          preserveModules: true,
          preserveModulesRoot: 'src',
        },
      },
    },
    ssr: {
      // for esm builds, we need Vite to process these deps in order to work correctly
      noExternal: [
        '@xstate',
        '@xstate/react',
        '@xstate/fsm',
        '@xstate/react/fsm',
        'use-sync-external-store',
        'use-isomorphic-layout-effect',
      ],
    },
    define: {
      __HYDROGEN_DEV__: mode === 'devbuild' || mode === 'test',
      __HYDROGEN_TEST__: mode === 'test',
    },
    plugins: [react()],
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: './vitest.setup.ts',
      restoreMocks: true,
    },
  };
});

type PackageJson = {
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
};

const externals = [
  ...Object.keys((packageJson as PackageJson).dependencies),
  ...Object.keys((packageJson as PackageJson).peerDependencies),
  'react/jsx-runtime',
  'worktop/cookie',
];
