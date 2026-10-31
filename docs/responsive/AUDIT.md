# Responsive audit: SocietyLedger web app (Stage 1)

Branch `responsive-pwa`, taken 2026-10-31. **No application behaviour was changed to produce this report.** The only edit to app files is one line in `apps/web/next.config.js` (`distDir` reads `NEXT_DIST_DIR`, default `.next`), so the audit could build without overwriting a running dev server.

Evidence lives in `apps/web/responsive/artifacts/baseline/` (not committed: about 1 GB of screenshots, listed in `.gitignore`). Paths below are relative to that folder. `summary.md` there holds the full machine-generated numbers.

## 1. What was captured

| Pass | Coverage | Captures |
|---|---|---|
| Admin, signed in | all 198 app routes (49 dynamic, each resolved to one seeded record) x 14 viewports | 2,772 |
| Public and auth pages | 38 routes x 14 viewports | 532 |
| Other roles (treasurer, secretary, member, Ajo officer, collector, saver) | every static app route x 320, 390, 768, 1440 | 3,720 |
| "Installed-app mode" (see the correction below) | 8 shell pages x 14 viewports | 112 |
| Opened states | mobile menu, bottom-nav Menu, bell, confirm modal, create modals, date picker, select, error, loading, offline x 5 viewports | 88 |

Every capture also records layout metrics (horizontal overflow and the elements causing it, tap targets under 44px, inputs under 16px, tables, dialogs taller than the viewport). Zero captures failed to load.

**Seed data:** 138 members, a 92-character association name, member names up to 45 characters, e-mails up to 85 characters, amounts from N7.00 to N99,999,999.99 including N12,345,678.90, 80 notifications per login, Ajo circles and collector thrift.

### Not captured, and why
- **Real device behaviour:** on-screen keyboard, rotation, pull-to-refresh, safe-area insets, true "Add to Home Screen" installs. (Correction, 2026-11-01: Chromium can emulate a notch and home indicator, and the later device checks did; Safari and real hardware are what only a real phone can show. See `DEVICE-CHECKLIST.md`.)
- **CORRECTION (2026-11-01): the 112 "installed-app mode" captures were not in installed-app mode.** Chromium's media emulation ignores `display-mode`, so they are ordinary browser captures. A real standalone context is available in a headed `--app` window, and the later `verify-device.mjs` checks use it (notch, home indicator, light-theme status bar band). The first report text saying "emulated through the media query" was wrong.
- **Blog post, category and tag detail pages:** no posts exist in the scratch database, so they redirect to `/blog`. `/documentation` redirects to the separate docs site.
- **Guarantor and circle-verify pages:** captured with placeholder tokens, so they show their "invalid link" state, not the real page.
- **Empty states:** only where the seed data is naturally empty (for example the payment-methods donut). I did not build a second, empty association.
- **Loading state:** my 6-second delay on the dashboard endpoint did not produce a visible loading state (data arrived from cache); the members delay was not inspected in detail.
- **Home page `/` in Lighthouse:** the production build answers that request with `304` even without a conditional header, and Lighthouse reports `FAILED_DOCUMENT_REQUEST`. Browsers and Playwright load it fine (200). `/pricing` stands in as the public page.
- **Roles:** the six non-admin roles were not run at all 14 viewports (it would be about 20,000 more screenshots). Admin has the full matrix.

## 2. Baseline of the existing checks (already failing items are not this work's fault)

| Check | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | passes |
| Jest | 19 suites, 106 tests, all pass |
| Lint (`next lint`) | **fails, pre-existing**: 2 errors (`react/no-unescaped-entities`) and 58 warnings (49 `exhaustive-deps`, 4 `no-img-element`) |
| Production build (`next build`) | passes. Note `next.config.js` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so the build does not enforce either. First-load JS shared by all pages: 88 kB |
| Web end-to-end tests | **none exist** for `apps/web` (only `apps/admin` and `apps/docs` have Playwright) |
| Dev-server console | the `[PWA] Service worker registration failed` error in the captures is caused by the harness blocking service workers; it is not an app bug |

