// Shared settings for the responsive audit harness. Stage 1 tooling only: it never changes the app.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
export const appDir = path.resolve(root, '..');
export const repoRoot = path.resolve(appDir, '..', '..');
export const artifacts = path.join(root, 'artifacts');

// The audit runs against a scratch stack (see README.md): web on 3100, API on 4101, database sl_responsive.
export const baseURL = process.env.RESP_BASE_URL ?? 'http://demo.localhost:3100';
export const publicBaseURL = process.env.RESP_PUBLIC_URL ?? 'http://localhost:3100';
export const password = 'password123';

export const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x800', width: 360, height: 800 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '844x390', width: 844, height: 390 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1024x1366', width: 1024, height: 1366 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
];

// Roles whose navigation differs. Created by demo-association, demo-ajo and responsive-hardcases seeds.
export const roles = [
  { role: 'admin', email: 'admin@demo.com' },
  { role: 'treasurer', email: 'treasurer@demo.com' },
  { role: 'secretary', email: 'secretary@demo.com' },
  { role: 'member', email: 'member@demo.com' },
  { role: 'officer', email: 'officer@demo.com' },
  { role: 'collector', email: 'collector@demo.com' },
  { role: 'saver', email: 'saver@demo.com' },
];

// Playwright is not a declared dependency of apps/web yet (that comes in stage 2); load the copy already in the pnpm store.
export function loadPlaywright() {
  const req = createRequire(path.join(repoRoot, 'apps', 'docs', 'package.json'));
  return req('@playwright/test');
}
export function loadAxe() {
  const store = path.join(repoRoot, 'node_modules', '.pnpm');
  const dir = fs.readdirSync(store).find((d) => d.startsWith('axe-core@'));
  return path.join(store, dir, 'node_modules', 'axe-core', 'axe.min.js');
}
export function loadPng() {
  const store = path.join(repoRoot, 'node_modules', '.pnpm');
  const dir = fs.readdirSync(store).find((d) => d.startsWith('pngjs@5'));
  return createRequire(path.join(store, dir, 'node_modules', 'pngjs', 'x.js'))('pngjs');
}

export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }
