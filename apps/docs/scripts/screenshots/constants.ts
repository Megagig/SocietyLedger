import path from 'node:path';

/**
 * Fixed capture instant — the browser's clock is frozen here during
 * capture (`capture.spec.ts`) so the app's own relative-time text
 * ("3 days ago") doesn't drift between runs. Falls inside the seeded
 * demo data's own fixed-date window (`seed-demo.md`).
 */
export const captureInstant = new Date('2026-10-12T09:00:00.000Z').getTime();

export const baseURL = process.env.DOCS_SCREENSHOT_BASE_URL ?? 'http://demo.localhost:3000';
export const demoPassword = process.env.DOCS_SCREENSHOT_DEMO_PASSWORD ?? 'password123';

export const authDir = path.join(__dirname, '.auth');

export const roles = [
  { role: 'admin', email: 'admin@demo.com' },
  { role: 'treasurer', email: 'treasurer@demo.com' },
  { role: 'member', email: 'member@demo.com' },
] as const;

export type Role = (typeof roles)[number]['role'];
