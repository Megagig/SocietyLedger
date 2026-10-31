import { test, expect, type Page } from '@playwright/test';

// Ajo admin screens (T9): they load for a super admin, show their data or a proper empty state, and raise no page errors.
// Requires the admin (localhost:3002) and the API running, and a seeded platform admin. Same variables as smoke.spec.ts:
//   PLAYWRIGHT_BASE_URL, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@societyledger.com.ng';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'changeme';

async function loginAs(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

test.describe('Ajo admin screens', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('every Ajo page loads without a page error, and the sidebar links to them', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/dashboard');
    for (const name of ['Ajo groups', 'Ajo analytics', 'Ajo pricing', 'Ajo verification']) {
      await expect(page.getByRole('link', { name })).toBeVisible();
    }

    for (const [path, heading] of [
      ['/ajo/verifications', 'Ajo verification'],
      ['/ajo/groups', 'Ajo groups'],
      ['/ajo/pricing', 'Ajo pricing'],
      ['/ajo/analytics', 'Ajo analytics'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('verification queue has its three tabs and either rows or a clear empty state', async ({ page }) => {
    await page.goto('/ajo/verifications');
    for (const tab of ['Waiting', 'Verified', 'Rejected']) await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    await expect(page.getByText(/Nothing waiting for review|Put forward/)).toBeVisible();
    await page.getByRole('tab', { name: 'Rejected' }).click();
    await expect(page.getByText(/Nothing here yet|Put forward/)).toBeVisible();
  });

  test('pricing lists the Ajo tiers with prices written in full and a way into the Plan Builder', async ({ page }) => {
    await page.goto('/ajo/pricing');
    await expect(page.getByText('Ajo Starter')).toBeVisible();
    await expect(page.getByText(/₦3,000\.00|₦\d{1,3}(,\d{3})*\.00/).first()).toBeVisible();
    await page.getByRole('link', { name: 'Edit price' }).first().click();
    // The first visit to a page in dev compiles it, which can take a while.
    await expect(page).toHaveURL(/\/plans\/addons\/\d+/, { timeout: 45_000 });
  });

  test('settings shows the levy card with naira in full and percent rates', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Ajo platform levy')).toBeVisible();
    await expect(page.getByText(/Capped at ₦5,000\.00 per cycle and ₦1,000\.00 per participant/)).toBeVisible();
    await expect(page.locator('input[value$="%"]').first()).toBeVisible();
    await expect(page.locator('input[value^="₦"]').first()).toBeVisible();
  });

  test('analytics shows its figures and the two 6-month series', async ({ page }) => {
    await page.goto('/ajo/analytics');
    await expect(page.getByText('Groups with an Ajo tier')).toBeVisible();
    await expect(page.getByText(/Active contributors, last 30 days/)).toBeVisible();
    await expect(page.getByText('Paid for Ajo tiers, last 6 months')).toBeVisible();
    await expect(page.getByText('Platform levy, last 6 months')).toBeVisible();
  });

  test('groups list opens a group page with the tier card, when there is a group', async ({ page }) => {
    await page.goto('/ajo/groups');
    const open = page.getByRole('link', { name: 'Open' }).first();
    const empty = page.getByText('No groups found');
    // Wait for the list to finish loading: either a row or the empty state.
    await expect(open.or(empty)).toBeVisible({ timeout: 30_000 });
    if (await empty.isVisible()) return;
    await open.click();
    await expect(page).toHaveURL(/\/ajo\/groups\/\d+/, { timeout: 45_000 });
    await expect(page.getByText('Ajo tier', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Change tier/ })).toBeVisible();
  });

  test('the tier dialog previews a change without making one, and will not confirm without a real reason', async ({ page }) => {
    await page.goto('/ajo/groups');
    const open = page.getByRole('link', { name: 'Open' }).first();
    await expect(open.or(page.getByText('No groups found'))).toBeVisible({ timeout: 30_000 });
    if (!(await open.isVisible())) return;
    await open.click();
    await page.getByRole('button', { name: /Change tier/ }).click({ timeout: 45_000 });

    const dialog = page.getByRole('dialog', { name: 'Change Ajo tier' });
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Confirm' });
    await expect(confirm).toBeDisabled();

    await dialog.getByRole('textbox', { name: 'Move to' }).click();
    await page.getByRole('option').first().click();
    // A preview appears (blocked, upgrade, downgrade or the tier it already has) and nothing has been changed yet.
    await expect(dialog.getByRole('alert').first()).toBeVisible({ timeout: 15_000 });

    await dialog.getByLabel(/Reason/).fill('too short');
    await expect(confirm).toBeDisabled();

    await page.screenshot({ path: 'test-results/ajo-tier-dialog.png' });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });
});
