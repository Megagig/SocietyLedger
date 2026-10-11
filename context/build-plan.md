# Build Plan — SocietyLedger Docs Site, Admin Console & Mobile

> The full, ordered sequence of work for all three deliverables. **Always build the next unchecked item in the Master sequence below (mirrored in `progress-tracker.md`).** Never skip ahead, never build two features at once, never start a feature whose dependencies aren't done. Each feature lists its pages/screens (IDs from `project-overview.md` §6, §9.6 and §10.6), deliverables and Definition of Done.

## Master sequence
The web app is finished, so the documentation site ships **first**. The admin console (track A) comes next: it restructures the web app, so it must land before the mobile track builds on the same API and auth. The mobile app follows. Mobile-specific docs are written as mobile milestones land.

| Order | Block | Features |
|---|---|---|
| 1 | **Docs Phase D1** — Foundation | D1.1 – D1.7 |
| 2 | **Docs Phase D2** — Start & concepts | D2.1 – D2.3 |
| 3 | **Docs Phase D3** — Members & money | D3.1 – D3.5 |
| 4 | **Docs Phase D4** — Community & services | D4.1 – D4.5 |
| 5 | **Docs Phase D5** — Admin | D5.1 – D5.4 |
| 6 | **Docs Phase D6** — Reference, integration & launch | D6.1 – D6.4 → **Milestone DL: docs live** |
| 7 | **Admin Phase A1** — Backend, scaffold & shell | A1.1 – A1.7 |
| 8 | **Admin Phase A2** — Migrate platform screens | A2.1 – A2.12 |
| 9 | **Admin Phase A3** — Cutover & launch | A3.1 – A3.2 → **Milestone AL: admin live, Super Admin removed from web** |
| 10 | **Mobile Phase 0** — Backend enablement | F0.1 – F0.6 |
| 11 | **Mobile Phases 1–4** | F1.1 – F4.5 → M1, M2 |
| 12 | **Docs D7.1** — Mobile app docs (member features) | after M2 |
| 13 | **Mobile Phases 5–8** | F5.1 – F8.2 → M3 |
| 14 | **Docs D7.2** — Mobile app docs (officer features, mobile screenshots across sections) | after M3 |
| 15 | **Mobile Phase 9** — Hardening & release | F9.1 – F9.6 |

If the owner runs agents in parallel: the docs track (D) and the admin track (A) touch different apps and may run side by side, **except** D6.3 and A3.1 both edit `apps/web` — do them one after the other, D6.3 first. The mobile track starts after Milestone AL (mobile login relies on `PLATFORM_LOGIN_REQUIRED` and reserved subdomains). Each track goes strictly in order, and D7.x waits for its mobile milestone.

## How to run a feature
1. Read `progress-tracker.md` → find the next unchecked feature in the Master sequence.
2. Read its block below + the referenced screens/pages in `project-overview.md` + relevant sections of `architecture.md`, `code-standards.md`, `ui-rules.md`, `ui-registry.md` (reuse before you build).
   - **Docs features:** read the pages' "Source" routes in `apps/web` (and API controllers for rules), the migrated material listed in `project-overview.md §9.7`, then click through each flow on staging before writing.
   - **Admin migration features:** open the "From web" page(s) in `project-overview.md §10.6`, list every API call, control and rule they contain, and reproduce them in `apps/admin` before improving anything.
3. Verify every endpoint you'll call against the API controller source (request body, response shape). Note mismatches as Backend gaps.
4. Build → write tests → run `pnpm -F <app> type-check`, `pnpm -F <app> lint`, `pnpm -F <app> test` (app = `@societyledger/mobile`, `@societyledger/docs`, `@societyledger/admin`, `@societyledger/api`, `@societyledger/web`).
5. Manually check: mobile in the dev client on one iOS and one Android device, light and dark; docs and admin in Chrome + Safari at desktop and phone widths, light and dark.
6. Update `ui-registry.md` (new/changed reusable components) and tick the feature in `progress-tracker.md` with date + notes.
7. Commit: `feat(mobile): F<x.y> <title>`, `feat(admin): A<x.y> <title>`, `docs(site): D<x.y> <title>` (backend: `feat(api): …`, web: `feat(web): …`).

## Universal Definition of Done (applies to every feature)
- Type-check, lint and tests pass; no `any` added without a `// TODO(type):` justification.
- All screens implement loading (skeleton), empty, error (retry), offline, and module-locked/no-permission states where they fetch data.
- Permission-gated controls are hidden for users without the permission.
- No hard-coded colours/spacing/radii/font sizes; strings via `t()`.
- Works in light + dark, on a small screen (360×640 dp) and with OS font scale 1.3.
- Accessibility labels on icon-only buttons; touch targets ≥ 44 pt.
- `ui-registry.md` and `progress-tracker.md` updated.
- **If the feature changes anything users see that is already documented, the affected docs pages are updated in the same PR** (find them with `grep -r "<route or screen ID>" apps/docs/content`).

