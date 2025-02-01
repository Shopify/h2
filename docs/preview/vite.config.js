import path from 'node:path';
import {defineConfig} from 'vite';
import {vitePlugin as remix} from '@remix-run/dev';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

const {INIT_CWD, GEN_DOCS_PATH} = process.env;

if (!GEN_DOCS_PATH && INIT_CWD === process.env.PWD) {
  const message =
    '\n\nRun this utility from a directory that contains a generated docs folder,\n' +
    'or set the `GEN_DOCS_PATH` environment variable to the path of the generated docs folder.\n\n';
  const error = new Error(message);
  error.stack = '';
  throw error;
}

export default defineConfig({
  plugins: [
    remix({
      ignoredRouteFiles: ['**/.*'],
      future: {
        v3_fetcherPersist: false,
        v3_relativeSplatPath: false,
        v3_throwAbortReason: false,
        v3_singleFetch: true,
      },
    }),
    tsconfigPaths(),
    tailwindcss(),
    {
      name: 'docs:preview',
      resolveId(id) {
        if (id.startsWith('virtual:docs.json')) {
          return {
            id:
              GEN_DOCS_PATH ??
              path.join(INIT_CWD, 'docs/generated/generated_docs_data.json'),
          };
        }
      },
    },
  ],
});
