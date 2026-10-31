module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false, tsconfig: { module: 'commonjs', target: 'es2020', esModuleInterop: true, moduleResolution: 'node', isolatedModules: true, skipLibCheck: true } }],
  },
};
