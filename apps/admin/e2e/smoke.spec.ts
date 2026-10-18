import { test, expect, type Page } from '@playwright/test';

// Smoke suite — verifies the critical paths of the admin console.
// Requires the dev server running on localhost:3002 and a seeded platform admin.
//
// Set env vars before running:
//   PLAYWRIGHT_BASE_URL   (default: http://localhost:3002)
//   E2E_ADMIN_EMAIL       platform admin email
//   E2E_ADMIN_PASSWORD    platform admin password

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@societyledger.com.ng';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'changeme';

// ── helpers ────────────────────────────────────────────────────────────────────

async function loginAs(page: Page, email = adminEmail, password = adminPassword) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// ── tests ──────────────────────────────────────────────────────────────────────

test.describe('unauthenticated redirects', () => {
  test('/ redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('login flow', () => {
  test('shows error on bad credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('valid credentials reach dashboard or 2FA page', async ({ page }) => {
    await loginAs(page);
    // Either 2FA challenge or dashboard — both are valid terminal states
    await expect(page).toHaveURL(/\/(dashboard|2fa)/);
  });
});

test.describe('admin console (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Skip suite if creds not provided in CI
    if (!process.env.E2E_ADMIN_EMAIL) {
      test.skip();
    }
    await loginAs(page);
    // Only proceed if we landed on dashboard (i.e. no 2FA required in this env)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('dashboard renders stats cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    // At least one stat card should appear
    await expect(page.locator('[data-stat-card]').first()).toBeVisible();
  });

  test('associations list renders', async ({ page }) => {
    await page.goto('/associations');
    await expect(page.getByRole('heading', { name: /associations/i })).toBeVisible();
    // Table or empty-state — either is fine
    await expect(
      page.locator('table, [data-empty-state]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('impersonation page renders', async ({ page }) => {
    await page.goto('/impersonation');
    await expect(page.getByRole('heading', { name: /impersonation/i })).toBeVisible();
  });

  test('security headers are present on every response', async ({ page }) => {
    const res = await page.goto('/dashboard');
    expect(res?.headers()['x-frame-options']).toBe('DENY');
    expect(res?.headers()['x-robots-tag']).toContain('noindex');
    expect(res?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    // unsafe-eval must NOT be present
    expect(res?.headers()['content-security-policy']).not.toContain('unsafe-eval');
  });

  test('BFF rejects non-admin path (allow-list enforcement)', async ({ page }) => {
    // Try to proxy a path not in the allow-list
    const res = await page.request.get('/bff/auth/login');
    expect(res.status()).toBe(404);
  });

  test('logout clears session and redirects to /login', async ({ page }) => {
    // Call the session DELETE endpoint directly
    await page.request.delete('/bff/session');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('impersonation handoff exchange', () => {
  test('/auth/impersonate shows error when code is missing (web app)', async ({ page }) => {
    // The web app impersonate page (apps/web) — test from the perspective of missing code
    // This tests the error branch without an actual code
    await page.goto('http://localhost:3000/auth/impersonate');
    await expect(page.getByText(/missing impersonation code/i)).toBeVisible({ timeout: 8_000 });
  });
});
