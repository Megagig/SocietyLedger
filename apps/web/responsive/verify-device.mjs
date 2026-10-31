// Emulated device checks: rotation, on-screen keyboard, notch/home-indicator insets, installed-app mode, and PWA installability.
// This is emulation in Chromium, NOT a real iPhone or Android phone (Safari/WebKit behaves differently); the manual checklist in
// docs/responsive/DEVICE-CHECKLIST.md covers what only a real device can show.
//   RESP_BASE_URL=http://demo.localhost:3101 node responsive/verify-device.mjs [--install] [--no-sw-block]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { artifacts, baseURL, password, loadPlaywright, ensureDir } from './lib/config.mjs';
import { INIT_SCRIPT, settle } from './lib/page-tools.mjs';

const { chromium, devices } = loadPlaywright();
const out = ensureDir(path.join(artifacts, 'verify', 'device'));
const results = [];
const check = (name, ok, extra = '') => { results.push(ok === 'skip' ? 'skip' : ok); console.log(`${ok === 'skip' ? 'SKIP' : ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch();

// Sign in once at a normal size, keep the session for the device contexts.
const lc = await browser.newContext({ baseURL, serviceWorkers: 'block' });
const lp = await lc.newPage();
await lp.goto('/auth/login'); await lp.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await lp.waitForTimeout(2500);
await lp.locator('#email').fill('admin@demo.com'); await lp.locator('#password').fill(password);
await lp.locator('button[type="submit"]').click(); await lp.waitForURL(/\/dashboard/, { timeout: 90000 });
const state = await lc.storageState(); await lc.close();

const phone = (name) => { const { defaultBrowserType, ...d } = devices[name]; return d; };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// ---------- A. Rotation ----------
for (const name of ['iPhone 13', 'Pixel 7']) {
  const ctx = await browser.newContext({ ...phone(name), baseURL, storageState: state, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = await ctx.newPage();
  await page.goto('/dashboard/members', { waitUntil: 'domcontentloaded', timeout: 120000 }); await settle(page);
  const portrait = page.viewportSize();
  check(`${name} portrait: no sideways scroll`, (await overflow(page)) <= 1);
  await page.getByRole('link', { name: 'Menu' }).click(); await page.waitForTimeout(500);
  check(`${name} portrait: drawer opens`, (await page.locator('#app-sidebar').boundingBox()).width === 288);
  await page.setViewportSize({ width: portrait.height, height: portrait.width }); await page.waitForTimeout(600);
  check(`${name} rotated to landscape with the drawer open: no sideways scroll`, (await overflow(page)) <= 1, `(${portrait.height}x${portrait.width})`);
  await page.screenshot({ path: path.join(out, `${name.replace(/\s/g, '')}-landscape-drawer.png`) });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  // 768px and wider gets the icon rail and no bottom bar; narrower landscape screens keep the phone layout.
  const wide = portrait.height >= 768;
  const railWidth = (await page.locator('#app-sidebar').boundingBox()).width;
  const barShown = await page.locator('nav[aria-label="Primary"]').isVisible();
  if (wide) check(`${name} landscape (${portrait.height}px) after closing: icon rail (72px), no bottom bar`, railWidth === 72 && !barShown, `(${railWidth}px)`);
  else check(`${name} landscape (${portrait.height}px, under 768) after closing: phone layout, bottom bar shown, drawer hidden`, barShown && (await page.locator('#app-sidebar').evaluate((el) => getComputedStyle(el).visibility)) === 'hidden');
  await page.setViewportSize(portrait); await page.waitForTimeout(600);
  check(`${name} back in portrait: bottom bar returns, no sideways scroll`, (await page.locator('nav[aria-label="Primary"]').isVisible()) && (await overflow(page)) <= 1);
  await ctx.close();
}

// ---------- B. On-screen keyboard over a form ----------
{
  const ctx = await browser.newContext({ ...phone('Pixel 7'), baseURL, storageState: state, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = await ctx.newPage();
  await page.goto('/dashboard/members/create', { waitUntil: 'domcontentloaded', timeout: 120000 }); await settle(page);
  const full = page.viewportSize();
  // Android resizes the page when the keyboard opens; about 55% of the height is taken by the keyboard.
  await page.setViewportSize({ width: full.width, height: Math.round(full.height * 0.45) });
  await page.waitForTimeout(400);
  const kb = page.viewportSize().height;
  const last = page.locator('form input:not([type=hidden]):not([type=checkbox]), form textarea').last();
  await last.click(); await page.waitForTimeout(400);
  const lr = await last.boundingBox();
  const bar = page.locator('nav[aria-label="Primary"]');
  check('keyboard open: the focused field is scrolled into view', lr.y >= 0 && lr.y + lr.height <= kb, `(field bottom ${Math.round(lr.y + lr.height)}, screen ${kb})`);
  check('keyboard open: the bottom bar steps out of the way', !(await bar.isVisible()));
  const submit = page.locator('button[type="submit"]').last();
  await submit.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  const covered = await page.evaluate(() => { const b = [...document.querySelectorAll('button[type="submit"]')].pop(); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, window.innerHeight - 1)); return !(b === el || b.contains(el)); });
  check('keyboard open: the submit button can be scrolled to and is not covered', !covered);
  await last.evaluate((el) => el.blur()); await page.waitForTimeout(300);
  check('keyboard closed: the bottom bar comes back', await bar.isVisible());
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(300);
  const sb = await submit.boundingBox();
  check('keyboard closed: at the end of the page the submit button sits above the bottom bar', sb.y + sb.height <= (await bar.boundingBox()).y + 1, `(button bottom ${Math.round(sb.y + sb.height)})`);
  await page.screenshot({ path: path.join(out, 'keyboard-open-form.png') });
  await ctx.close();
}

// ---------- C + D. Notch and home-indicator insets, installed-app mode, light-theme status bar ----------
{
  // Chromium cannot emulate display-mode: standalone through its media emulation, so this runs in a real app window (--app, headed): there
  // `display-mode: standalone` is genuinely true. A browser window briefly opens on this computer.
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'sl-app-')), {
    ...(({ isMobile, ...d }) => d)(phone('iPhone 13')), headless: false, args: [`--app=${baseURL}/auth/login`], serviceWorkers: 'block', reducedMotion: 'reduce',
  });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(2500);
  await page.locator('#email').fill('admin@demo.com'); await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click(); await page.waitForURL(/\/dashboard/, { timeout: 90000 }); await settle(page);
  const cdp = await ctx.newCDPSession(page);
  let insets = true;
  try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }); } catch { insets = false; }
  await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await settle(page);
  if (!insets) check('safe-area insets (47px notch, 34px home indicator)', 'skip', '(this Chromium cannot override them)');
  else {
    const m = await page.evaluate(() => {
      const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]);
      const top = document.querySelector('main > div.sticky');
      const menu = document.querySelector('button[aria-controls="app-sidebar"]');
      const bottomNav = document.querySelector('nav[aria-label="Primary"] > div');
      return { topBarPad: px(top, 'paddingTop'), menuTop: menu.getBoundingClientRect().top, bottomPad: px(bottomNav, 'paddingBottom'), standalone: matchMedia('(display-mode: standalone)').matches };
    });
    check('standalone mode is active', m.standalone);
    check('notch: top bar padding clears the 47px inset', m.topBarPad >= 47 + 11, `(${Math.round(m.topBarPad)}px)`);
    check('notch: menu button sits below the inset', m.menuTop >= 47, `(top ${Math.round(m.menuTop)}px)`);
    check('home indicator: bottom bar pads 34px', Math.round(m.bottomPad) === 34, `(${Math.round(m.bottomPad)}px)`);
    await page.getByRole('link', { name: 'Menu' }).click(); await page.waitForTimeout(500);
    const drawer = await page.evaluate(() => { const a = document.getElementById('app-sidebar'); const nav = a.querySelector('nav'); const b = a.getBoundingClientRect(); const f = a.lastElementChild.getBoundingClientRect(); return { padBottom: parseFloat(getComputedStyle(a).paddingBottom), footerBottom: f.bottom, asideBottom: b.bottom, brandTop: a.firstElementChild.getBoundingClientRect().top, brandPadTop: parseFloat(getComputedStyle(a.firstElementChild).paddingTop) }; });
    check('drawer: footer (Theme, Logout) stays above the bottom bar and home indicator', drawer.footerBottom <= drawer.asideBottom - 64 - 34 + 1, `(footer bottom ${Math.round(drawer.footerBottom)}, screen ${Math.round(drawer.asideBottom)})`);
    check('drawer: brand block clears the notch', drawer.brandPadTop >= 47 + 72 - 1, `(${Math.round(drawer.brandPadTop)}px)`);
    await page.screenshot({ path: path.join(out, 'iphone-standalone-drawer.png') });
    await page.keyboard.press('Escape');
    // Light theme: the dark band behind the translucent iOS status bar.
    await page.evaluate(() => document.documentElement.classList.remove('dark')); await page.waitForTimeout(300);
    const band = await page.evaluate(() => { const s = getComputedStyle(document.body, '::before'); return { height: s.height, position: s.position, bg: s.backgroundColor, z: s.zIndex }; });
    check('light theme in the installed app: a 47px dark band sits behind the status bar', band.height === '47px' && band.position === 'fixed', `(${band.height}, ${band.bg})`);
    await page.screenshot({ path: path.join(out, 'iphone-standalone-light-band.png'), clip: { x: 0, y: 0, width: 390, height: 140 } });
  }
  await ctx.close();
}

// ---------- E. Installability ----------
if (process.argv.includes('--install')) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 412, height: 915 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto('/auth/login', { waitUntil: 'load', timeout: 120000 }); await page.waitForTimeout(6000);
  const man = await cdp.send('Page.getAppManifest');
  const parsed = JSON.parse(man.data || '{}');
  check('manifest parses with no errors', (man.errors || []).length === 0, `(${(man.errors || []).map((e) => e.message).join('; ')})`);
  check('manifest: standalone, no orientation lock, theme and background colours', parsed.display === 'standalone' && !('orientation' in parsed) && /^#/.test(parsed.theme_color) && /^#/.test(parsed.background_color));
  const icons = parsed.icons || [];
  check('manifest: 192 and 512 icons, including maskable', ['192x192', '512x512'].every((s) => icons.some((i) => i.sizes === s)) && icons.some((i) => /maskable/.test(i.purpose || '')), `(${icons.length} icons)`);
  let iconsOk = true; for (const i of icons) { const r = await page.request.get(new URL(i.src, page.url()).href); if (r.status() !== 200 || !/image\/png/.test(r.headers()['content-type'] || '')) iconsOk = false; }
  check('manifest: every icon file loads as a PNG', iconsOk);
  let errs = [];
  try { errs = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.map((e) => e.errorId); } catch (e) { errs = ['(not available: ' + String(e.message).slice(0, 40) + ')']; }
  check('Chromium reports no installability errors', errs.length === 0, errs.length ? `(${errs.join(', ')})` : '');
  const sw = await page.request.get('/sw.js');
  check('service worker file is served', sw.status() === 200 && /javascript/.test(sw.headers()['content-type'] || ''));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => r === false).length, skipped = results.filter((r) => r === 'skip').length;
console.log(`\n${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