## Docs Definition of Done (applies to every docs content feature, D2–D7)
- Every page listed for the feature exists with valid frontmatter, `status: published`, `lastVerified` = today, `covers` filled.
- Each task page: purpose sentence, *Before you start*, numbered steps with bold UI labels and **Menu → Path**, at least one screenshot (light; dark variant where the screen differs meaningfully), *What happens next*, *Related*.
- Every step was performed on staging by the agent/author while writing; anything not reproducible is removed or logged as a QUESTION.
- Concept pages have a worked example with naira amounts; reference pages are generated where §9.6.21 says so.
- Section `index.mdx` intro + cards render; section FAQ page has ≥ 5 Q&As drawn from the section.
- `pnpm -F @societyledger/docs build`, `check:links`, `check:frontmatter` pass; coverage report shows the section's routes covered.
- Reads well on a 390-px-wide phone; no line in a table needs horizontal scroll except reference tables.
- `ui-registry.md` (new MDX components) and `progress-tracker.md` (feature + coverage table) updated.

---

## Docs Phase D1 — Foundation (apps/docs) — 7 features
*Goal: an empty but complete docs site skeleton — every section and page exists as a draft — deployed to a preview URL.*

### D1.1 Scaffold Fumadocs site in monorepo
- Create `apps/docs` with the current Fumadocs Next.js template (`pnpm create fumadocs-app`, Fumadocs MDX content source), workspace name `@societyledger/docs`, dev port 3001, static export, TypeScript strict, ESLint/Prettier; add to Turbo; verify React/Next versions resolve per app (`pnpm why react -r`) without breaking `apps/web`.
- **DoD:** `pnpm -F @societyledger/docs dev` serves `/docs`; `pnpm -F @societyledger/docs build` produces `out/`; `pnpm -F @societyledger/web build` still passes.

### D1.2 Docs theme, tokens & layout
- Apply `ui-tokens.md §14` (Fumadocs theme variables, Manrope, radii), logo, favicon, header links (Open SocietyLedger, Get the app), footer, light/dark, 404 page.
- **DoD:** no hard-coded colours outside the theme CSS; contrast checked in both themes.

### D1.3 Information architecture skeleton
- Create every section folder with `meta.json` (order, titles, icons) and **every page in `project-overview.md §9.6` as an MDX stub** with complete frontmatter (`status: draft`, `covers`, `audience`, `platforms`, `permission`, `module`) and an outline of H2s from the template for its type.
- `source.config.ts` frontmatter zod schema; `scripts/check-frontmatter.ts`.
- **DoD:** sidebar shows the full tree in preview (drafts visible with `NEXT_PUBLIC_SHOW_DRAFTS`); frontmatter check passes.

### D1.4 MDX component kit
- Build and register: `AppliesTo` (auto from frontmatter), `Callout` (note/tip/warning/danger), `Steps`/`Step`, `Screenshot` (light/dark pair, markers, zoom, `pending`), `MenuPath`, `UiLabel`, `PlatformBadge`, `PermissionNote`, `PlanNote`, `RoleTabs`, `PlatformTabs` (Web | Mobile), `StatusChip`, `CardGrid`, `Faq`, `Glossary` term tooltip, `Diagram` (SVG with caption + text alternative), `VideoEmbed` (lazy, privacy-enhanced), `Related` (from frontmatter), `Feedback`, `LastUpdated`.
- A `/docs/_kitchen-sink` draft page demonstrating every component.
- **DoD:** components in `ui-registry.md` (Docs section); keyboard + screen-reader check.

### D1.5 Search, SEO, analytics & feedback
- Static search with section grouping and synonyms; metadata per page; `sitemap.ts`, `robots.ts`; OG images; JSON-LD (TechArticle, BreadcrumbList); `llms.txt` / `llms-full.txt`; GA4 with consent defaults; `Feedback` events; outbound UTM helper.
- **DoD:** Lighthouse SEO ≥ 95 on a stub page; search returns stubs by title; GA debug view shows events.

### D1.6 Screenshot pipeline & demo association
- Seed the staging demo association (documented in `scripts/screenshots/seed-demo.md`, fictional data only); Playwright config with three logged-in roles, desktop + phone viewports, light/dark, WebP output; one sample flow (dashboard).
- **DoD:** `pnpm -F @societyledger/docs screenshots --section=reports` regenerates images deterministically (hide clocks/relative dates via fixed demo dates).

### D1.7 CI, preview deploys & hosting
- GitHub Action (§14.9 of architecture); `apps/docs/Dockerfile` + `nginx/` config; Dokploy **staging** app at `docs-staging.societyledger.com.ng` (`noindex`); Dokploy production app and domain `docs.societyledger.com.ng` created with Traefik priority above the tenant wildcard (architecture §17.3) but kept stopped until D6.4; `gen:reference` and `coverage` scripts wired (reference generator can be a stub until D6.1).
- **DoD:** PR shows a preview URL and coverage comment; broken link fails CI.

