import { defineConfig, devices } from '@playwright/test';
import { baseURL } from './constants';

/**
 * Screenshot capture pipeline (D1.6), run via `pnpm -F @societyledger/docs
 * screenshots [--section=<name>]` (`scripts/screenshots/capture.ts`), never
 * `playwright test` directly. Four projects — desktop/phone × light/dark
 * — each depending on the `setup` project, which logs in as all three
 * demo roles once and saves a `storageState` file per role under `.auth/`
 * (gitignored, never committed). `library-docs.md`'s Playwright notes.
 */
export default defineConfig({
  testDir: __dirname,
  testMatch: /capture\.spec\.ts/,
  // Some Ajo pages (the circle board, accountability) are heavy and the first visit in a dev server compiles them.
  timeout: 120_000,
  fullyParallel: false, // one capture at a time — deterministic output order
  reporter: [['list']],
  use: {
    baseURL,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop-light',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, colorScheme: 'light' },
      dependencies: ['setup'],
    },
    {
      name: 'desktop-dark',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, colorScheme: 'dark' },
      dependencies: ['setup'],
    },
    {
      name: 'phone-light',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, colorScheme: 'light' },
      dependencies: ['setup'],
    },
    {
      name: 'phone-dark',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
      dependencies: ['setup'],
    },
  ],
});
