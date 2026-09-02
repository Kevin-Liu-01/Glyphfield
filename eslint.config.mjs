import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: { sonarjs },
    rules: {
      complexity: ['error', 21],
      'sonarjs/cognitive-complexity': ['error', 21],
    },
  },
];
