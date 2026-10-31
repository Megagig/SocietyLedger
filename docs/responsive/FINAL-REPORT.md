# Responsive PWA: final report

Branch `responsive-pwa` (off `PWA`), 8 commits, 2026-10-31. Audit: `AUDIT.md`. Developer guide: `apps/web/RESPONSIVE.md`. Layout and presentation only: no API, data, state, permission, route, field-name, test-id or prop was changed.

## 1. What changed, by commit

| Commit | What |
|---|---|
| `1753013` | One config line (`NEXT_DIST_DIR`, default `.next`) so audits build into their own folder; scratch-database seed with hard-case data |
| `bd7a098` | Audit harness, baseline findings (`AUDIT.md`) |
| `1c78c0d` | **Shell:** phone drawer works (bottom-nav **Menu** tab did nothing before), focus trap, Escape, close on navigate, `invisible` when closed, 44px menu button below the status bar, `dvh`, safe areas, 1536px content cap, association name clamps to 2 lines, drawer scrolls whole in landscape |
| `e5287d2` | **Shared CSS layer:** inputs 16px/44px below `lg`, Mantine modals become bottom sheets under 640px, wide tables fade at the edge, tabular figures, long words wrap |
| `20ee7af` | **PWA (you approved):** pinch-zoom allowed, portrait lock removed, `theme-color` follows the app's own theme, dark band behind the translucent iOS status bar in the light theme |
| `27568f8` | **Horizontal scroll** fixed on about 30 routes; KPI and plan cards size their figure to the card; KPI grids 4 -> 2 -> 1 |
| `09d2434` | **Touch targets** 44px on shared controls (theme toggle, bell, help icon, breadcrumbs, footer lists, inputs, icon-only buttons) |
| `7c6f244` | Home hero fits 320px; `RESPONSIVE.md`; flows, Lighthouse A/B and overflow scripts |
| (this commit) | axe and diff tools, final report, curated screenshots, tracker and registry entries |

### Files changed in the app (38)
Shell: `components/layout/{useNavDrawer.ts (new), Sidebar, AdminSidebar, MemberSidebar, AuthenticatedLayout, Breadcrumbs, Footer}.tsx`, `components/mobile/BottomNav.tsx`. Shared controls: `ThemeToggle`, `NotificationBell`, `docs/HelpLink`. PWA: `app/layout.tsx`, `public/manifest.json`. CSS: `app/globals.css` (+125 lines, one labelled "Responsive layer" section). Pricing: `components/pricing/{PlanGrid,AddonList}.tsx`, `app/pricing/page.tsx`, `components/home/HomeContent.tsx`. Pages (wrapping, shrinking, KPI cards): about, contact, verify-email, dashboard, dashboard/admin, cooperatives, members, members/invite, finance (donations, levies, levies/[id], member-ledger/[memberId], transactions/[id], transactions/create), meetings/[id], notifications and archive, settings/accounting-integration, subscription/checkout, ajo/[groupId]/order. Almost all of these are one or two class-name edits (`flex-wrap`, `min-w-0`).

## 2. Before and after
Curated images in `docs/responsive/screenshots/` (before on the left, after on the right where side by side):

| Image | Shows |
|---|---|
| `before-bottom-nav-menu-did-nothing-390.png` / `drawer-390-open.png` | the Menu tab did nothing; now the drawer opens |
| `dashboard-390-kpi-cards.png` | cramped two-column KPI cards; now one readable column with the full amount |
| `dashboard-1024-kpi-overlap-fixed.png` | Total Revenue overflowed and the next card overlapped its icon |
| `members-invite-320-no-sideways-scroll.png` | +131px sideways scroll gone |
| `levy-detail-320-actions-wrap.png` | +198px gone; actions wrap |
| `pricing-320-price-fits.png` | +94px gone |
| `cooperatives-390-kpi-cards.png`, `verify-email-320-code-boxes.png`, `transaction-detail-320-long-email.png` | same kinds of fix |

All 1,180 before/after screenshot pairs, and side-by-side images for the pages that changed most, are in `apps/web/responsive/artifacts/after2/` (not committed: about 1 GB). `diff-report.md` there lists every page.

## 3. Results against the baseline

