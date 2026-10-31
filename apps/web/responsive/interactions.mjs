// Captures opened UI states (drawer, menus, modals, date pickers) and loading / error states.
//   node responsive/interactions.mjs --run baseline
// A scenario whose click target cannot be found is recorded as "step not found" instead of failing the run.
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, baseURL, viewports, loadPlaywright, ensureDir } from './lib/config.mjs';
import { INIT_SCRIPT, measure, settle } from './lib/page-tools.mjs';

const { chromium } = loadPlaywright();
const run = process.argv[process.argv.indexOf('--run') + 1] || 'baseline';
const outRoot = ensureDir(path.join(artifacts, run, 'interactions'));
const metricsFile = path.join(artifacts, run, 'metrics-interactions.jsonl');
fs.rmSync(metricsFile, { force: true });

const vps = ['320x568', '390x844', '768x1024', '844x390', '1440x900'].map((n) => viewports.find((v) => v.name === n));
const byName = (re) => (p) => p.getByRole('button', { name: re }).first();
const byText = (re) => (p) => p.getByText(re).first();

// kind: 'click' scenarios open something; 'api' scenarios change how the page's data loads.
const scenarios = [
  { name: 'mobile-menu-button', path: '/dashboard', phoneOnly: true, click: (p) => p.locator('button.lg\\:hidden.fixed').first() },
  { name: 'bottom-nav-menu', path: '/dashboard', phoneOnly: true, click: byText(/^Menu$/) },
  { name: 'notification-bell', path: '/dashboard', click: (p) => p.locator('header button, button[aria-label*="otification" i]').last() },
  { name: 'members-disable-confirm', path: '/dashboard/members', click: byName(/disable/i) },
  { name: 'levies-create', path: '/dashboard/finance/levies', click: byName(/create levy/i) },
  { name: 'donations-create-category', path: '/dashboard/finance/donations', click: byName(/create category/i) },
  { name: 'transactions-bulk', path: '/dashboard/finance/transactions/create', click: byName(/bulk assignment/i) },
  { name: 'meeting-create-datepicker', path: '/dashboard/governance/meetings/create', click: (p) => p.locator('[class*="DateInput"] input, [class*="DatePicker"] input, input[type="date"], input[type="datetime-local"]').first() },
  { name: 'reports-daterange', path: '/dashboard/reports/payments', click: (p) => p.locator('[class*="DateInput"] input, [class*="DatePicker"] input, input[type="date"]').first() },
  { name: 'ajo-new', path: '/dashboard/ajo/new', click: null },
  { name: 'members-select-open', path: '/dashboard/members', click: (p) => p.locator('select').first() },
  { name: 'loading-members', path: '/dashboard/members', api: 'delay', match: '**/localhost:4101/api/members**' },
  { name: 'error-members', path: '/dashboard/members', api: 'error', match: '**/localhost:4101/api/members**' },
  { name: 'loading-dashboard', path: '/dashboard', api: 'delay', match: '**/localhost:4101/api/dashboard/**' },
  { name: 'error-dashboard', path: '/dashboard', api: 'error', match: '**/localhost:4101/api/dashboard/**' },
  { name: 'error-transactions', path: '/dashboard/finance/transactions', api: 'error', match: '**/localhost:4101/api/finance/transactions**' },
  { name: 'error-meetings', path: '/dashboard/governance/meetings', api: 'error', match: '**/localhost:4101/api/meetings**' },
  { name: 'offline-dashboard', path: '/dashboard', api: 'offline' },
];

const browser = await chromium.launch();
for (const vp of vps) {
  const ctx = await browser.newContext({
    baseURL,
    storageState: path.join(artifacts, 'auth', 'admin.json'),
    serviceWorkers: 'block',
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: 'reduce',
    hasTouch: vp.width < 1024,
  });
  await ctx.addInitScript(INIT_SCRIPT);
  for (const sc of scenarios) {
    if (sc.phoneOnly && vp.width >= 1024) continue;
    const rec = { scenario: sc.name, path: sc.path, viewport: vp.name };
    const page = await ctx.newPage();
    try {
      if (sc.api === 'error') await page.route(sc.match, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'Server error' } }) }));
      if (sc.api === 'delay') await page.route(sc.match, async (r) => { await new Promise((x) => setTimeout(x, 6000)); r.continue().catch(() => {}); });
      if (sc.api === 'offline') { await page.goto(sc.path, { waitUntil: 'domcontentloaded' }); await settle(page); await ctx.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(1500); }
      else {
        await page.goto(sc.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
        if (sc.api === 'delay') await page.waitForTimeout(1200); else await settle(page);
      }
      if (sc.click) {
        const target = sc.click(page);
        if (await target.count().catch(() => 0)) {
          if (sc.name === 'members-select-open') await target.focus();
          else await target.click({ timeout: 5000 }).catch((e) => { rec.note = 'click failed: ' + String(e.message).split('\n')[0].slice(0, 80); });
          await page.waitForTimeout(800);
        } else rec.note = 'step not found';
      }
      Object.assign(rec, await page.evaluate(measure));
      const file = path.join(ensureDir(path.join(outRoot, vp.name)), `${sc.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      rec.shot = path.relative(artifacts, file).split(path.sep).join('/');
    } catch (e) {
      rec.error = String(e.message).split('\n')[0].slice(0, 160);
    } finally {
      fs.appendFileSync(metricsFile, JSON.stringify(rec) + '\n');
      await ctx.setOffline(false).catch(() => {});
      await page.close().catch(() => {});
    }
  }
  await ctx.close();
}
await browser.close();
const rows = fs.readFileSync(metricsFile, 'utf8').trim().split('\n').map(JSON.parse);
for (const r of rows) console.log(r.viewport.padEnd(9), r.scenario.padEnd(28), r.error ? 'ERROR ' + r.error : r.note ?? (r.dialogOpen ? `dialog ${r.dialogOverflowsViewport ? 'OVERFLOWS' : 'ok'}` : 'no dialog'));
