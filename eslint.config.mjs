// Flat ESLint config for the web app. apps/api and packages/* are out of
// scope for this config — the API has its own tooling and packages/shared is
// consumed, not linted, by this task.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      '**/.turbo',
      'prototype/**',
      'apps/api/**',
      'packages/**'
    ]
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    // Type-aware linting (recommendedTypeChecked + projectService) is the
    // target per the task brief, but typescript-eslint refuses to run at all
    // against TypeScript 7 right now — see task-1-report.md for the full
    // investigation. This falls back to the non-type-checked recommended set
    // as instructed; re-enable recommendedTypeChecked + projectService once
    // https://github.com/typescript-eslint/typescript-eslint/issues/10940
    // ships.
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules
    }
  }
);
