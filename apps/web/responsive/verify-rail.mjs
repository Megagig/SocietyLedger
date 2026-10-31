// Behaviour checks for the tablet icon rail (768-1023px) and the unchanged phone and desktop navigation.
//   RESP_BASE_URL=http://demo.localhost:3101 node responsive/verify-rail.mjs
import path from 'node:path';
import { artifacts, baseURL, password, loadPlaywright, ensureDir } from './lib/config.mjs';
import { INIT_SCRIPT, settle } from './lib/page-tools.mjs';

const { chromium } = loadPlaywright();
const out = ensureDir(path.join(artifacts, 'verify', 'rail-behaviour'));
const browser = await chromium.launch();
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

const login = await browser.newContext({ baseURL, serviceWorkers: 'block' });
const lp = await login.newPage();
await lp.goto('/auth/login'); await lp.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await lp.waitForTimeout(2500);
await lp.locator('#email').fill('admin@demo.com'); await lp.locator('#password').fill(password);
await lp.locator('button[type="submit"]').click(); await lp.waitForURL(/\/dashboard/, { timeout: 90000 });
const state = await login.storageState(); await login.close();

const aside = (page) => page.locator('#app-sidebar');
const width = async (page) => Math.round((await aside(page).boundingBox())?.width ?? 0);
const labelVisible = (page, text) => page.locator('#app-sidebar').getByText(text, { exact: true }).first().isVisible().catch(() => false);

for (const w of [768, 820, 1024, 390]) {
  const ctx = await browser.newContext({ baseURL, storageState: state, serviceWorkers: 'block', viewport: { width: w, height: w === 390 ? 844 : 1024 }, hasTouch: w < 1024, reducedMotion: 'reduce' });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = await ctx.newPage();
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 120000 }); await settle(page);
  const tag = `${w}px`;
  const bottomNav = await page.locator('nav[aria-label="Primary"]').isVisible().catch(() => false);

  if (w >= 768 && w < 1024) {
    check(`${tag}: sidebar is a 72px rail`, (await width(page)) === 72, `(${await width(page)}px)`);
    check(`${tag}: rail shows icons only (no "Members" label)`, !(await labelVisible(page, 'Members')));
    check(`${tag}: no bottom navigation on a tablet`, !bottomNav);
    const content = await page.locator('main').boundingBox();
    check(`${tag}: page content starts beside the rail`, content.x >= 70 && content.x <= 76, `(x=${Math.round(content.x)})`);
    const named = await page.locator('#app-sidebar nav a[aria-label], #app-sidebar nav button[aria-label]').count();
    check(`${tag}: every rail item has a name`, named >= 8, `(${named} named items)`);
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('#app-sidebar nav a, #app-sidebar nav button')].filter((e) => !e.getAttribute('aria-label') && !(e.textContent || '').trim()).length);
    check(`${tag}: no unnamed item`, unnamed === 0, `(${unnamed})`);
    const small = await page.evaluate(() => [...document.querySelectorAll('#app-sidebar nav a, #app-sidebar nav button')].filter((e) => e.offsetParent !== null).filter((e) => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length);
    check(`${tag}: rail items are at least 44x44`, small === 0, `(${small} smaller)`);
    await page.screenshot({ path: path.join(out, `${tag}-rail.png`) });

    // Tapping an item that has sub-pages opens the full sidebar.
    const parent = page.locator('#app-sidebar nav button[aria-label]').first();
    await parent.click(); await page.waitForTimeout(500);
    check(`${tag}: tapping a parent item opens the full sidebar`, (await width(page)) === 288, `(${await width(page)}px)`);
    check(`${tag}: labels show when it is open`, await labelVisible(page, 'Members') || (await page.locator('#app-sidebar nav').innerText()).length > 40);
    await page.screenshot({ path: path.join(out, `${tag}-open.png`) });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    check(`${tag}: Escape returns to the rail`, (await width(page)) === 72, `(${await width(page)}px)`);

    // The menu button toggles it too.
    await page.locator('button[aria-controls="app-sidebar"]').click(); await page.waitForTimeout(400);
    const opened = (await width(page)) === 288;
    await page.locator('button[aria-controls="app-sidebar"]').click(); await page.waitForTimeout(400);
    check(`${tag}: the menu button opens and closes it`, opened && (await width(page)) === 72);

    // A leaf item navigates and the sidebar stays a rail.
    await page.locator('#app-sidebar nav a[aria-label="Members"]').first().click();
    await page.waitForURL(/\/dashboard\/members/, { timeout: 60000 }); await settle(page);
    check(`${tag}: a leaf item navigates and the rail stays a rail`, (await width(page)) === 72);
    check(`${tag}: no sideways scroll on Members`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);
  } else if (w >= 1024) {
    check(`${tag}: full 288px sidebar with labels`, (await width(page)) === 288 && (await page.locator('#app-sidebar nav').innerText()).length > 40, `(${await width(page)}px)`);
    check(`${tag}: no bottom navigation`, !bottomNav);
  } else {
    check(`${tag}: phone keeps its bottom navigation`, bottomNav);
    check(`${tag}: phone sidebar is hidden until opened`, (await aside(page).evaluate((el) => getComputedStyle(el).visibility)) === 'hidden');
    await page.getByRole('link', { name: 'Menu' }).click(); await page.waitForTimeout(500);
    check(`${tag}: Menu tab opens the full 288px drawer`, (await width(page)) === 288, `(${await width(page)}px)`);
  }
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
