// Quick look: screenshots chosen pages at chosen viewports, with an optional click first, and prints overflow.
//   RESP_BASE_URL=http://demo.localhost:3101 node responsive/shot.mjs --paths dashboard/members --viewports 390x844 --click "Disable" --name sheet
import path from 'node:path';
import { artifacts, baseURL, password, viewports, loadPlaywright, ensureDir } from './lib/config.mjs';
import { INIT_SCRIPT, measure, settle } from './lib/page-tools.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const paths = arg('paths', 'dashboard').split(',');
const vps = arg('viewports', '390x844').split(',').map((n) => viewports.find((v) => v.name === n));
const click = arg('click');
const name = arg('name', 'look');
const out = ensureDir(path.join(artifacts, 'verify', name));
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const login = await browser.newContext({ baseURL, serviceWorkers: 'block' });
const lp = await login.newPage();
await lp.goto('/auth/login'); await lp.waitForLoadState('networkidle'); await lp.waitForTimeout(2500);
await lp.locator('#email').fill(arg('email', 'admin@demo.com')); await lp.locator('#password').fill(password);
await lp.locator('button[type="submit"]').click(); await lp.waitForURL(/\/(dashboard|onboarding)/, { timeout: 90000 });
const state = await login.storageState(); await login.close();
for (const vp of vps) {
  const ctx = await browser.newContext({ baseURL, storageState: state, serviceWorkers: 'block', viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1024, reducedMotion: 'reduce' });
  await ctx.addInitScript(INIT_SCRIPT);
  for (const p of paths) {
    const page = await ctx.newPage();
    await page.goto('/' + p, { waitUntil: 'domcontentloaded', timeout: 120000 }); await settle(page);
    if (click) { await page.getByRole('button', { name: new RegExp(click, 'i') }).first().click({ timeout: 8000 }).catch((e) => console.log('click failed', e.message.split('\n')[0])); await page.waitForTimeout(700); }
    const m = await page.evaluate(measure);
    const file = path.join(out, `${vp.name}-${p.replace(/\//g, '__')}.png`);
    await page.screenshot({ path: file, fullPage: !click });
    console.log(vp.name.padEnd(9), p.padEnd(34), `overflow ${m.overflowPx}px`, `smallInputs ${m.smallInputs}/${m.inputs}`, m.offenders[0] ? `culprit ${m.offenders[0].el} "${m.offenders[0].text}"` : '', file);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
