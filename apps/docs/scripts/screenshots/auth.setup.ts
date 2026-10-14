import { test as setup } from '@playwright/test';
import path from 'node:path';
import { authDir, demoPassword, roles } from './constants';

/**
 * Logs in as each demo role once and saves its `storageState`
 * (`.auth/<role>.json`, gitignored) for `capture.spec.ts` to reuse —
 * avoids re-logging-in per shot.
 *
 * Selectors target the login form by `id` attribute
 * (`apps/web/src/app/auth/login/page.tsx`'s fields are `id="email"` /
 * `id="password"`, with no `name` attribute at all — confirmed against the
 * real rendered DOM at D5.1, since the original `name`-based guess here
 * never matched and timed out).
 */
for (const { role, email } of roles) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(demoPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);
    await page.context().storageState({ path: path.join(authDir, `${role}.json`) });
  });
}
