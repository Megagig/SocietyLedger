const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Metro's own default `blockList` excludes `__tests__/` directories but not this project's actual
// convention — colocated `*.test.ts(x)` files (code-standards.md). Without this, a test file
// placed inside `app/` (Expo Router's route root — every file there is a route) gets bundled for
// real by the dev server, which crashes the moment it imports a Jest-only package like
// `@testing-library/react-native`: that package requires Node's `console` module, which Metro's
// React-Native resolver can't resolve. Found at F1.8 when `app/(app)/_layout.test.tsx` (the guard
// test) crashed `expo start` this way; Jest itself is unaffected (separate pipeline, doesn't read
// this file).
config.resolver.blockList = [...config.resolver.blockList, /\.(test|spec)\.[jt]sx?$/];

module.exports = withNativeWind(config, { input: './src/theme/global.css' });
