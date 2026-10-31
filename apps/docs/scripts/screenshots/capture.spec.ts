import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { authDir, captureInstant } from './constants';
import { flows } from './flows';

const sectionFilter = process.env.SCREENSHOT_SECTION;
const publicImagesDir = path.join(__dirname, '..', '..', 'public', 'images');

for (const flow of flows) {
  if (sectionFilter && flow.section !== sectionFilter) continue;

  test.describe(flow.section, () => {
    for (const shot of flow.shots) {
      test(shot.name, async ({ browser, viewport, colorScheme }, testInfo) => {
        const context = await browser.newContext({
          storageState: path.join(authDir, `${shot.role}.json`),
          viewport,
          colorScheme,
        });

        // Freeze the clock before any page script reads it, so relative-time
        // text ("3 days ago") matches the seeded demo data's fixed dates
        // (seed-demo.md) instead of drifting with the real wall clock.
        await context.clock.install({ time: shot.instant ?? captureInstant });
        // The app keeps its theme in localStorage and does not follow the browser's setting, so the light and dark shots set it themselves.
        await context.addInitScript((scheme) => {
          try {
            localStorage.setItem('theme', scheme);
          } catch {
            /* storage unavailable: the app falls back to its default */
          }
        }, colorScheme ?? 'light');

        const page = await context.newPage();
        await page.goto(shot.url);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500); // let the page become interactive
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addStyleTag({
          // Hides anything the app marks as unstable for a deterministic
          // capture (toasts, live clocks, etc.); `mask` below is the same
          // convention for things that must stay on-screen but shouldn't
          // be compared pixel-for-pixel. `apps/web` doesn't mark anything
          // with `data-volatile` yet — add it there (dashboard toasts are
          // the likely first case) if a capture turns out non-deterministic
          // despite the frozen clock below.
          content: '[data-volatile="hide"] { visibility: hidden !important; }',
        });
        await shot.prepare?.(page);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1200);

        if (shot.fullPage) {
          // The sidebar is fixed to the window, so a plain full-page capture leaves it cut off halfway. Fit the window to the page instead.
          const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
          await page.setViewportSize({ width: viewport?.width ?? 1280, height: Math.min(Math.max(height, viewport?.height ?? 800), 2600) });
          await page.waitForTimeout(800);
        }

        const png = await page.screenshot({
          mask: [page.locator('[data-volatile="mask"]')],
          clip: shot.clip,
        });
        const light = await sharp(png).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();

        const isDark = testInfo.project.name.endsWith('dark');
        const isPhone = testInfo.project.name.startsWith('phone');
        const suffix = `${isPhone ? '-phone' : ''}${isDark ? '-dark' : ''}`;
        const outPath = path.join(publicImagesDir, flow.section, `${shot.name}-1${suffix}.webp`);

        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, light);
        testInfo.attach(path.basename(outPath), { path: outPath, contentType: 'image/webp' });

        await context.close();
      });
    }
  });
}
