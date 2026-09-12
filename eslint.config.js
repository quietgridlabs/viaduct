import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

/**
 * Layered import boundaries: shared → entities → features → widgets → app.
 * A layer may only reach downwards, and a feature is opaque from the outside —
 * cross-feature traffic goes through its public `index.ts`, never a deep path.
 *
 * Only the layered directories are constrained. The pre-refactor `components/`,
 * `pages/`, `utils/` and `state/` trees have no layer yet, so rules that would
 * fire on them wholesale are deliberately absent until those move.
 */
const layerBoundaries = [
  {
    layer: 'shared',
    files: ['src/shared/**/*.{ts,tsx}'],
    forbid: ['@entities/*', '@features/*', '@widgets/*', '@app/*', '@plugins/*', '@components/*', '@contexts/*'],
    message: 'shared/ is the bottom layer: it must not depend on entities, features, widgets, app or plugins.',
  },
  {
    layer: 'entities',
    files: ['src/entities/**/*.{ts,tsx}'],
    forbid: ['@features/*', '@widgets/*', '@app/*', '@plugins/*', '@components/*'],
    message: 'entities/ may only depend on shared/.',
  },
  {
    layer: 'features',
    files: ['src/features/**/*.{ts,tsx}'],
    forbid: ['@widgets/*', '@app/*', '@features/*/**'],
    message:
      'features/ may depend on shared/ and entities/. Reach another feature only through its public index (@features/<name>).',
  },
  {
    layer: 'widgets',
    files: ['src/widgets/**/*.{ts,tsx}'],
    forbid: ['@app/*', '@features/*/**'],
    message: 'widgets/ compose features through their public index (@features/<name>), and never import app/.',
  },
  {
    layer: 'plugins',
    files: ['src/plugins/**/*.{ts,tsx}'],
    forbid: ['@widgets/*', '@app/*', '@features/*/**'],
    message:
      'plugins/ are thin adapters: consume a feature through its public index (@features/<name>), not widgets or app.',
  },
].map(({ files, forbid, message }) => ({
  files,
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      { patterns: [{ group: forbid, message }] },
    ],
  },
}))

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'server/**',
      'coverage/**',
      'cypress/**',
      'scripts/**',
      '.claude/**',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      /* Hooks mistakes ship bugs — treat as errors, not warnings. */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      /*
       * Many modules export a component plus its types/helpers from one file
       * (folder barrels). Fast-refresh purity is nice; blocking commits on it
       * is not worth the churn — keep as error only for pure UI entry files
       * later if needed.
       */
      'react-refresh/only-export-components': [
        'off',
        { allowConstantExport: true },
      ],

      /* Prefix with `_` when a binding must exist for API symmetry. */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-useless-escape': 'error',
    },
  },
  ...layerBoundaries,
  {
    /* Tests may reach into a feature's internals to assert key shapes. */
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
)
