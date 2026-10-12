/**
 * `pnpm -F @societyledger/docs screenshots [--section=<name>]`
 *
 * Thin wrapper around `playwright test` — lets the DoD's literal
 * invocation (`screenshots --section=reports`) work without authors
 * needing to know this runs through the Playwright test runner at all.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const sectionArg = process.argv.slice(2).find((arg) => arg.startsWith('--section='));
const section = sectionArg?.split('=')[1];

const env = { ...process.env };
if (section) env.SCREENSHOT_SECTION = section;

const configPath = path.join(__dirname, 'capture.config.ts');
const result = spawnSync('npx', ['playwright', 'test', '--config', configPath], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