### Lighthouse (scratch production build on localhost, no HTTPS or CDN; use as a relative baseline, not absolute truth)
Local runs are noisy (TBT especially). Treat a drop of more than about 5 points as a signal.

| Page | Mode | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| /pricing | mobile | 66 | 88 | 100 | 100 | 2.8 s | 0 | 6,559 ms |
| /pricing | desktop | 72 | 88 | 100 | 100 | 0.35 s | 0 | 900 ms |
| /auth/login | mobile | 55 | 82 | 79 | 63 | 1.9 s | **0.408** | 1,442 ms |
| /auth/login | desktop | 98 | 82 | 78 | 63 | 0.5 s | 0.085 | 44 ms |
| /dashboard | mobile | 68 | 80 | 79 | 100 | 2.4 s | 0.025 | 5,128 ms |
| /dashboard | desktop | 76 | 86 | 78 | 100 | 0.7 s | 0.052 | 577 ms |
| /dashboard/members | mobile | 61 | **68** | 79 | 63 | 2.3 s | 0.173 | 7,742 ms |
| /dashboard/members | desktop | 78 | 77 | 78 | 63 | 0.7 s | 0.011 | 494 ms |

## 3. Findings

### Broken
**B1. Horizontal page scroll on phones: 30 routes.** 128 of 7,136 captures overflow the viewport. None at 1280px and wider. 25 routes overflow at 320px, 10 at 360, 8 at 375, 6 at 390, 3 at 430. Worst offenders (narrowest viewport, worst overflow):

| Route | Narrowest | Worst | Cause |
|---|---|---|---|
| /dashboard/members/invite | 320 | +131 px | "N selected / Send Invites" button row does not wrap |
| /dashboard/finance/levies/[id] | 320 | +198 px | "Close campaign" action row |
| /dashboard/settings/accounting-integration | 320 | +116 px | stat block (Total / Synced / Unsynced) |
| /dashboard/notifications | 320 | +98 px | date-range row ("to") does not wrap, also at 1024 |
| /pricing | 320 | +94 px | N30,000.00 price beside the label |
| /dashboard/finance/transactions/[id] | 320 | +59 px | long e-mail in a definition list does not break |
| /auth/verify-email | 320 | +56 px | six fixed-width code boxes |
| /dashboard/finance, /finance/overview | 320 | +52 px | unidentified wide element |
| /dashboard/finance/member-ledger/[memberId] | 320 | +41 px | "Sync Ledger / Export PDF" row |
| /dashboard/finance/transactions/create | 320 | +35 px | "Bulk Assignment" button row |
| /dashboard/notifications/archive | 320 | +35 px | pagination row |
| /about, /contact, /dashboard/member/my-profile, /dashboard/governance/elections/[id], and about 12 more | 320 | +1 to +30 px | button or heading rows |
| /dashboard/subscription/plans, /checkout, /, /dashboard/finance/levies, /donations | **768-1024** | +19 to +24 px | the "/month" price label; "Create Levy" and "Create Category" button rows |

Most common culprits: a `flex items-center gap-2` button or row with no `flex-wrap` (37 + 22 captures), the "/month" price span (30), fixed-width inputs (12).

**B2. Tablets get the phone layout.** The sidebar switches at `lg` (1024px). At 768, 820 and the 844px landscape phone the app shows the hamburger and bottom nav, and the four KPI cards sit in one cramped row. In the dashboard the total revenue loses its decimals (`N3,150,000.` at 768, `N3,150,000.0` at 844), which breaks the money-in-full rule. Evidence: `browser/admin/768x1024/dashboard.png`, `browser/admin/844x390/dashboard.png`.

