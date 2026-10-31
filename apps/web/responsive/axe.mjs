// axe-core on key pages at a phone and a desktop width, for two builds, then the violations that exist only in the second build.
//   A_URL=http://demo.localhost:3102 B_URL=http://demo.localhost:3100 node responsive/axe.mjs
// "A" is the original build, "B" the current one. Pages that need a login are skipped for a build whose login does not work.
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, password, loadPlaywright, loadAxe, ensureDir } from './lib/config.mjs';
import { INIT_SCRIPT, settle } from './lib/page-tools.mjs';

const builds = [['original', process.env.A_URL ?? 'http://demo.localhost:3102'], ['current', process.env.B_URL ?? 'http://demo.localhost:3100']];
const pages = [
  { p: '/', auth: false }, { p: '/pricing', auth: false }, { p: '/auth/login', auth: false },
  { p: '/dashboard', auth: true }, { p: '/dashboard/members', auth: true }, { p: '/dashboard/finance/transactions', auth: true },
  { p: '/dashboard/governance/meetings/create', auth: true }, { p: '/dashboard/settings/notifications', auth: true }, { p: '/dashboard/notifications', auth: true },
];
const widths = [390, 1440];
const axeSource = fs.readFileSync(loadAxe(), 'utf8');
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const found = {}; // build -> "page|width" -> Map(ruleId -> nodes)

for (const [label, base] of builds) {
  found[label] = {};
  let state = null;
  try {
    const c = await browser.newContext({ baseURL: base, serviceWorkers: 'block' });
    const pg = await c.newPage();
    await pg.goto('/auth/login'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(2500);
    await pg.locator('#email').fill('admin@demo.com'); await pg.locator('#password').fill(password);
    await pg.locator('button[type="submit"]').click();
    await pg.waitForURL(/\/dashboard/, { timeout: 30000 });
    state = await c.storageState();
    await c.close();
  } catch { console.log(`(login does not work on the ${label} build: signed-in pages skipped for it)`); }
  for (const w of widths) {
    const ctx = await browser.newContext({ baseURL: base, storageState: state ?? undefined, serviceWorkers: 'block', viewport: { width: w, height: w < 700 ? 844 : 900 }, hasTouch: w < 1024, reducedMotion: 'reduce' });
    await ctx.addInitScript(INIT_SCRIPT);
    for (const { p, auth } of pages) {
      if (auth && !state) continue;
      const page = await ctx.newPage();
      try {
        await page.goto(p, { waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page);
        await page.evaluate(axeSource);
        const res = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
        const m = new Map();
        for (const v of res.violations) m.set(v.id, { impact: v.impact, nodes: v.nodes.length });
        found[label][`${p}|${w}`] = m;
      } catch (e) { console.log('failed', label, p, w, String(e.message).split('\n')[0].slice(0, 80)); }
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();

let worse = 0;
const lines = [];
for (const { p } of pages) for (const w of widths) {
  const k = `${p}|${w}`;
  const a = found.original[k], b = found.current[k];
  if (!b) continue;
  const ids = [...b.keys()];
  const fmt = (m) => (m ? [...m.entries()].map(([id, v]) => `${id}(${v.nodes})`).join(', ') || 'none' : 'n/a');
  const added = a ? ids.filter((id) => !a.has(id) || a.get(id).nodes < b.get(id).nodes) : [];
  worse += added.length;
  lines.push(`${p.padEnd(40)} ${String(w).padEnd(5)} original: ${fmt(a)}\n${''.padEnd(46)}current:  ${fmt(b)}${added.length ? '\n' + ''.padEnd(46) + 'WORSE: ' + added.join(', ') : ''}`);
}
console.log(lines.join('\n'));
console.log(`\nviolations that are new or more frequent in the current build: ${worse}`);
fs.writeFileSync(path.join(ensureDir(path.join(artifacts, 'after')), 'axe.txt'), lines.join('\n'));
process.exit(worse ? 1 : 0);
