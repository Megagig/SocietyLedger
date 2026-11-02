# Memory: Responsive PWA pass, merged and deployed (2026-11-01)

Last updated: 2026-11-01

> Replaces the 2026-10-31 memory (T12 hardening, performance caching, production fixes). That work is in `context/progress-tracker.md` and git history; the still-open items are kept under "Carried over". No secrets here.

## What was built

The web app (`apps/web`) now works from 320 to 2560px, in a tab and installed. Layout and presentation only. Merged `responsive-pwa` -> `PWA` -> `develop` -> `main` as fast-forwards (16 commits); `main`, `develop`, `PWA` all at `d5228ee` and deployed.

- **Phone menu:** `components/layout/useNavDrawer.ts` shared by `AdminSidebar`, `Sidebar`, `MemberSidebar` (open from bottom-bar Menu, Escape, focus trap, scroll lock, closes after navigation). Bottom bar `components/mobile/BottomNav.tsx` shows below 768px.
- **Tablet icon rail (768-1023px):** 72px rail, full sidebar opens over the page. CSS in `globals.css` "Responsive layer"; markers `sl-rail-hide`, `sl-rail-label`, `sl-rail-item`.
- **Money in full:** `formatNairaFull` / `formatAxisNaira` in `utils/format.ts`; ~48 files converted; guard test `__tests__/format/moneyInFull.test.ts`.
- **Overflow fixes** on ~30 routes, KPI/price cards via container queries (`sl-stat*`, `sl-card`, `sl-price`), 44px touch targets, 16px inputs, bottom-sheet modals under 640px, table edge fade.
- **PWA:** pinch-zoom allowed, no orientation lock, `theme-color` follows the app theme (inline script in `app/layout.tsx`), safe-area insets, `dvh`.
- **Tooling and docs:** `apps/web/responsive/` (capture, overflow sweep, verify-shell/rail/device, flows, axe, lighthouse, diff), `apps/web/RESPONSIVE.md`, `docs/responsive/` (AUDIT, FINAL-REPORT, DEVICE-CHECKLIST, screenshots).

## Decisions made

- Remove `maximum-scale` / `user-scalable=no`; status bar follows the app theme.
- Four approved desktop differences: stacked KPI cards, sidebar association name clamped to 2 lines, 1536px content cap, tabular figures.
- Money is always full with two decimals (₦10,000.00): never 10k, never on chart axes.
- No new dependency: Playwright and axe-core are borrowed from the pnpm store; `next.config.js` only gained `distDir: process.env.NEXT_DIST_DIR || '.next'`.

## Problems solved

- Bottom-nav Menu tab was dead (toggled state the sidebars never read).
- Chromium ignores `display-mode: standalone` emulation; use a headed `--app=URL` window instead. Earlier claim otherwise was wrong and is corrected in the docs.
- `node_modules` went empty three times before builds; `pnpm repair:deps` fixes it. Cause still unexplained.
- Never run `robocopy /MIR` or bulk-delete through links/worktrees: it wiped `apps/` and `packages/` once (see Claude memory feedback). Lost for good: `.env.dokploy.bak`.
- Windows: Git Bash rewrites leading-slash args (`MSYS_NO_PATHCONV=1`); working copy has CRLF while the repo stores LF (`core.autocrlf=true`, no `.gitattributes`).

## Current state

- On `develop`, in sync with `origin/develop` and `main`. Local `responsive-pwa` deleted; `PWA` branch still exists.
- `git status` lists ~19 files as modified (apps/web/responsive/*, RESPONSIVE.md, three mobile components, one seed): line-ending noise only (`git diff --ignore-cr-at-eol` is empty). Fix: `git checkout --` those paths, or add `.gitattributes` with `* text=auto` (not done, awaiting the user's call).
- `memory.md` itself is modified (this file) and not committed.
- Verified before merge: typecheck, 20 suites / 111 tests, overflow sweep 1,174/1,177 (3 fixed, targeted rerun 230/230), drawer 30/30, rail 31/31, device 28/28, flows 33/33 (earlier build).

## Next session starts with

The user continues with another feature: branch off `develop` (`git switch -c <name>`), then run `/architect` for anything complex.

## Open questions

- Real iPhone/Android/Safari pass not done: `docs/responsive/DEVICE-CHECKLIST.md`.
- Not exercised: casting a vote, paying dues; full 236-route sweep not rerun after the last three fixes; before/after screenshots not regenerated after the rail and money changes.
- Rotate any secrets that were in the lost `.env.dokploy.bak`.
- Admin app Forbidden on port 3002: `apps/admin/.env.local` has the placeholder `ADMIN_IP_ALLOWLIST=your_admin_ip_allowlist`; set it empty (or `127.0.0.1,::1`) and restart. User has not decided.
- Add `.gitattributes`?

## Carried over from the 2026-10-31 memory

- Thrift/Ajo security review (`docs/thrift/security-review.md`): open findings F-1 (check production is not `FEATURE_FLAG_MODE=shadow`), F-3 (no password re-check on payout-account change/reveal), F-4 (idempotency replay does not check who asks). T12.2 failure drills and T12.3 pilot are NOT done.
- Owner to rotate `REVALIDATE_SECRET`, confirm Redis / `COOKIE_DOMAIN` / Paystack callback and webhook in production, and make one small real payment to watch the full return flow.
- Caching follow-ups: ~200 older web query keys use the old shape; ~50 web files fetch in `useEffect` outside the cache; board reads repeat a ~13-query preamble; ~160 unbounded `findMany` calls; `lib/prisma.ts` retries a failed connection for up to 12 s.