---

## Docs Phase D2 — Start & concepts — 3 features
### D2.1 Introduction & Getting started — §9.6.1 (8 pages)
Includes migrating relevant parts of `help-guides/README.md`; screenshots of signup, onboarding steps, login.
### D2.2 Core concepts & glossary — §9.6.2 (8 pages)
Includes the money-flow and member-ledger diagrams (SVG) and the glossary terms used across the site.
### D2.3 Account & security — §9.6.3 (8 pages)
Mobile-only pages (`signed-in-devices`, `app-lock-and-biometrics`) are written as `status: draft` until D7; web pages published.

## Docs Phase D3 — Members & money — 5 features
### D3.1 Member guide — §9.6.4 (16 pages)
Plain-language, member-only screenshots (demo-member role). Mobile steps added in D7.1 via `PlatformTabs`.
### D3.2 Members (officers) — §9.6.5 (10 pages)
Migrate `help-guides/members/README.md`.
### D3.3 Finance — §9.6.6 (14 pages)
Migrate `help-guides/finance/README.md`, `TRANSACTION_EDITING_UI_GUIDE.md`, `docs/finances/*`, `docs/member-finance/*`.
### D3.4 Payments & reconciliation — §9.6.7 (9 pages)
Migrate `help-guides/payments/README.md`; Paystack test-mode screenshots only.
### D3.5 Reports & exports — §9.6.9 (11 pages)
Migrate `docs/reports/*`.

## Docs Phase D4 — Community & services — 5 features
### D4.1 Meetings — §9.6.10 (8 pages) — migrate `help-guides/meetings/README.md`, `docs/meetings/*`
### D4.2 Elections & polls — §9.6.11 (9 pages) — migrate `help-guides/elections/README.md`, `docs/Elections/*`; lifecycle diagram
### D4.3 Welfare — §9.6.12 (7 pages) — migrate `docs/welfare/*`
### D4.4 Cooperatives — §9.6.13 (9 pages) — migrate `help-guides/cooperatives/README.md`, `docs/cooperative/*`; loan lifecycle diagram
### D4.5 Communication — §9.6.14 (10 pages) — migrate `help-guides/communications/README.md`, `docs/communications/*`

## Docs Phase D5 — Admin — 4 features
### D5.1 Accounting & accounting guide — §9.6.8 (15 pages) — migrate `docs/Accounting/*`; posting diagrams
### D5.2 Settings, users & roles — §9.6.16 (14 pages) — migrate `help-guides/settings|roles/README.md`, `docs/settings/*`, `docs/dynamic_rbac/*` (user-facing parts only)
### D5.3 Plan & billing — §9.6.17 (8 pages) — no prices; link to `/pricing`
### D5.4 AI assistant & help/support — §9.6.15 (6 pages) + §9.6.19 (3 pages)