| Check | Baseline | After |
|---|---|---|
| Horizontal overflow, all 236 routes at 320/375/768/1024/1440 | 128 captures overflow, 30 routes | **0 of 1,180** (1px sub-pixel rounding allowed) |
| Undersized tap targets on phones (Members, Transactions at 390px) | 9 and 26 | 0 and 0 |
| Phone inputs under 16px | 855 of 1,333 captures | 0 on the pages checked |
| Typecheck, 106 Jest tests, production build | pass | pass; shared JS unchanged at 88 kB |
| Lint | fails (2 errors, 58 warnings) | unchanged, same failures |
| Drawer behaviour at 320/390/768/844 (open, Escape, Tab trap, close on navigate, 44px button) | the Menu tab did nothing | 39/40 when run; the one failure (Members overflowed 15px at 320px) was fixed in `27568f8` and the overflow sweep passes, but I did not rerun the whole drawer set afterwards |
| End-to-end at 390/768/1440: sign in, add member, record-transaction form, create meeting, open report and its export button, change settings, sign out, member circle and contribution page | not run | **33/33 pass** |
| Lighthouse, original vs current build, median of 5 alternating runs | | performance, LCP, CLS equal within noise (e.g. pricing mobile 57 -> 58); **accessibility +6 to +7 on every public page** (pricing 88 -> 94, login 82 -> 89, home 90 -> 96) |
| axe (WCAG 2 A/AA) on 9 pages at 390 and 1440 | `meta-viewport` on every page, unnamed menu button, `aria-prohibited-attr` at 390 | those are gone; one count rose by 2 nodes (Transactions at 390: color-contrast 183 -> 185): the same existing `text-red-600` amount pattern appearing on two more rows, no colour was changed |

### Visual diff (clean data, sidebar excluded from the percentage)
1440px: **184 of 236 identical**, 35 minor, 17 changed. Explained:
- **Intended:** dashboard, dashboard/admin, cooperatives (KPI cards now stack the icon above the figure, fixing the overlap); subscription plans and checkout (price sizing); every table page differs by about 2% from tabular figures (sub-pixel digit placement; compared one page crop by crop).
- **Sidebar header (every signed-in page):** a 92-character association name now takes 2 lines instead of 6; items below move up. Names that already fit in 2 lines look the same.
- **Not the app:** `/auth/login`, `/auth/register` (the baseline captured them without a tenant, the later run with one); `ai/reminders`, `/dashboard/reports` (baseline caught the loading screen); notifications and archive (my own test meetings created notifications).
- Phones and tablets: about 90% of pairs differ, as expected (menu button, bottom-nav space, input sizing, wrapping). A sample was inspected, not every image.

## 4. Deliberate desktop differences: please approve or reject
1. **KPI cards stack the icon above the figure** when the card is narrower than 20rem. At 1440px with a sidebar the cards are about 264px, so dashboard, admin and cooperatives KPI cards changed at 1024-1535px. Before, the figure overflowed.
2. **Sidebar association name clamps to two lines** (full name on hover).
3. **Page content is capped at 1536px** (nothing changes up to 1440px; wider screens centre the content).
4. **Table figures are tabular** (you asked for this).
5. **Modal sheets, 16px inputs, 44px targets** apply below 1024px only.

## 5. Not done, not verified, and decisions
- **Real devices:** keyboard over forms, rotation, pull-to-refresh, safe-area insets (cannot be emulated), installing the PWA, the dark status-bar band in the iOS light theme. Checklist: `apps/web/RESPONSIVE.md` end and `AUDIT.md`.
- **Cast a vote** and **pay dues**: not exercised. The seed has no eligible voter and no payment gateway; I confirmed the screens fit and their buttons are reachable.
- **Icon-only tablet sidebar:** not built. Tablets (768-1023px) use the working drawer. A rail means reworking three 1,000-line sidebars; say if you want it.
- **Admin app and docs site:** listed in the audit, not captured or changed.
- **Dialogs:** custom `fixed inset-0` dialogs (not Mantine) were not inventoried; they may still be taller than a short screen.
- **Tables:** all keep their columns inside a scroll container with an edge fade; none was converted to cards. Sticky first column not added.
- **Heading sizes:** only the public hero headings were made fluid.
- **Money format gaps found, not changed (formatting logic, your call):** the Reports page shows "Total Collected" as ₦3,150,000 with no decimals; chart axes show ₦300k / ₦225k (dashboard) and plain 3200000 (Financial Summary).
- **Colours:** about 50 older files use raw `gray-*` classes; left alone.
- **Loading state:** the screenshot harness did not catch a loading screen on the dashboard.
- **Service worker:** not changed. `usePWA` already has an update prompt; I did not test an update end to end. Cache names are fixed (`societyledger-v2`).
- **Harness dependencies:** Playwright and axe-core are borrowed from the pnpm store via `apps/docs`; declare them in `apps/web` if you want the overflow test in CI. The overflow test is `node responsive/overflow-sweep.mjs --all`; nothing wires it into a build yet.

## 6. Environment notes
- Twice, `node_modules/.pnpm` package folders (`next`, `react`, `postcss`, ...) ended up empty, the known Windows filtered-`pnpm install` problem. `pnpm repair:deps` fixed it both times (approved by you the first time); no lockfile or source change. Cause not found.
- Your own servers: the web dev server on 3000 was stopped (it was returning 500) and your API on 4001 was already down; neither is restarted. Expo/Metro was not touched.
- Scratch stack still running: web 3100, API 4101, database `sl_responsive`. A temporary worktree `../SocietyLedger-baseline` held the original build for the A/B tests.
