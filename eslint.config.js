const {fixupConfigRules, fixupPluginRules} = require('@eslint/compat');
const js = require('@eslint/js');
const {FlatCompat} = require('@eslint/eslintrc');
const eslintComments = require('eslint-plugin-eslint-comments');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const jsxA11Y = require('eslint-plugin-jsx-a11y');
const tsdoc = require('eslint-plugin-tsdoc');
const jest = require('eslint-plugin-jest');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const tsParser = require('@typescript-eslint/parser');
const globals = require('globals');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const lintedTSPackages = [
  'packages/hydrogen-react',
  'examples/express',
  'templates/skeleton',
  'docs/previews',
];

module.exports = [
  // Global ignores
  {
    ignores: [
      '**/node_modules/',
      '**/build/',
      '**/*.graphql.d.ts',
      '**/*.graphql.ts',
      '**/storefront-api-types.d.ts',
      '**/customer-account-api-types.d.ts',
      '**/codegen.ts',
      '**/dist/**/*',
      '**/coverage/**/*',
      '**/docs/**/*',
      '**/.eslintrc.cjs',
      '**/src/**/*.example.tsx',
      '**/src/**/*.example.ts',
      '**/src/**/*.example.jsx',
      '**/src/**/*.example.js',
      '**/eslint.config.cjs',
      '**/scripts/**/*',
      'bin/',
      '*.d.ts',
      '**/codegen.ts',
      '**/vite.config.ts',
      '**/vitest.setup.ts',
      '**/vitest.config.ts',
      '**/tsup.config.ts',
      '**/src/storefront-api-response.types.ts',
      '**/storefrontapi.generated.d.ts',
    ],
  },

  // Base configurations
  ...fixupConfigRules(
    compat.extends(
      'plugin:node/recommended',
      'plugin:import/recommended',
      'plugin:import/typescript',
      'eslint:recommended',
      'plugin:eslint-comments/recommended',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
    ),
  ),

  // Core configuration with plugins and general rules
  {
    plugins: {
      'eslint-comments': fixupPluginRules(eslintComments),
      react: fixupPluginRules(react),
      'react-hooks': fixupPluginRules(reactHooks),
      'jsx-a11y': fixupPluginRules(jsxA11Y),
    },
    settings: {
      'import/resolvers': {
        typescript: {
          project: [
            'packages/*/tsconfig.json',
            'templates/*/tsconfig.json',
            'examples/*/tsconfig.json',
            'docs/*/tsconfig.json',
          ],
        },
      },
      react: {version: 'detect'},
      jest: {version: 28},
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {jsx: true},
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      // React rules
      'react/display-name': 'off',
      'react/no-array-index-key': 'warn',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-children-prop': 'off',
      'react/no-unescaped-entities': 'off',
      'react/jsx-no-target-blank': 'off',
      'react-hooks/exhaustive-deps': 'error',

      // Node rules
      'node/shebang': 'off',
      'node/no-unpublished-require': 'off',
      'node/no-unsupported-features/es-syntax': 'off',
      'node/no-missing-import': 'off',
      'node/no-extraneous-import': 'off',
      'node/no-unpublished-import': 'off',
      'node/no-unsupported-features/es-builtins': [
        'error',
        {version: '>=14.0.0', ignores: []},
      ],
      'node/no-unsupported-features/node-builtins': [
        'error',
        {version: '>=14.0.0', ignores: []},
      ],

      // TypeScript rules
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',

      // General rules
      'object-shorthand': ['error', 'always', {avoidQuotes: true}],
      'prefer-const': ['warn', {destructuring: 'all'}],
      'no-prototype-builtins': 'off',
      'no-use-before-define': 'off',
      'no-warning-comments': 'off',
      'no-empty': 'off',
      'no-control-regex': 'off',
      'no-async-promise-executor': 'off',
      'eslint-comments/no-unused-disable': 'off',
      'jest/no-disabled-tests': 'off',
      'jest/no-export': 'off',
      'no-console': 'off',
      'no-ex-assign': 'off',
      'no-constant-condition': 'off',
      'no-useless-escape': 'off',
      'no-case-declarations': 'off',
      'no-process-exit': 'off',

      // Import rules
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
    },
  },

  // Test files configuration
  ...compat.extends('plugin:jest/recommended').map((config) => ({
    ...config,
    files: ['**/*.test.*'],
  })),
  {
    files: ['**/*.test.*'],
    plugins: {jest},
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },

  // TypeScript files configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    settings: {
      'import/resolvers': {
        typescript: {
          project: [
            'packages/*/tsconfig.json',
            'templates/*/tsconfig.json',
            'examples/*/tsconfig.json',
            'docs/*/tsconfig.json',
          ],
        },
      },
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
        ecmaFeatures: {jsx: true},
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'prefer-const': 'off',
    },
  },

  // Server files configuration
  {
    files: ['**/*.server.*'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  // Linted TypeScript packages configuration
  {
    files: [
      ...lintedTSPackages.flatMap((pkg) => [
        `${pkg}/**/*.ts`,
        `${pkg}/**/*.tsx`,
      ]),
    ],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'tsdoc/syntax': 'error',
      'react/jsx-no-target-blank': 'error',
      'node/no-extraneous-import': [
        'error',
        {
          allowModules: [
            '@shopify/hydrogen',
            '@shopify/react-testing',
            '@remix-run/web-fetch',
            '@total-typescript/ts-reset',
          ],
        },
      ],
      'node/no-extraneous-require': [
        'error',
        {
          allowModules: ['@shopify/hydrogen'],
        },
      ],
    },
    plugins: {tsdoc},
  },

  // TypeScript strict configuration for linted packages
  ...fixupConfigRules(
    compat.extends(
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:@typescript-eslint/recommended-requiring-type-checking',
      'plugin:jsx-a11y/recommended',
    ),
  ).map((config) => ({
    ...config,
    files: [
      ...lintedTSPackages.flatMap((pkg) => [
        `${pkg}/**/*.ts`,
        `${pkg}/**/*.tsx`,
      ]),
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
        ecmaFeatures: {jsx: true},
      },
    },
    rules: {
      'jsx-a11y/control-has-associated-label': 'off',
      'jsx-a11y/label-has-for': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  })),

  // Example files configuration
  {
    files: [
      '**/*.example.ts',
      '**/*.example.js',
      '**/*.example.tsx',
      '**/*.example.jsx',
    ],
    rules: {
      'node/no-extraneous-import': 'off',
      'node/no-extraneous-require': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'import/no-duplicates': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'prefer-const': 'off',
      'import/no-named-as-default': 'off',
      'node/no-missing-require': 'off',
    },
  },

  // Index files configuration
  {
    files: ['**/src/index.ts'],
    plugins: {'simple-import-sort': simpleImportSort},
    rules: {'simple-import-sort/exports': 'error'},
  },

  // Hydrogen package configuration
  {
    files: ['packages/hydrogen/**/*.tsx', 'packages/hydrogen/**/*.ts'],
    rules: {'react-hooks/exhaustive-deps': 'off'},
  },
];
