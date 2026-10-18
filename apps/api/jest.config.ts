import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  globals: {
    'ts-jest': {
      // tsconfig.json's rootDir/include only cover src/, so __tests__ files were
      // compiled with no ambient @types/jest declarations in scope (G74) — this
      // dedicated config widens include without touching the real build's tsconfig.
      tsconfig: '<rootDir>/tsconfig.test.json',
    },
  },
};

export default config;
