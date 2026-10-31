// Behaviour checks for the phone drawer (open from the bottom nav, Escape, focus trap, close on navigate, tap target size).
//   RESP_BASE_URL=http://demo.localhost:3101 node responsive/verify-shell.mjs [--out shell]
import path from 'node:path';
import { artifacts, baseURL, password, loadPlaywright, ensureDir } from './lib/config.mjs';
import { INIT_SCRIPT, settle } from './lib/page-tools.mjs';

const { chromium } = loadPlaywright();
const outIdx = process.argv.indexOf('--out');
const out = ensureDir(path.join(artifacts, 'verify', outIdx > 0 ? process.argv[outIdx + 1] : 'shell'));
const browser = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

// Phone widths only: from 768px the sidebar is an icon rail with no bottom bar (verify-rail.mjs covers that).
for (const vp of [{ w: 320, h: 568 }, { w: 390, h: 844 }, { w: 667, h: 375 }]) {
  const ctx = await browser.newContext({ baseURL, serviceWorkers: 'block', viewport: { width: vp.w, height: vp.h }, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = await ctx.newPage();
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.locator('#email').fill('admin@demo.com');
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  await settle(page);
  const tag = `${vp.w}x${vp.h}`;
  const aside = page.locator('#app-sidebar');

  check(`${tag}: closed drawer is not focusable`, (await aside.evaluate((el) => getComputedStyle(el).visibility)) === 'hidden');
  const hb = await page.locator('button[aria-controls="app-sidebar"]').boundingBox();
  check(`${tag}: menu button is at least 44x44`, hb.width >= 44 && hb.height >= 44, `(${Math.round(hb.width)}x${Math.round(hb.height)})`);

  await page.getByRole('link', { name: 'Menu' }).click();
  await page.waitForTimeout(500);
  check(`${tag}: bottom-nav Menu opens the drawer`, await aside.isVisible() && (await aside.boundingBox()).x >= -1);
  await page.screenshot({ path: path.join(out, `${tag}-drawer-open.png`) });

  const inside = async () => page.evaluate(() => { const a = document.getElementById('app-sidebar'); const t = document.querySelector('button[aria-controls="app-sidebar"]'); const el = document.activeElement; return Boolean(el && (a.contains(el) || t === el)); });
  let trapped = true;
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if (!(await inside())) { trapped = false; break; } }
  check(`${tag}: Tab stays inside the drawer`, trapped);
  let trappedBack = true;
  for (let i = 0; i < 10; i++) { await page.keyboard.press('Shift+Tab'); if (!(await inside())) { trappedBack = false; break; } }
  check(`${tag}: Shift+Tab stays inside the drawer`, trappedBack);
  check(`${tag}: page behind does not scroll`, (await page.evaluate(() => document.body.style.overflow)) === 'hidden');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check(`${tag}: Escape closes the drawer`, !(await aside.isVisible()));

  await page.getByRole('link', { name: 'Menu' }).click();
  await page.waitForTimeout(400);
  await aside.getByRole('link', { name: /^Members$/ }).first().click().catch(async () => { await aside.locator('a[href="/dashboard/members"]').first().click(); });
  await page.waitForURL(/\/dashboard\/members/, { timeout: 30000 });
  await page.waitForTimeout(600);
  check(`${tag}: drawer closes after navigating`, !(await aside.isVisible()));
  check(`${tag}: page scrolls again after closing`, (await page.evaluate(() => document.body.style.overflow)) !== 'hidden');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${tag}: no horizontal scroll on members`, overflow <= 0, `(+${overflow}px)`);
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
