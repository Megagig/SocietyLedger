const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      'no-console': 'error',
    },
  },
  {
    // Standalone Node codegen scripts (not app code — lib/logger.ts doesn't apply here).
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
]);
