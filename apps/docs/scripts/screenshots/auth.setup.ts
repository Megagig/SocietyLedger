import { test as setup } from '@playwright/test';
import path from 'node:path';
import { authDir, demoPassword, roles } from './constants';

/**
 * Logs in as each demo role once and saves its `storageState`
 * (`.auth/<role>.json`, gitignored) for `capture.spec.ts` to reuse —
 * avoids re-logging-in per shot.
 *
 * Selectors target the login form by `name`/`type` attribute
 * (`apps/web/src/app/auth/login/page.tsx`'s fields, per `authStore.login()`'s
 * `{ email, password }` body), not by label text or button copy — those
 * weren't confirmed against the actual rendered DOM, so the more
 * structural selector is the safer guess. **Unverified** — fix the
 * selectors here first if this fails.
 */
for (const { role, email } of roles) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"], input[type="password"]').fill(demoPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);
    await page.context().storageState({ path: path.join(authDir, `${role}.json`) });
  });
}
