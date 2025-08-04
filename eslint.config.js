import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn', // エラーから警告に変更
      '@typescript-eslint/no-explicit-any': 'warn', // エラーから警告に変更
      '@typescript-eslint/no-unused-vars': ['warn', { // エラーから警告に変更
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_|DEBUG|INFO|WARN|ERROR',
      }],
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'no-undef': 'off', // TypeScript handles this
      'no-unused-vars': 'off', // Handled by TypeScript ESLint
      'no-redeclare': 'off', // TypeScriptで型定義の重複は許可
      'no-useless-escape': 'warn', // エラーから警告に変更
    },
  },
];