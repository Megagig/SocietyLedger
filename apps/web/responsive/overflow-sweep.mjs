// Visits routes at the overflow-test widths and reports any page wider than the viewport.
//   RESP_BASE_URL=http://demo.localhost:3101 node responsive/overflow-sweep.mjs [--from baseline] [--all] [--widths 320,375,768,1024,1440]
// Default routes: the ones that overflowed in the baseline run. --all: every static and resolved route.
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, baseURL, publicBaseURL, password, loadPlaywright } from './lib/config.mjs';
import { INIT_SCRIPT, measure, settle } from './lib/page-tools.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const widths = arg('widths', '320,375,768,1024,1440').split(',').map(Number);
const params = JSON.parse(fs.readFileSync(path.join(artifacts, 'params.json'), 'utf8'));
let templates;
if (process.argv.includes('--all')) templates = Object.keys(params);
else {
  const dir = path.join(artifacts, arg('from', 'baseline'));
  const rows = fs.readdirSync(dir).filter((f) => f.startsWith('metrics-') && !f.includes('interactions')).flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse));
  templates = [...new Set(rows.filter((r) => r.overflowX && (r.role === 'admin' || r.role === 'anon')).map((r) => r.template))];
}
const only = arg('only');
if (only) templates = templates.filter((t) => t.includes(only));
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const lc = await browser.newContext({ baseURL, serviceWorkers: 'block' });
const lp = await lc.newPage();
await lp.goto('/auth/login'); await lp.waitForLoadState('networkidle'); await lp.waitForTimeout(2500);
await lp.locator('#email').fill('admin@demo.com'); await lp.locator('#password').fill(password);
await lp.locator('button[type="submit"]').click(); await lp.waitForURL(/\/dashboard/, { timeout: 90000 });
const state = await lc.storageState(); await lc.close();

let bad = 0, total = 0;
for (const w of widths) {
  const ctx = await browser.newContext({ baseURL, storageState: state, serviceWorkers: 'block', viewport: { width: w, height: w < 700 ? 800 : 900 }, hasTouch: w < 1024, reducedMotion: 'reduce' });
  await ctx.addInitScript(INIT_SCRIPT);
  for (const t of templates) {
    const url = params[t];
    const isPublic = !url.startsWith('/dashboard') && !url.startsWith('/auth') && !url.startsWith('/onboarding');
    const page = await ctx.newPage();
    try {
      await page.goto((isPublic ? publicBaseURL : baseURL) + url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await settle(page);
      const m = await page.evaluate(measure);
      total++;
      if (m.overflowX) { bad++; console.log(`OVERFLOW ${String(w).padEnd(5)} +${String(m.overflowPx).padEnd(4)} ${t.padEnd(46)} ${m.offenders.slice(0, 2).map((o) => o.el.split('.').slice(0, 2).join('.') + ':' + JSON.stringify(o.text.slice(0, 20))).join(' | ')}`); }
    } catch (e) { console.log(`ERROR    ${w} ${t} ${String(e.message).split('\n')[0].slice(0, 80)}`); }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${total - bad}/${total} page-widths without horizontal overflow`);
process.exit(bad ? 1 : 0);
