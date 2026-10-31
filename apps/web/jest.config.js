/**
 * Web tests. Pure logic runs in Node; a component test opts into a browser-like DOM with a `@jest-environment jsdom` comment at the top.
 * Types are checked by `tsc`, so the transform here does not check them again (it keeps the tests fast).
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\.(css|scss)$': '<rootDir>/test-support/style-mock.js',
  },
  transform: {
    '^.+\.tsx?$': ['ts-jest', { diagnostics: false, tsconfig: { jsx: 'react-jsx', module: 'commonjs', target: 'es2020', esModuleInterop: true, moduleResolution: 'node', isolatedModules: true, skipLibCheck: true, resolveJsonModule: true } }],
  },
};
