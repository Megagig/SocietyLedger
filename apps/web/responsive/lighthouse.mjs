// Lighthouse (mobile and desktop) for a few key pages, against the scratch production build.
// Lighthouse is not a dependency of the repo: install it in a scratch folder and point LH_DIR at it.
//   LH_DIR=<folder with node_modules/lighthouse> node responsive/lighthouse.mjs --run baseline
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { artifacts, baseURL, publicBaseURL, password, loadPlaywright, ensureDir } from './lib/config.mjs';

const run = process.argv[process.argv.indexOf('--run') + 1] || 'baseline';
const lhDir = process.env.LH_DIR;
if (!lhDir) throw new Error('Set LH_DIR to the folder where lighthouse is installed.');
const lhUrl = (rel) => pathToFileURL(path.join(lhDir, 'node_modules', 'lighthouse', rel)).href;
const { default: lighthouse } = await import(lhUrl('core/index.js'));
const { default: desktopConfig } = await import(lhUrl('core/config/desktop-config.js'));

const { chromium } = loadPlaywright();
const port = 9333;
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'lh-')), {
  headless: true,
  args: [`--remote-debugging-port=${port}`],
  baseURL,
});
const page = await ctx.newPage();
await page.goto(baseURL + '/auth/login');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2500);
await page.locator('#email').fill('admin@demo.com');
await page.locator('#password').fill(password);
await page.locator('button[type="submit"]').click();
await page.waitForURL(/\/dashboard/, { timeout: 30000 });
await page.waitForLoadState('networkidle').catch(() => {});

const pages = [
  { name: 'home', url: publicBaseURL + '/' },
  { name: 'pricing', url: publicBaseURL + '/pricing' },
  { name: 'login', url: baseURL + '/auth/login' },
  { name: 'dashboard', url: baseURL + '/dashboard' },
  { name: 'members', url: baseURL + '/dashboard/members' },
];
const only = process.env.ONLY;
const results = [];
for (const p of pages.filter((x) => !only || x.name === only)) {
  for (const mode of ['mobile', 'desktop']) {
    const flags = { port, output: 'json', logLevel: 'error', disableStorageReset: !p.url.startsWith(publicBaseURL), onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] };
    const r = await lighthouse(p.url, flags, mode === 'desktop' ? desktopConfig : undefined);
    const a = r.lhr.audits;
    if (r.lhr.runtimeError) { console.log(p.name, mode, 'RUNTIME ERROR', r.lhr.runtimeError.code); results.push({ page: p.name, mode, error: r.lhr.runtimeError.code }); continue; }
    const row = {
      page: p.name, mode,
      performance: Math.round(r.lhr.categories.performance.score * 100),
      accessibility: Math.round(r.lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(r.lhr.categories['best-practices'].score * 100),
      seo: Math.round(r.lhr.categories.seo.score * 100),
      lcpMs: Math.round(a['largest-contentful-paint'].numericValue),
      cls: Number(a['cumulative-layout-shift'].numericValue.toFixed(3)),
      tbtMs: Math.round(a['total-blocking-time'].numericValue),
      fcpMs: Math.round(a['first-contentful-paint'].numericValue),
      finalUrl: r.lhr.finalDisplayedUrl,
      viewportAudit: a['viewport'].score,
      failedA11y: Object.values(a).filter((x) => x.scoreDisplayMode === 'binary' && x.score === 0 && r.lhr.categories.accessibility.auditRefs.some((ref) => ref.id === x.id)).map((x) => x.id),
    };
    results.push(row);
    console.log(row.page.padEnd(10), row.mode.padEnd(8), `P${row.performance} A${row.accessibility} BP${row.bestPractices} SEO${row.seo}  LCP ${row.lcpMs}ms CLS ${row.cls} TBT ${row.tbtMs}ms`, row.finalUrl.replace(/^https?:\/\/[^/]+/, ''));
  }
}
fs.writeFileSync(path.join(ensureDir(path.join(artifacts, run)), only ? 'lighthouse-' + only + '.json' : 'lighthouse.json'), JSON.stringify(results, null, 2));
await ctx.close();
