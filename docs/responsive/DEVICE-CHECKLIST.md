# Real-device checklist (iPhone and Android)

Written for: whoever holds the phones. About 20 minutes per phone. Everything here was checked in an emulated Chromium first (`apps/web/responsive/verify-device.mjs`, 22 checks, and `verify-rail.mjs`, 31 checks). What emulation cannot show is how **Safari/WebKit**, a **real keyboard**, a **real notch** and a **real install** behave. Tick each line; write down the phone, OS and browser version for any failure.

Use a signed-in association admin on the production site (or a staging copy). Phones needed: one iPhone (Safari 17+), one Android (Chrome).

## 1. In the browser tab (both phones)
- [ ] Open the dashboard. No sideways scrolling anywhere (drag left and right).
- [ ] Tap **Menu** in the bottom bar: the sidebar slides in. Tap the dimmed area: it closes. Open it again and tap **Members**: it opens Members and closes itself.
- [ ] Pinch to zoom in on the dashboard. It zooms (it was blocked before). Pinch back out.
- [ ] Open **Members → Add Member** (a form). Tap **Last name**: the keyboard opens and the bottom bar disappears. The page does **not** zoom in on its own (iPhone). Fill the form down to the last field, then scroll to **Save**: it is not hidden behind the keyboard or the bottom bar.
- [ ] Close the keyboard: the bottom bar returns.
- [ ] Open **Members** and tap **Disable** on a member: the confirmation appears as a sheet from the bottom, readable, and the buttons are easy to hit. Cancel.
- [ ] Open **Finance → Transactions** and **Reports → Financial summary**: tables scroll sideways with a soft fade at the edge; amounts are shown in full (₦5,000.00, never 5k).
- [ ] Look at the dashboard KPI cards: each amount is complete (₦3,150,000.00) and nothing overlaps.
- [ ] Open the **Revenue** chart axis: labels read ₦300,000.00 (not ₦300k) and are not cut off.

## 2. Rotation
- [ ] On the dashboard, turn the phone sideways. No sideways scroll; the menu button is reachable; on a wide phone (about 768px or more, for example a large Android) you get the narrow icon sidebar.
- [ ] With the sidebar open, rotate to landscape and back. Nothing is stuck or cut off.
- [ ] iPhone: after rotating, the content is not hidden behind the notch or the rounded corners.

## 3. Tablet (an iPad or Android tablet, if you have one)
- [ ] Portrait: a narrow icon sidebar on the left, no bottom bar, the page beside it, amounts in full.
- [ ] Tap an icon with sub-pages (for example **Finance**): the full sidebar opens over the page. Tap outside or press the menu button: it returns to icons.
- [ ] Landscape (1024px or wider): the full sidebar is always shown, as on a laptop.

## 4. Installed app (Add to Home Screen)
iPhone: Safari → Share → **Add to Home Screen**. Android: Chrome menu → **Install app**.
- [ ] The icon on the home screen is the SocietyLedger icon (not a blank square). Android: the icon fills its circle properly (maskable).
- [ ] Open it from the home screen: no browser address bar.
- [ ] **Top edge:** the clock and battery are readable and nothing important sits under them; the menu button is below the status bar. Switch the app to the **light theme** (menu → Theme): the strip behind the status bar is dark so the clock stays readable.
- [ ] **Bottom edge (iPhone):** the bottom bar's labels are clear of the home indicator line.
- [ ] Rotate: it follows the phone (no portrait lock).
- [ ] Pull down at the top of a page: the page refreshes (or nothing happens) and the app does not break.
- [ ] Open a long modal (for example the meeting form) and scroll inside it; the page behind does not move.
- [ ] Turn on airplane mode and open a page you visited: you see saved content or the offline page, and when you reconnect it updates.
- [ ] After the next deploy: open the installed app. It picks up the new version (an "update available" prompt, or on the next open). Note which.

## 5. Report
For each failed line: phone, OS version, browser, screenshot, and the line above. The automated checks that passed in emulation are listed in `FINAL-REPORT.md` section 7.