**B3. Wide tables clip without any visible hint.** 21 routes have a table of 5 or more columns; all sit inside a scroll container, so nothing breaks, but the right-hand columns are cut off and nothing says to scroll. Example: the Login column on Members at 1440px (`browser/admin/1440x900/dashboard__members.png`); on phones the same pattern hides Status, Category and Login. Routes include Ajo members, accountability and reports (7-8 columns), payments verification (7), reports/charges (7), expenses, levies/[id], loan detail.

**B4. Drawer header collides with its own controls.** On phones the open drawer's association name runs under the close button and the notification bell, and at 568px tall the nav list is cut off after "My Meetings" with Theme and Logout pinned below it. Evidence: `interactions/390x844/mobile-menu-button.png`, `interactions/320x568/...`.

**B5. Layout shift on the login page (CLS 0.408 on mobile).** A real Lighthouse finding, 4 times the "good" limit.

### Poor
**P1. Tap targets under 44x44.** 3,011 of the phone captures have at least one. Repeated on every page: the hamburger button (2,886 captures), the header icon buttons (2,961), footer links (3,060), the Mantine pagination and tab buttons (450 + 165). Measured examples on Members at 390px: hamburger 42x49, theme toggle 38x45, "Help for this page" icon 28x28, footer links 16px high.

**P2. Inputs under 16px: iOS will zoom on focus.** 855 of 1,333 phone captures with inputs have at least one. Affects nearly every filter bar and form (transactions 7 of 7, meetings, accounting, communications, quick-send).

**P3. No tablet navigation.** Nothing between "drawer" and "full 288px sidebar". Your spec asks for a collapsible or icon-only sidebar.

**P4. Large screens stretch.** At 1920 and 2560 the content spans the whole width, with very wide KPI cards and long empty rows. No max-width container (`browser/admin/2560x1440/dashboard.png`).

