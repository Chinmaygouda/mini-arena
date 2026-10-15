import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}', '*.{js,mjs,ts}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        window: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  {
    // Pure simulation rules for packages/shared
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'three',
              message: 'packages/shared must not import Three.js (AGENT_RULES.md Rule C).',
            },
            {
              name: 'colyseus',
              message: 'packages/shared must not import Colyseus server (AGENT_RULES.md Rule C).',
            },
            {
              name: '@colyseus/sdk',
              message: 'packages/shared must not import Colyseus client SDK (AGENT_RULES.md Rule C).',
            },
          ],
          patterns: [
            {
              group: ['three/*', '@colyseus/*'],
              message: 'packages/shared must not import rendering or networking libraries.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'packages/shared has no DOM (AGENT_RULES.md Rule C).' },
        { name: 'document', message: 'packages/shared has no DOM (AGENT_RULES.md Rule C).' },
        { name: 'navigator', message: 'packages/shared has no DOM (AGENT_RULES.md Rule C).' },
        { name: 'localStorage', message: 'packages/shared has no DOM (AGENT_RULES.md Rule C).' },
        { name: 'fetch', message: 'packages/shared has no DOM/network calls (AGENT_RULES.md Rule C).' },
      ],
    },
  },
);
