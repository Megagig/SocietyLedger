import path from 'node:path';

/**
 * Fixed capture instant — the browser's clock is frozen here during
 * capture (`capture.spec.ts`) so the app's own relative-time text
 * ("3 days ago") doesn't drift between runs. Falls inside the seeded
 * demo data's own fixed-date window (`seed-demo.md`).
 */
export const captureInstant = new Date('2026-10-12T09:00:00.000Z').getTime();

/**
 * The Ajo demo data (demo-ajo.seed.ts) runs up to the day it was seeded, and Ajo works out "overdue" and "behind" against the real
 * clock on the server. Ajo shots therefore freeze the browser at the seeded day, not at the instant above. Capture on the day you seed.
 */
export const ajoCaptureInstant = new Date('2026-10-30T12:00:00.000Z').getTime();

export const baseURL = process.env.DOCS_SCREENSHOT_BASE_URL ?? 'http://demo.localhost:3000';
export const demoPassword = process.env.DOCS_SCREENSHOT_DEMO_PASSWORD ?? 'password123';

export const authDir = path.join(__dirname, '.auth');

export const roles = [
  { role: 'admin', email: 'admin@demo.com' },
  { role: 'treasurer', email: 'treasurer@demo.com' },
  { role: 'member', email: 'member@demo.com' },
  // Ajo (T11): an Ajo officer, a collector, and a collector-thrift saver. Created by demo-ajo.seed.ts.
  { role: 'officer', email: 'officer@demo.com' },
  { role: 'collector', email: 'collector@demo.com' },
  { role: 'saver', email: 'saver@demo.com' },
] as const;

export type Role = (typeof roles)[number]['role'];
