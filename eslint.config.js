import js from '@eslint/js';
import tsPlugin from 'typescript-eslint';

export default tsPlugin.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/*.d.ts',
      '**/*.d.ts.map',
      'site/**',
      'docs/**',
      'packages/admin-ui/src/page/bundle-content.ts',
    ],
  },
  js.configs.recommended,
  ...tsPlugin.configs.recommended,
  {
    files: ['scripts/**/*.{js,mjs}', 'packages/**/scripts/**/*.{js,mjs}', 'benchmarks/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['packages/**/*.{ts,tsx}', 'examples/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts', 'examples/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
