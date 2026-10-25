// `"jest": { "preset": "jest-expo" }` in package.json wasn't enough once F1.4 added
// lucide-react-native: it ships ESM-only (`exports["."]["react-native"]` points at a `.mjs`
// file with no CJS fallback for that condition — jest-expo's own resolver uses the
// "react-native" export condition for parity with Metro). Two separate things had to be fixed,
// derived from jest-expo's real preset (jest-expo/jest-preset.js) rather than hand-copied:
//  1. transformIgnorePatterns' one regex entry didn't allow `lucide-react-native` through, so
//     the .mjs file was never handed to the transformer at all (left as raw ESM for Node's own
//     `require`, which throws "Must use import to load ES Module").
//  2. Even once allowed through, jest-expo's own babel-jest transform entry is keyed on
//     `\.[jt]sx?$` — which doesn't match a `.mjs` extension — so there was no transformer
//     assigned to the file in the first place. Rename that one key to `\.m?[jt]sx?$`, reusing
//     jest-expo's own computed babel-jest path + options exactly (not re-derived by hand).
//
// NOT fixed here (flagged, not silently worked around): once a `.tsx` file importing any
// `lucide-react-native` icon actually renders under Jest, `react-native-css-interop`'s module
// graph throws `Cannot read properties of undefined (reading 'documentElement')` — jest-expo's
// test environment defines a bare `window` global (truthy) with no `document`, which makes
// css-interop's web-vs-native runtime detection (a `typeof window` check) pick its web runtime
// even though the test environment is meant to emulate native. Tried routing through
// `react-native-reanimated/jest/resolver` (reanimated's own documented Jest resolver) — it fixes
// reanimated specifically but replaces Jest's resolver *project-wide* (delegates everything else
// to `react-native-worklets/jest/resolver`), which broke unrelated `.tsx` files too (every file
// gets `react-native-css-interop/jsx-runtime` injected via `babel.config.js`'s
// `jsxImportSource: 'nativewind'`) — reverted. Components that render a lucide icon
// (IconButton, ListItem's chevron, ScreenHeader's back button) are verified by type-check +
// lint only, not RTL, until this is root-caused. Button/Money/StatusChip (this feature's actual
// RTL-test requirement) import no icons and are unaffected.
const expoPreset = require('jest-expo/jest-preset');

const BABEL_TRANSFORM_KEY = '\\.[jt]sx?$';
const babelTransform = expoPreset.transform[BABEL_TRANSFORM_KEY];
if (!babelTransform) {
  throw new Error(`jest-expo/jest-preset no longer defines the expected "${BABEL_TRANSFORM_KEY}" transform key — re-check this override.`);
}

const transform = { ...expoPreset.transform };
delete transform[BABEL_TRANSFORM_KEY];
transform['\\.m?[jt]sx?$'] = babelTransform;

const [baseIgnorePattern, ...restIgnorePatterns] = expoPreset.transformIgnorePatterns;
if (!baseIgnorePattern?.endsWith('))')) {
  throw new Error('jest-expo/jest-preset\'s transformIgnorePatterns[0] no longer ends with "))" — re-check this override.');
}

module.exports = {
  ...expoPreset,
  transform,
  moduleNameMapper: {
    ...(expoPreset.moduleNameMapper ?? {}),
    '^sonner-native$': '<rootDir>/src/test-utils/sonner-native.stub.js',
    '^@gorhom/bottom-sheet$': '<rootDir>/src/test-utils/bottom-sheet.stub.js',
  },
  transformIgnorePatterns: [baseIgnorePattern.replace(/\)\)$/, '|lucide-react-native))'), ...restIgnorePatterns],
};
