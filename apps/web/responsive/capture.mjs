// Responsive audit capture: logs in per role, visits routes at each viewport, saves full-page screenshots and layout metrics.
// Resumable (skips finished jobs). Never changes the app.
//
//   node responsive/capture.mjs --run baseline --pass admin
//   node responsive/capture.mjs --run baseline --pass public
//   node responsive/capture.mjs --run baseline --pass roles
//   node responsive/capture.mjs --run baseline --pass standalone
// Options: --concurrency 4  --viewports 320x568,1440x900  --filter /dashboard/members  --limit 20  --roles admin,member
import fs from 'node:fs';
import path from 'node:path';
import {
  artifacts, baseURL, publicBaseURL, password, viewports, roles, loadPlaywright, ensureDir,
} from './lib/config.mjs';
import { buildRoutes } from './routes.mjs';
import { INIT_SCRIPT, measure, settle } from './lib/page-tools.mjs';

const { chromium } = loadPlaywright();

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']] : acc), []),
);
const run = args.run ?? 'baseline';
const pass = args.pass ?? 'admin';
const concurrency = Number(args.concurrency ?? 4);
const outRoot = ensureDir(path.join(artifacts, run));
const authDir = ensureDir(path.join(artifacts, 'auth'));
const metricsFile = path.join(outRoot, `metrics-${pass}.jsonl`);

const params = JSON.parse(fs.readFileSync(path.join(artifacts, 'params.json'), 'utf8'));
const routes = buildRoutes().filter((r) => !(args.filter && !r.template.includes(args.filter)));

const wantedViewports = (args.viewports ? args.viewports.split(',') : viewports.map((v) => v.name))
  .map((n) => viewports.find((v) => v.name === n)).filter(Boolean);

const slugOf = (p) => (p === '/' ? 'root' : p.replace(/^\//, '').replace(/[\/?&=]+/g, '__'));

async function login(browser, role, email) {
  const file = path.join(authDir, `${role}.json`);
  if (fs.existsSync(file)) return file;
  const ctx = await browser.newContext({ baseURL, serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await ctx.storageState({ path: file });
  console.log(`logged in: ${role} -> ${new URL(page.url()).pathname}`);
  await ctx.close();
  return file;
}

const queue = [];
const done = new Set();
if (fs.existsSync(metricsFile)) {
  for (const line of fs.readFileSync(metricsFile, 'utf8').split('\n').filter(Boolean)) done.add(JSON.parse(line).key);
}

function addJob(job) {
  job.key = `${job.role}|${job.vp.name}|${job.standalone ? 'sa' : 'br'}|${job.state ?? 'default'}|${job.path}`;
  if (!done.has(job.key)) queue.push(job);
}

const rolesWanted = args.roles ? args.roles.split(',') : null;
if (pass === 'admin') {
  for (const r of routes.filter((x) => x.area === 'app')) for (const vp of wantedViewports) addJob({ role: 'admin', path: params[r.template], template: r.template, vp });
} else if (pass === 'public') {
  for (const r of routes.filter((x) => x.area === 'public')) for (const vp of wantedViewports) addJob({ role: 'anon', path: params[r.template], template: r.template, vp });
} else if (pass === 'roles') {
  const vps = ['320x568', '390x844', '768x1024', '1440x900'].map((n) => viewports.find((v) => v.name === n));
  const staticApp = routes.filter((x) => x.area === 'app' && !x.params.length);
  for (const { role } of roles.filter((x) => x.role !== 'admin' && (!rolesWanted || rolesWanted.includes(x.role)))) {
    for (const r of staticApp) for (const vp of vps) addJob({ role, path: r.template, template: r.template, vp });
  }
} else if (pass === 'standalone') {
  // Installed-app mode is emulated with the display-mode media query. Shell pages only (nav, dashboard, a list, a form).
  const shell = ['/dashboard', '/dashboard/members', '/dashboard/members/create', '/dashboard/finance/transactions', '/dashboard/notifications', '/dashboard/settings', '/dashboard/governance/meetings', '/dashboard/ajo'];
  for (const p of shell) for (const vp of wantedViewports) addJob({ role: 'admin', path: p, template: p, vp, standalone: true });
}
const limit = args.limit ? Number(args.limit) : Infinity;
if (queue.length > limit) queue.length = limit;
console.log(`${run}/${pass}: ${queue.length} jobs to do (${done.size} already done), concurrency ${concurrency}`);

const append = (obj) => fs.appendFileSync(metricsFile, JSON.stringify(obj) + '\n');

async function worker(browser, id) {
  const contexts = new Map();
  const getContext = async (job) => {
    const k = `${job.role}|${job.vp.name}|${job.standalone}`;
    if (contexts.has(k)) return contexts.get(k);
    const opts = {
      baseURL: job.role === 'anon' && !job.path.startsWith('/auth') ? publicBaseURL : baseURL,
      serviceWorkers: 'block',
      viewport: { width: job.vp.width, height: job.vp.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      hasTouch: job.vp.width < 1024,
      isMobile: false,
    };
    if (job.role !== 'anon') opts.storageState = path.join(authDir, `${job.role}.json`);
    const ctx = await browser.newContext(opts);
    await ctx.addInitScript(INIT_SCRIPT);
    contexts.set(k, ctx);
    return ctx;
  };

  while (queue.length) {
    const job = queue.shift();
    const started = Date.now();
    const rec = { key: job.key, role: job.role, template: job.template, path: job.path, viewport: job.vp.name, standalone: Boolean(job.standalone), state: job.state ?? 'default' };
    let page;
    try {
      const ctx = await getContext(job);
      page = await ctx.newPage();
      const consoleErrors = [];
      const failed = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
      page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message).slice(0, 160)));
      page.on('response', (res) => { if (res.status() >= 400 && failed.length < 6) failed.push(`${res.status()} ${new URL(res.url()).pathname}`); });
      if (job.standalone) {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] });
      }
      const resp = await page.goto(job.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      rec.status = resp ? resp.status() : null;
      await settle(page);
      rec.finalPath = new URL(page.url()).pathname;
      rec.redirected = rec.finalPath !== job.path.split('?')[0];
      Object.assign(rec, await page.evaluate(measure));
      rec.consoleErrors = consoleErrors.length;
      rec.consoleSamples = consoleErrors.slice(0, 2);
      rec.failedRequests = failed;
      const dir = ensureDir(path.join(outRoot, pass === 'standalone' ? 'standalone' : 'browser', job.role, job.vp.name));
      rec.shot = path.relative(artifacts, path.join(dir, `${slugOf(job.path)}.png`)).split(path.sep).join('/');
      await page.screenshot({ path: path.join(artifacts, rec.shot), fullPage: true, timeout: 60000 });
    } catch (e) {
      rec.error = String(e.message).split('\n')[0].slice(0, 200);
    } finally {
      rec.ms = Date.now() - started;
      append(rec);
      if (page) await page.close().catch(() => {});
    }
  }
  for (const c of contexts.values()) await c.close().catch(() => {});
}

const browser = await chromium.launch();
const roleList = pass === 'public' ? [] : [...new Set(queue.map((j) => j.role))];
for (const role of roleList) await login(browser, role, roles.find((r) => r.role === role).email);
const t0 = Date.now();
await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(browser, i)));
await browser.close();
console.log(`finished in ${Math.round((Date.now() - t0) / 1000)}s`);