## Docs Phase D6 — Reference, integration & launch — 4 features
### D6.1 Reference pages — §9.6.21
- `scripts/gen-reference.ts` generates permissions (alias → base key → plain-language description → which roles have it by default), statuses (from `schema.prisma` enums + string statuses used in controllers), payment methods; modules-by-plan from plan/module seeds (verify against production plan config with the owner); release notes page started.
### D6.2 Troubleshooting & FAQ — §9.6.20 (9 pages)
- Seed questions from support tickets categories, `gaps.md`, and section FAQs; 30-question search test list saved in `apps/docs/scripts/search-test.json`.
### D6.3 Web integration
- Web changes in `architecture.md §15.3`: header/footer links, `/documentation*` redirects with slug map, sidebar "User manual", `HelpLink` on mapped routes, Help Center card, onboarding link; `packages/shared/src/docs-links.ts`.
- **DoD:** every key in the link map resolves to a published docs page (test); redirects verified; web lint/type-check pass.
### D6.4 Launch
- Full QA pass (every page clicked on phone + desktop, both themes), zero pending screenshots, zero drafts in production (except mobile-only pages awaiting D7), Lighthouse targets, search test ≥ 90 % top-3, start the Dokploy production app on `docs.societyledger.com.ng` (verify the wildcard doesn't capture it), submit sitemap to Google Search Console & Bing (per `docs/seo/*` guides), announce in-app (owner sends announcement).
- **Milestone DL — docs live.**

## Docs Phase D7 — Mobile app documentation — 2 features
### D7.1 Mobile docs: member features (after mobile Milestone M2)
- Publish §9.6.18 pages relevant to members, the mobile-only account pages from D2.3, `mobile-app-faq`; add `PlatformTabs` mobile steps + mobile screenshots (Maestro) to every Member guide page and Getting started pages; store links live.
### D7.2 Mobile docs: officer features (after mobile Milestone M3)
- `officer-tasks-on-the-go`; mobile steps/screenshots for officer pages in Members, Finance, Payments, Meetings, Elections, Welfare, Cooperatives, Communication, Settings where the screen exists on mobile; update `whats-web-only`.

---

## Admin Definition of Done (applies to every admin feature, A1–A3)
- Universal DoD (above) where relevant (type-check, lint, tests, no hard-coded design values, light/dark).
- For migration features: a **parity checklist** in the PR listing every control, filter, column, API call and rule on the old web page, each ticked as reproduced (or explained as intentionally dropped and approved).
- All data fetching goes through `/bff`; no API token in client code (grep for `Authorization` outside `*.server.ts`/route handlers fails review).
- Destructive actions use `ConfirmDestructive` with a required reason; the reason is visible in the Action log.
- Loading (skeleton), empty, error (retry) and forbidden states on every data screen.
- Works at 1280 px and down to 768 px (tablet); phones are not a target but must not break.
- `ui-registry.md` (Admin section) and `progress-tracker.md` (feature + parity table) updated.

## Admin Phase A1 — Backend, scaffold & shell — 7 features
*Goal: the API supports a separate admin console and a skeleton admin app is deployed to staging.*

### A1.1 Super Admin inventory & migration map
- Inventory every Super Admin page, component, hook, store field and branch in `apps/web` (start from `project-overview.md §10.6` and §10.8; grep `SUPER_ADMIN`, `platformRole`, `isPlatformLogin`, `useSuperAdminContext`, `/admin`), and every platform API endpoint they call. Write `docs/admin/migration-inventory.md` (page → components → endpoints → target admin route).
- Check whether any association already uses a reserved subdomain (§16.5) and record the result.
- Record how Dokploy currently builds `api` and `web` (Nixpacks/Railpack/Dockerfile) and the production API host in `progress-tracker.md`.
- **DoD:** inventory reviewed by owner; no code changes.

### A1.2 Backend: platform login, reserved subdomains, CORS, reasons
- B1 platform login endpoint + `GET /api/admin/auth/me`; B3 reserved subdomains (shared constant in `packages/shared`, API validation and tenant resolution, web signup form validation); B7 required reasons on destructive admin endpoints (backward compatible: optional until A3.1, then required); B8 CORS entries.
- **DoD:** tests for platform-only login, reserved subdomain rejection, `Origin: admin…` not resolving a tenant; current web Super Admin flow still works (B2 not yet enabled).

### A1.3 Backend: impersonation handoff
- B4: `ImpersonationHandoff` model + migration, new impersonate response (code), exchange endpoint, sessions list; keep the old JWT-returning behaviour behind a temporary flag `IMPERSONATION_LEGACY_RESPONSE=true` until A3.1 so the current web keeps working.
- **DoD:** tests: single use, 60 s expiry, wrong association, admin demoted mid-flow, durations > 4 h rejected; audit entries written.

### A1.4 Backend: TOTP 2FA for platform users *(owner may defer — if deferred, mark "skipped (deferred)" and continue)*
- B5 with `otplib`, encrypted secrets, recovery codes, login challenge; script to reset a platform user's 2FA (`pnpm -F @societyledger/api admin:reset-2fa --email …`).
- **DoD:** tests for enrol, verify, recovery, regenerate, reset script; secrets never logged.

### A1.5 Scaffold `apps/admin`
- Next.js (same major as web) with `output: 'standalone'`, Mantine 7, Tailwind (preflight off), TanStack Query v5, Zustand, axios → `/bff`; `bff/session` + `bff/[...path]` route handlers with prefix allow-list; host-only session cookie; `middleware.ts` guard + optional IP allowlist + `noindex`; `robots.ts`; Sentry; Dockerfile (§17.2); Turbo tasks; dev port 3002.
- **DoD:** login → empty dashboard works against local API; cookie verified host-only; token absent from client bundle and network responses to the browser.

### A1.6 Admin shell, theme & shared components
- Mantine theme from admin tokens (`ui-tokens.md §15`), AppShell with grouped navigation (§10.6 order) filtered by `lib/permissions.ts`, header (environment badge, impersonation-sessions pill, user menu), `PageHeader`, `DataTable` (server pagination, sorting, column visibility, URL-synced filters), `FilterBar`, `StatCard`, `StatusBadge`, `ConfirmDestructive` + `ReasonField`, `EmptyState`, `ErrorState`, `Forbidden`; login screens X1–X3 styled.
- **DoD:** components in `ui-registry.md` (Admin); keyboard navigation works across the shell.

### A1.7 Dokploy deployment (staging + production)
- Dokploy apps `societyledger-admin` (staging on `develop` → `admin-staging.societyledger.com.ng`, production on `main` → `admin.societyledger.com.ng`), env vars (§16.9), internal `API_URL` over the Dokploy network, Traefik priority above the wildcard (§17.3), health check, rollback tested once. Production kept stopped until A3.2.
- **DoD:** staging admin reachable; `curl -sI` shows admin headers (not the web app's); runbook section in `apps/admin/README.md`.

## Admin Phase A2 — Migrate platform screens — 12 features
*Each feature moves the listed web pages to the admin app with a parity checklist. The web pages stay live until A3.1.*

### A2.1 Dashboard & analytics — X4, X9
### A2.2 Associations & association detail — X5, X6 (merges `/admin/associations/[id]` and `/admin/tenants/[id]`: overview, subscription & billing, modules & features, security, activity tabs)
### A2.3 Tenant operations — X7 (suspend/reactivate, soft delete/restore, permanent delete with typed confirmation, force sign-out)
### A2.4 User approvals — X8
### A2.5 Settlements — X10
### A2.6 Modules catalogue — X11
### A2.7 Action log & audit log — X12, X13 (with CSV export)
### A2.8 Platform settings — X14 (merges `/admin/settings` and `/admin/settings/platform`)
### A2.9 Webhooks & scheduled jobs — X15, X16 (merges duplicate `/admin/cron` and `/admin/cron-jobs` into one Jobs area)
### A2.10 Blog CMS — X17 (moves the Quill editor component; public `/blog` on the web app is unchanged)
### A2.11 Help content & support desk — X18, X19 (platform scope only; association-scoped help/support pages in the web app stay)
### A2.12 Impersonation & my account — X20, X21, plus the impersonation dialog on X6 using the handoff flow; web `/auth/impersonate` exchange page (added to web now, harmless before cutover)

## Admin Phase A3 — Cutover & launch — 2 features

### A3.1 Remove Super Admin from the web app
- Apply `project-overview.md §10.8` / architecture §16.8: delete routes, components, hooks and branches; `/admin/*` → admin domain redirect; login notice; enable B2 (`PLATFORM_LOGIN_REQUIRED`) and make B7 reasons required; switch off `IMPERSONATION_LEGACY_RESPONSE`.
- Deploy order (architecture §17.4): API → admin production started → web.
- **DoD:** grep checks in `project-overview.md §10.10` pass; web type-check/lint/build pass; tenant users' flows smoke-tested (login, dashboard, payments) on staging and production.

### A3.2 Security review & launch
- Review against §16.10 rules: cookie flags, proxy allow-list, CSP, IP allowlist (if used), 2FA (if built), rate limits on admin login, reasons in logs, `noindex`; Playwright smoke suite green on production; at least one restore-from-backup drill of the Dokploy database documented.
- **Milestone AL — admin console live at admin.societyledger.com.ng; Super Admin removed from the web app.**

---

## Mobile Phase 0 — Backend enablement (apps/api, apps/web) — 6 features
*Goal: the API supports everything mobile needs. Ship to staging before Phase 2 starts. These are the only permitted backend changes (architecture.md §9).*

### F0.1 Mobile docs folder & API contract audit
- Create `docs/mobile/README.md` in repo root docs.
- Inventory the exact request/response shapes for every endpoint in Phases 2–3 (auth, associations/check-subdomain, members/me/*, member-ledger/my-ledger/*, payments/paystack/*, payments/nigerian/bank-accounts|banks|proofs, notifications/*, meetings upcoming/recent/:id, voting/active|dashboard|elections/:id…). Write them to `docs/mobile/api-contract.md`.
- Inventory every `Notification.type` string currently written by the API.
- **DoD:** contract doc exists; discrepancies with `packages/shared` types listed.

### F0.2 Push notifications backend
- Prisma `DeviceToken` model + migration; `modules/devices` (register/unregister) with Zod + auth.
- `services/push.service.ts` (expo-server-sdk, chunking, receipts job, disable dead tokens).
- `services/notification-dispatch.service.ts`; refactor the 3 existing notification writers to use it; respect `/notifications/preferences`.
- Add dispatch calls (with `entityId` + mapped `type`) for: payment confirmed, payment proof submitted/verified/rejected, bank transfer pending/verified, loan application submitted/updated, guarantor requested, welfare payout requested/updated, election phase changes, poll opened, meeting scheduled/cancelled/reminder (existing job), announcement, support ticket reply, user approval pending.
- **DoD:** unit tests for dispatch + push service (mock Expo SDK); Postman/curl script in docs; web behaviour unchanged.
- **Depends on:** F0.1

### F0.3 Refresh-token sessions
- Prisma `RefreshToken` model + migration; issue on login/accept-invite when `X-Client: mobile`; `POST /auth/refresh` with rotation & reuse detection; logout revokes; `GET /auth/sessions`, `POST /auth/sessions/revoke-others`; password change/reset revokes all; tenant-middleware allow-list updated; rate limit.
- **DoD:** tests cover rotation, reuse detection, revoked user, suspended association, web login unchanged (cookie + 7-day token, no refresh token returned).
- **Depends on:** F0.1

### F0.4 Mobile payment return bridge
- `GET /api/payments/mobile-return` 302 → `societyledger://payments/return?reference=…` with HTML fallback; mounted before tenant middleware; hard-coded scheme.
- **DoD:** test asserts no open redirect; manual Paystack test-mode run documented.
- **Depends on:** F0.1

### F0.5 Machine-readable error codes
- Add `code` to subscription, rbac, auth (tenant mismatch) and tenant middleware error responses (architecture.md §9.4). Messages unchanged. (`PLATFORM_LOGIN_REQUIRED` and `SUBDOMAIN_RESERVED` already exist from the admin track — reuse the same error-code helper.)
- **DoD:** tests updated; web unaffected (it ignores the new field).

### F0.6 Web "Open in app" links
- `/auth/activate` and `/auth/reset-password` pages show an "Open in the SocietyLedger app" button on mobile user agents with `societyledger://invite|reset-password?token=…&tenant=<subdomain>`.
- **DoD:** button hidden on desktop; link verified on Android & iOS with dev build installed.

---

## Mobile Phase 1 — Foundation (apps/mobile) — 8 features
*Goal: a running app with design system, API client, session plumbing — no product screens yet beyond a component gallery.*

### F1.1 Scaffold Expo app in monorepo
- `pnpm create expo-app apps/mobile` (Expo Router TS template, SDK 56; confirm pnpm isolated install works with Metro — see architecture §2); workspace name `@societyledger/mobile`; Metro monorepo config; `tsconfig` strict + `@/*` paths; ESLint/Prettier; `app.config.ts` with variants; `eas.json` profiles; bundle IDs & scheme; Sentry plugin; expo-updates; dev client build for iOS + Android.
- Turbo: add `dev`, `lint`, `type-check`, `test` for mobile.
- **DoD:** `pnpm -F @societyledger/mobile dev` opens dev client on both platforms; CI-ready scripts.

### F1.2 Theme, tokens & NativeWind
- Install NativeWind; `src/theme/global.css` with all CSS variables from `ui-tokens.md` (light + dark); `tailwind.config.js` mapping; `src/theme/tokens.ts` JS mirror; Inter font loading (`expo-font`); `ThemeProvider` with system/light/dark + persistence; status bar & navigation bar colours follow theme.
- **DoD:** a test screen renders every colour token in both themes; zero hex values outside `global.css`/`tokens.ts`.

### F1.3 API types & enums
- `src/types/api/*` DTOs for Phase 2–3 endpoints from `docs/mobile/api-contract.md`; `enums.ts` generated from `schema.prisma` (script `scripts/gen-enums.ts`); fix or supersede stale `packages/shared` types (architecture.md §2).
- **DoD:** script reproducible; enums match schema.

### F1.4 Core UI kit (part 1)
- Build in `src/components/ui`: `Text`, `Button` (all variants/sizes/loading), `IconButton`, `Card`, `Badge`, `StatusChip`, `Avatar`, `Divider`, `Skeleton`, `Money`, `Spinner`.
- `src/components/layout`: `Screen` (safe area, scroll/fixed, refresh), `ScreenHeader`, `Section`, `ListItem`, `StickyFooter`.
- Dev-only `app/(dev)/gallery.tsx` showing every component state (excluded from production builds).
- **DoD:** each component in `ui-registry.md`; snapshot/RTL tests for Button, Money, StatusChip.

### F1.5 Core UI kit (part 2) — forms & feedback
- `src/components/forms`: `TextField`, `PasswordField`, `OtpInput`, `AmountField` (₦ keypad formatting), `DateField`, `SelectSheet`, `SearchField`, `Checkbox`, `Switch`, `SegmentedControl`, `FileAttachField` (camera/gallery/files), all RHF-bound via `FormField` controller pattern.
- `src/components/feedback`: `EmptyState`, `ErrorState`, `OfflineBanner`, `ModuleLocked`, `SubscriptionInactive`, `NoPermission`, `ConfirmSheet`, toast setup (sonner-native).
- `BottomSheet` wrapper (gorhom) in `ui/`.
- **DoD:** registry updated; form example in gallery validates with zod.

### F1.6 Storage, permissions & utilities
- `lib/docs.ts` (`docsUrl`, `openDocs`, plan-billing filter + test) using `packages/shared/src/docs-links.ts` (created in D6.3), `lib/storage.ts` (MMKV), `lib/secure.ts`, `lib/money.ts` (+ tests), `lib/dates.ts` (+ tests), `lib/i18n.ts` + `en.json`, `lib/permissions.ts` (alias map copied from API `lib/permissions.ts`, resolve MEETING_MINUTES drift), `hooks/useCan`, `hooks/useOnline`, `hooks/useAppState`.
- **DoD:** 100 % unit coverage on money, dates, permissions.

### F1.7 API client & error handling
- `api/client.ts` (axios, base URL, 15 s timeout, headers, single-flight refresh, 401/403/429 handling, module-disabled store update), `api/errors.ts`, `api/envelope.ts`; `stores/session`, `stores/tenant`, `stores/modules`; QueryProvider with persister + online/focus managers.
- **DoD:** msw tests: refresh single-flight with 3 concurrent 401s; MODULE_DISABLED → store; 429 not retried; tokens never logged.

### F1.8 App shell & navigation skeleton
- Root `_layout` (providers, splash control, fonts), `(auth)` and `(app)` groups with guards, `(tabs)` with 5 tabs (Manage conditional on permissions) and header bell placeholder, modal stack presentation, `+not-found`, deep-link parsing (`lib/linking.ts`) with zod validation.
- **DoD:** navigating between empty placeholder tabs works; guards redirect correctly with mocked session.

---

## Mobile Phase 2 — Authentication & member core — 9 features
*Goal: a member can sign in, see their money, and pay. First internal TestFlight / Play internal build at the end of this phase.*

### F2.1 Welcome & association selection — screens A1, A2, A3
- Splash redirect logic, Welcome carousel, Association Code with debounced lookup, recent associations, logo URL resolution.
- **DoD:** invalid / cancelled / suspended association states handled.

### F2.2 Login & account states — A4, A6, A10, A11, A12
- Login form; error-code routing (including `PLATFORM_LOGIN_REQUIRED` → A12, live since admin A3.1); verify email OTP + resend cooldown; pending/blocked/platform-staff screens; store tokens; fetch me; permissions into session.
- Association-code screen (F2.1) also rejects reserved subdomains using `packages/shared/src/reserved-subdomains.ts`.
- **Depends on:** F0.3 for refresh (works without it).

### F2.3 Register, forgot/reset password, accept invite — A5, A7, A8, A9
- Deep links for reset and invite (set tenant from link first).

### F2.4 Session lifecycle & app lock — A14, P3 (biometric/auto-lock part)
- Bootstrap from cache, foreground `/auth/me` refresh, logout (revoke + cache wipe), switch association, biometric opt-in prompt, auto-lock, privacy overlay, `useReauth()` helper for sensitive actions.

### F2.5 Home — Me — H1
- Balance card, quick actions (permission/module filtered), upcoming meeting, active vote, recent payments, announcements; pull-to-refresh; persisted cache.

### F2.6 Money overview & ledger — M1, M6, M7, M13, M14
- Overview, ledger with month grouping and filters, statement PDF download/share, payment history, transaction detail.

### F2.7 Dues, levies, penalties, donations — M8, M9, M10, M11, M12

### F2.8 Pay online with Paystack — M2, M3, M5
- Outstanding selection, sequential single-item checkout, auth session, return handling, verify/poll, result screen, receipt share (expo-print → PDF), cache invalidation.
- **Depends on:** F0.4

### F2.9 Pay by bank transfer with proof — M4
- Bank accounts with copy, bank picker, proof form with attachment upload (multipart), submission success.

**Milestone M1 (end of Phase 2):** internal build to TestFlight + Play internal testing; smoke-test with a real association in staging.

---

## Mobile Phase 3 — Engagement — 8 features
*Goal: members' non-financial life in the app + push.*

### F3.1 Push notifications client — N1 (routing), permission prompt
- Permission prompt timing (after first meaningful action, not on launch), token registration/unregistration, Android channels, foreground presentation, tap routing map, cross-association prompt, badge count sync with unread count.
- **Depends on:** F0.2

### F3.2 Notifications inbox & preferences — N1, N2, header bell badge

### F3.3 Profile & settings — P1, P2, P3 (password, sessions), P4, P11
- **Depends on:** F0.3 for sessions list

### F3.4 Meetings (member) — C1 (meetings part), C2, C3, C4
- Add to calendar (expo-calendar), open maps/link.

### F3.5 Elections & voting (member) — C5, C6, C7, C8
- Self-nomination, ballot stepper with re-auth, results.

### F3.6 Polls (member) — C9, C10

### F3.7 Welfare (member) — C11, C12

### F3.8 Community hub & announcements — C1 (complete), C13

---

## Mobile Phase 4 — Cooperatives & support — 5 features

### F4.1 Savings (member) — M15, M16
### F4.2 Loans (member) & apply — M17, M18, M19
### F4.3 Guarantor requests — M20
### F4.4 Help center & FAQs — P5, P6, P7, P12 (User manual link) + contextual `?` docs links on mapped screens (`architecture.md §15.4`)
### F4.5 Support tickets (member) — P8, P9, P10

**Milestone M2 (end of Phase 4):** public beta (TestFlight external + Play open testing) for member features. Officers can use the beta for member features only.

---

## Mobile Phase 5 — Officer essentials — 8 features
*Goal: the highest-value officer tasks: members, payments verification, finance basics, attendance.*

### F5.1 Manage tab hub & Home — Association — Manage index, H2
- Permission/module-driven sections with pending badges; association KPIs, charts (victory-native wrappers in `components/charts`), needs-attention list.

### F5.2 Members list & detail — MG1, MG2
- Search, filters, infinite list, detail tabs, call/WhatsApp/email intents.

### F5.3 Member create/edit, invites, approvals — MG3, MG4, MG5

### F5.4 Payment proofs queue & verification — PY1, PY2, PY3
- Image/PDF viewer with pinch-zoom; verify against outstanding items; reject with reason.

### F5.5 Bank transfers & bank accounts — PY4, PY5, PY6, PY7

### F5.6 Finance overview, transactions & record payment — FN1, FN2, FN3, FN4, FN5
- Edit, void-and-replace (re-auth), delete + undo toast, bulk create.

### F5.7 Overdue & reminders, member ledgers — FN12, FN13, FN14

### F5.8 Meetings admin & live attendance — GV1, GV2, GV3, GV4, GV5, GV6
- Optimistic attendance marking with rollback; minutes editor.

**Milestone M3:** officer beta.

---

## Mobile Phase 6 — Officer advanced — 8 features

### F6.1 Categories, dues, levies — FN6, FN7, FN8, FN9
### F6.2 Donations & penalties admin — FN10, FN11
### F6.3 Elections & polls admin — GV7, GV8, GV9, GV10
### F6.4 Welfare admin — WF1, WF2, WF3, WF4
### F6.5 Cooperatives admin — CP1, CP2, CP3, CP4, CP5
### F6.6 Communication: announcements & SMS — CM1, CM2, CM3, CM4, CM5, CM6
### F6.7 Reports & exports — RP1–RP7
### F6.8 Reconciliation — PY8 (statement import via document picker, auto-match, confirm)

---

## Mobile Phase 7 — Admin & intelligence — 5 features

### F7.1 Accounting — AC1–AC6 (journal posting requires re-auth)
### F7.2 Association settings — ST1–ST6, ST10
### F7.3 Users, roles & audit — ST7, ST8, ST9
### F7.4 Support tickets (officer) — ST11
### F7.5 AI assistant — AI1, AI2, AI3

---

## Mobile Phase 8 — Association signup & onboarding — 2 features

### F8.1 Create association — A13
### F8.2 Onboarding wizard — O1–O5 (resumable, skippable)

---

## Mobile Phase 9 — Hardening & release — 6 features

### F9.1 Performance pass
- Startup trace, list virtualisation audit, image sizes, bundle analysis, memory check (reanimated/Hermes regression), cold start target ≤ 2.5 s on mid-range Android.

### F9.2 Accessibility pass
- Screen reader walkthrough of top 10 flows, contrast audit against tokens, dynamic type at 1.3×, reduce-motion support.

### F9.3 E2E test suite
- Maestro flows: login, pay online (Paystack test mode), submit proof, vote, verify proof (officer), take attendance (officer), logout/switch association.

### F9.4 Security review
- Token storage, Sentry scrubbing, deep-link validation, screenshot privacy overlay, jailbreak/root not blocked but logged, dependency audit, API rate-limit behaviour.

### F9.5 Store readiness
- Icons, splash, store screenshots (light/dark), privacy nutrition labels / Data safety form, permission usage strings (camera, photos, Face ID, notifications, calendar), review notes with demo association credentials, age rating.

### F9.6 Production release
- EAS production builds, submit to App Store & Play, staged rollout (Android 10 % → 100 %), EAS Update channel `production`, monitoring dashboard (Sentry release health).

---

## Summary
| Phase | Features | Theme |
|---|---|---|
| D1 | 7 | Docs foundation |
| D2 | 3 | Docs: start & concepts (24 pages) |
| D3 | 5 | Docs: members & money (60 pages) |
| D4 | 5 | Docs: community & services (43 pages) |
| D5 | 4 | Docs: admin (46 pages) |
| D6 | 4 | Docs: reference, web integration, launch (DL) |
| D7 | 2 | Docs: mobile app (after M2 / M3) |
| A1 | 7 | Admin: backend, scaffold, shell, deploy |
| A2 | 12 | Admin: migrate 22 platform screens |
| A3 | 2 | Admin: web cutover & launch (AL) |
| 0 | 6 | Mobile: backend enablement |
| 1 | 8 | Foundation |
| 2 | 9 | Auth & member money (M1 internal build) |
| 3 | 8 | Engagement & push |
| 4 | 5 | Cooperatives & support (M2 public beta) |
| 5 | 8 | Officer essentials (M3 officer beta) |
| 6 | 8 | Officer advanced |
| 7 | 5 | Admin & AI |
| 8 | 2 | Signup & onboarding |
| 9 | 6 | Hardening & release |
| **Total** | **116** (30 docs + 21 admin + 65 mobile) | |

Follow the Master sequence at the top. Mobile Phase 0 and Phase 1 may also run in parallel with each other only if two agents/sessions work simultaneously.