**P5. The sidebar gives the association name up to 6 lines** at every width, pushing navigation down the page (the seed's 92-character name is an extreme, but a 40-character name still wraps to 3).

**P6. Modals are centred dialogs on phones**, not bottom sheets or full screen (Mantine `Modal` in about 103 files). The confirm dialog is usable; long create forms need the sticky header and footer treatment you asked for.

**P7. Raw `<table>` in 86 files with no shared table component** in the web app (the admin app has a `DataTable`). The phone strategy (cards vs scroll container) has to be applied per table; this is the largest piece of Stage 2.

**P8. About 53 files use `min-h-screen` or `h-screen`; only 4 use `dvh`/`100vh` handling.** Mobile browser bars will clip full-height layouts. The `pb-safe` helper and safe-area utilities exist in `globals.css` and the bottom nav uses `pb-safe`.

### Polish
- **Raw colour classes in the shell** (`bg-white dark:bg-gray-900` in `BottomNav`, `AuthenticatedLayout`, `text-gray-*` elsewhere) break the project's no-raw-colour rule. Not a responsive issue; I will only touch these lines where I am already editing them, and list them as a follow-up.
- The header and the bell float over page content on phones with no background band.
- "Admin View / Member View" pill sits outside the content column at 1440+.
- Revenue chart rendered blank at 768 and filled at 844 in the capture. That is probably the chart's animation (so possibly a capture artefact); I will re-check it in Stage 2 before calling it a bug.
- The Members KPI cards, the search box placeholder ("Search by name, email, phone, or...") and "All Logins" select truncate on 390px.

## 4. PWA, viewport and accessibility settings

| Item | Today | Proposal | Needs your approval |
|---|---|---|---|
| Viewport meta | `maximum-scale=1`, `user-scalable=no` (`src/app/layout.tsx`) | remove both; the 16px input rule stops iOS auto-zoom | **yes** |
| Manifest `orientation` | `portrait-primary` | remove, so landscape works | **yes** |
| `theme_color` | manifest `#0F172A`; layout light `#ffffff`, dark `#0f172a` | align them, so the status bar matches the theme in both modes | **yes** (it is the colour of your installed app's status bar) |
| Icons | 192, 512 and 192/512 maskable present | no change; verify maskable safe area | no |
| Service worker | fixed cache names `societyledger-v2`; precaches `/` and `/dashboard`; has an `UpdatePrompt` component | confirm new CSS and JS reach users after a deploy; bump cache versions only if the update flow does not do it | no change to data caching |
| Safe areas | `viewport-fit=cover`; `pb-safe`, top/left/right helpers in `globals.css` | audit where the header and drawer use them | no |

## 5. Shared components whose fix reaches many pages

| Component | Pages reached | Fixes |
|---|---|---|
| `components/layout/Sidebar.tsx`, `AuthenticatedLayout.tsx`, `Header.tsx` | every signed-in page | B2, B4, P1 (hamburger), P3, P4, P5, P8; add focus trap and Escape to the drawer if absent |
| `components/mobile/BottomNav.tsx` | every signed-in page on phones | keep; add "More" opening the drawer (verify what "Menu" does today), tap targets |
| Raw `<table>` (86 files) | about 60 pages | B3, P7: scroll container with fade edge and sticky first column, or stacked cards per table |
| Mantine `Modal` (about 103 files) | many | P6: `fullScreen` or bottom sheet below `sm`, sticky header and footer |
| Button rows (`flex items-center gap-2` without wrap) | the 30 overflow routes | B1 |
| Form inputs (Tailwind `px-3 py-2 border` classes, Mantine inputs) | nearly every form | P2: 16px on small screens, `inputmode`, full-width buttons |
| Dashboard KPI cards and charts | dashboards, finance, reports | B2 money truncation, 4/2/1 reflow |
| `Footer.tsx` | public pages and the app | P1 footer link targets |
| `components/common`, `EmptyState`, `ErrorDisplay` | many | check at 320px |

## 6. Admin app and docs site (listed only; no changes without your approval)
- **Admin (`apps/admin`, admin.societyledger.com.ng):** Next.js, 41 pages, its own `AppShell`, `DataTable`, `FilterBar`, `StatCard`, `PageHeader`, `ConfirmDestructive`. It already has a shared `DataTable`, so a table fix would be one place. Playwright is already installed. **Not captured.**
- **Docs (`apps/docs`):** Fumadocs, 252 MDX pages, 2 route files, Playwright installed. The docs framework ships its own responsive layout. **Not captured.**

Say the word and I will run the same capture on either; it is about an hour each.

## 7. Proposed Stage 2 order (after approval)
1. Shell: sidebar and drawer (focus trap, Escape, close on navigate), tablet icon-only sidebar, header, bottom nav "More", safe areas, `dvh`, large-screen max-width.
2. Shared pieces: button-row wrapping (B1), inputs at 16px and `inputmode`, tap targets, modals as sheets.
3. Tables: scroll container with edge fade and sticky first column as the default, stacked cards where the table is short.
4. KPI cards, charts, money in full.
5. Per-page leftovers from the 30 overflow routes; public pages.
6. PWA settings you approve; service-worker update flow check.
7. Overflow test at 320, 375, 768, 1024, 1440 across every route, axe, e2e flows at phone, tablet and desktop, visual diff, Lighthouse; `RESPONSIVE.md`; tracker and registry updates.

## 8. Decisions needed from you
1. Approve moving to Stage 2 on this plan.
2. Remove `maximum-scale=1, user-scalable=no` from the viewport meta.
3. Remove the manifest's `orientation` lock, and align `theme_color` (which colour should the installed app's status bar use in light mode: `#ffffff` or `#0F172A`?).
4. Tablet navigation (768-1023px): an icon-only sidebar that expands on tap. This is new behaviour, and desktop is unchanged.
5. Max content width on very large screens: 1440px, 1536px or 1680px? (Desktop up to 1440 stays as it is.)
6. Add `@playwright/test` and `@axe-core/playwright` as `apps/web` devDependencies (a full `pnpm install`, which touches `pnpm-lock.yaml` and needs your dev servers stopped while it runs).
7. Capture the admin app and docs site too, or leave them?
