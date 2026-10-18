// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Guards against the UTC date bug (see utils/date.ts).
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='split'][callee.object.callee.property.name='toISOString']",
          message:
            "Don't use toISOString().split(...) for calendar days - it is UTC and shifts dates. Use todayString()/toDateString() from '@/utils/date'.",
        },
      ],
    },
  },
]);
