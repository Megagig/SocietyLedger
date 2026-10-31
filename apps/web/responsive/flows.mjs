// End-to-end flows at a phone, a tablet and a desktop width, against the scratch stack. Each step records pass/fail and checks the page
// did not grow a horizontal scrollbar. Steps the seed data cannot support are reported as SKIP with the reason, never as a pass.
//   RESP_BASE_URL=http://demo.localhost:3100 node responsive/flows.mjs [--widths 390,768,1440]
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, baseURL, password, loadPlaywright, ensureDir } from './lib/config.mjs';
import { INIT_SCRIPT, settle } from './lib/page-tools.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const widths = arg('widths', '390,768,1440').split(',').map(Number);
const heights = { 390: 844, 768: 1024, 1440: 900 };
const { chromium } = loadPlaywright();
const out = ensureDir(path.join(artifacts, arg('run', 'after'), 'flows'));
const browser = await chromium.launch();
const results = [];

async function login(page, email) {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 90000 });
  await settle(page);
}
const noOverflow = async (page) => (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1;

for (const w of widths) {
  const tag = `${w}px`;
  const record = (flow, step, status, note = '') => { results.push({ width: w, flow, step, status, note }); console.log(`${status.padEnd(4)} ${tag.padEnd(7)} ${flow.padEnd(14)} ${step}${note ? '  - ' + note : ''}`); };
  const step = async (page, flow, name, fn) => {
    try {
      const r = await fn();
      if (r && r.skip) return record(flow, name, 'SKIP', r.skip);
      const fits = await noOverflow(page);
      record(flow, name, fits ? 'PASS' : 'FAIL', fits ? '' : 'page is wider than the screen');
    } catch (e) {
      record(flow, name, 'FAIL', String(e.message).split('\n')[0].slice(0, 110));
      await page.screenshot({ path: path.join(out, `${tag}-${flow}-${name.replace(/\W+/g, '_')}-fail.png`) }).catch(() => {});
    }
  };
  const ctxOpts = { baseURL, serviceWorkers: 'block', viewport: { width: w, height: heights[w] }, hasTouch: w < 1024, reducedMotion: 'reduce' };

  // ---------- Officer (admin) ----------
  let ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(INIT_SCRIPT);
  let page = await ctx.newPage();
  await step(page, 'login', 'sign in', () => login(page, 'admin@demo.com'));

  await step(page, 'add-member', 'open form', async () => { await page.goto('/dashboard/members/create'); await settle(page); await page.locator('[name="firstName"]').waitFor(); });
  await step(page, 'add-member', 'fill and save', async () => {
    const stamp = `${w}${Date.now().toString().slice(-6)}`;
    await page.locator('[name="firstName"]').fill('Responsive');
    await page.locator('[name="lastName"]').fill(`Tester${stamp}`);
    if (await page.locator('[name="memberId"]').count()) await page.locator('[name="memberId"]').fill(`RT${stamp}`);
    await page.locator('[name="email"]').fill(`rt${stamp}@example.com`);
    await page.locator('button[type="submit"]').scrollIntoViewIfNeeded();
    const covered = await page.evaluate(() => { const b = document.querySelector('button[type="submit"]'); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, window.innerHeight - 1)); return !(b === el || b.contains(el)); });
    if (covered) throw new Error('submit button is covered by something (bottom nav?)');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard\/members(\/\d+)?$/, { timeout: 30000 });
    await settle(page);
  });

  await step(page, 'record-dues', 'form reachable', async () => {
    await page.goto('/dashboard/finance/transactions/create'); await settle(page);
    const submit = page.locator('button[type="submit"]').last();
    await submit.scrollIntoViewIfNeeded();
    const reachable = await page.evaluate(() => { const b = [...document.querySelectorAll('button[type="submit"]')].pop(); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, window.innerHeight - 1)); return b === el || b.contains(el); });
    if (!reachable) throw new Error('record button is covered');
    return { skip: undefined };
  });

  await step(page, 'meeting', 'create', async () => {
    await page.goto('/dashboard/governance/meetings/create'); await settle(page);
    await page.getByPlaceholder('e.g., Monthly General Meeting').fill(`Responsive check ${w}`);
    await page.locator('input[type="date"]').first().fill('2026-12-15');
    const times = page.locator('input[type="time"]');
    await times.nth(0).fill('10:00');
    await times.nth(1).fill('12:00');
    await page.getByPlaceholder(/Community Hall/).fill('Main hall');
    await page.getByRole('button', { name: /schedule meeting/i }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /schedule meeting/i }).click();
    await page.waitForURL(/\/dashboard\/governance\/meetings/, { timeout: 30000 });
    await settle(page);
  });

  await step(page, 'report', 'open financial summary', async () => {
    await page.goto('/dashboard/reports/financial-summary'); await settle(page);
    await page.getByText('Financial Summary Report').first().waitFor({ timeout: 30000 });
    const exp = page.getByRole('button', { name: /export pdf/i });
    await exp.scrollIntoViewIfNeeded();
    if (!(await exp.isVisible())) throw new Error('Export PDF is not reachable');
  });

  await step(page, 'settings', 'change and save', async () => {
    await page.goto('/dashboard/settings/notifications'); await settle(page);
    await page.locator('label:has(input[type="checkbox"])').first().click();
    const save = page.getByRole('button', { name: /save changes/i });
    await save.scrollIntoViewIfNeeded();
    if (!(await save.isEnabled())) throw new Error('Save Changes stayed disabled after a change');
    await save.click();
    await page.waitForTimeout(1500);
  });

  await step(page, 'logout', 'sign out', async () => {
    await page.goto('/dashboard'); await settle(page);
    if (w < 1024) { await page.getByRole('link', { name: 'Menu' }).click(); await page.waitForTimeout(500); }
    await page.locator('#app-sidebar').getByRole('button', { name: /logout/i }).scrollIntoViewIfNeeded();
    await page.locator('#app-sidebar').getByRole('button', { name: /logout/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^logout$/i }).click();
    await page.waitForURL(/\/auth\/login/, { timeout: 30000 });
  });
  await ctx.close();

  // ---------- Member ----------
  ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(INIT_SCRIPT);
  page = await ctx.newPage();
  await step(page, 'member', 'sign in', () => login(page, 'member@demo.com'));
  await step(page, 'thrift', 'view circle', async () => {
    await page.goto('/dashboard/my-thrift'); await settle(page);
    const link = page.locator('a[href^="/dashboard/my-thrift/"]').filter({ hasNotText: /notifications|payments|payout/i }).first();
    await link.waitFor({ timeout: 15000 });
    await link.click();
    await page.waitForURL(/\/dashboard\/my-thrift\/\d+/, { timeout: 30000 });
    await settle(page);
    await page.screenshot({ path: path.join(out, `${tag}-thrift-circle.png`) });
  });
  await step(page, 'thrift', 'contribution page', async () => {
    const m = page.url().match(/my-thrift\/(\d+)/);
    await page.goto(`/dashboard/my-thrift/${m[1]}/pay`); await settle(page);
    await page.locator('h1, h2').first().waitFor();
  });
  await step(page, 'vote', 'open voting', async () => {
    await page.goto('/dashboard/member/my-voting'); await settle(page);
    const ballots = await page.getByRole('button', { name: /cast|vote now|submit vote/i }).count();
    if (ballots === 0) return { skip: 'no open ballot in the seed data (the election is still taking nominations)' };
  });
  await ctx.close();
}
await browser.close();
const counts = results.reduce((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
fs.writeFileSync(path.join(out, 'flows.json'), JSON.stringify(results, null, 2));
console.log('\n', counts);
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
