# Progress Tracker — SocietyLedger Docs Site, Admin Console & Mobile

> **Living document.** Updated after every feature ships. A new session reads this first to know exactly where things stand. Build the **next unchecked item in the Master sequence** whose dependencies are checked (order and details in `build-plan.md`). Docs track (D) comes first, then the admin track (A), then the mobile track (F), with D7.x after mobile milestones.

## Current status
- **Track / phase:** Docs D3 — Members & money, in progress
- **Next feature:** D3.2 Members — officers (10 pages)
- **Last updated:** 2026-10-13 (D3.1 complete — all 16 Member guide pages published)
- **Blockers:** none

## How to update (after each feature)
1. Tick the box, add the date and a one-line note (what shipped, anything notable).
2. Update **Current status** above.
3. Add any Backend gaps, Decisions or Known issues discovered.
4. Commit with the feature: `docs(context): progress F<x.y>`.

Format for a completed item:
`- [x] F1.2 Theme, tokens & NativeWind — 2026-10-15 — NativeWind 4.2.x; dark vars via .dark:root; gallery added`

---

# Track D — Documentation site (`apps/docs`, docs.societyledger.com.ng)

## Docs Phase D1 — Foundation
- [x] D1.1 Scaffold Fumadocs site in monorepo — 2026-10-11 — `apps/docs` scaffolded from the current `create-fumadocs-app` static-export template (fumadocs-core/mdx 16.17.1/15.4.7, `fumadocs-ui` aliased to `@fumadocs/base-ui@16.17.1`, Next 16.3.8, React 19.3.0, Tailwind 4). Pinned `typescript@5.9.3` (not the scaffold's default 7.x — `typescript-eslint` caps at `<6.1.0`, which would otherwise break `pnpm lint`) and added `zod@^4.6.6` explicitly (fumadocs-core peers on zod 4.x; left undeclared, pnpm silently hoists the repo's zod 3.x from the API instead). `/` replaced with a client-side redirect to `/docs` (static export has no server to do it any other way); public GitHub links removed from the scaffold (repo is private). `dev`/`build`/`type-check`/`lint` all verified clean; `turbo.json` build outputs and root `.gitignore` extended for `out/`/`.source/`.
- [x] D1.2 Docs theme, tokens & layout — 2026-10-12 — `app/theme.css` overrides every `--color-fd-*` var (`ui-tokens.md §14.1`, confirmed names match the installed `@fumadocs/base-ui@16.17.1` exactly) plus `.dark #nd-sidebar` (an ID-selector rule in `neutral.css` that would otherwise out-specificity a plain `.dark` override for 3 sidebar properties) and Tailwind's `--radius-sm/-md/-lg` (`§14.4`, retunes every `rounded-*` utility sitewide including Fumadocs' own markup). Font swapped Inter → Manrope. Header gained "Open SocietyLedger" link (`appUrl` from new `NEXT_PUBLIC_APP_URL`, `.env.example` added); "Get the app" deliberately omitted — mobile doesn't exist yet, matches `ui-rules.md §11.3`'s own deferral. Logo/favicon reuse `apps/web`'s existing teal→green gradient brand as-is (owner's explicit choice over the ledger+brass system `ui-tokens.md §14` otherwise assumes) — implemented as named tokens (`--color-docs-logo-from/-to`, new row in `ui-tokens.md §14.2`) + two `@utility` classes, not raw Tailwind palette classes, to stay inside AGENTS.md's no-raw-Tailwind-color-classes rule; favicon copied byte-for-byte from `apps/web/public/favicon.png`. New `Footer` (minimal — `ui-rules.md` doesn't fully spec one yet) and `app/not-found.tsx` (reuses the existing search dialog via `useSearchContext().setOpenSearch`, confirmed it still prerenders to static `out/404.html`). `dev`/`type-check`/`lint`/`build` all verified; compiled CSS checked directly to confirm override cascade order wins. **Not done: a real browser/visual check** — no browser automation tool was available this session; verification was structural (compiled CSS, rendered HTML/RSC payload) only. Do that check before demo.
- [x] D1.3 Information architecture skeleton (all 197 pages as drafts) — 2026-10-12 — Frontmatter zod schema extracted to loader-free `lib/docs-schema.ts` (re-exported from `lib/source.ts`, which calls `defineDocs`) — not a `source.config.ts`, which this Fumadocs version's macro-based `defineDocs` doesn't use (see Decisions log). `scripts/sitemap-data.ts` encodes the full `§9.6` table (21 sections, 197 pages) as typed data; `scripts/gen-skeleton.ts` generated every section's `meta.json` + every page's `.mdx` stub from it (idempotent — re-run confirmed 0 created, 0 drift), plus the root `meta.json` with `§14.4`'s separator groups. `content/docs/index.mdx` (the D1.1 placeholder) fixed by hand to the full schema. `lib/source.ts` also gained `lucideIconsPlugin()` (meta.json/frontmatter icons resolve automatically — no hand-rolled icon map) and `getVisiblePageTree()` (sidebar-only draft filtering via `NEXT_PUBLIC_SHOW_DRAFTS`; search/sitemap exclusion is D1.5's job). `scripts/check-frontmatter.ts` (using `gray-matter`, since the schema module needs to stay loader-free) validates all 197 pages clean. Verified: default build's sidebar renders empty (nothing published yet, as expected); `NEXT_PUBLIC_SHOW_DRAFTS=true` build renders the full 21-section tree; `type-check`/`lint`/`build`/`check:frontmatter` all pass. **Two sections (`core-concepts`, `account-security`) and the `accounting-guide`/`help-support`/`troubleshooting-faq`/`reference` sections have no dedicated index/overview page** — the literal `§9.6` table doesn't list one for them, so none was invented; their `meta.json` has no `index`, which Fumadocs supports (a folder can be a pure navigational grouping). Audience/type values for pages in sections without an explicit `Aud.`/`Type` column in `§9.6` (sections 5–18, 20–21) were inferred from the section's purpose and title wording (e.g. "Finance" → officer; "Settings" → admin; verb-led titles → task) — reasonable defaults for a draft stub, not binding; each page's real frontmatter gets re-verified against its `covers` sources during actual authoring (`code-standards.md §17.5`).
- [x] D1.4 MDX component kit — 2026-10-12 — All 20 components from the build-plan bullet built in `components/mdx/` and registered in `components/mdx.tsx`: `AppliesTo`, `Callout`, `Steps`/`Step` (re-exported from Fumadocs as-is — `--docs-step-marker` and `--color-fd-primary` are the same hex), `Screenshot`, `MenuPath`, `UiLabel`, `PlatformBadge`, `PermissionNote`, `PlanNote`, `RoleTabs`/`RoleTab`, `PlatformTabs`/`PlatformTab`, `StatusChip`, `CardGrid`/`Card`, `Faq`/`FaqItem`, `Glossary`, `Diagram`, `VideoEmbed`, `Related`, `Feedback`, `LastUpdated` — full detail (props, tokens, MDX usage, notes) in `ui-registry.md`. `theme.css` gained the `--docs-callout-*`, `--docs-screenshot-frame`, `--docs-marker-*`, `--docs-badge-*`, `--docs-applies-bg` tokens (`ui-tokens.md §14.2`) plus `docs-text-small`/`-micro` (§14.3) — only what an actual component here consumes; the rest of §14.2–14.4 (hero-bg, layout widths, the full typography scale) is left for whichever feature first needs it. `app/docs/[[...slug]]/page.tsx` now wires `AppliesTo` (omitted on overview/faq), an auto-`CardGrid` of child pages on overview-type pages, `Related` (resolved via `source.getPageByHref`), `Feedback` and `LastUpdated` around the MDX body — these were never going to get used otherwise. New `lib/docs-page-context.tsx` (serializable-only frontmatter context — hit and fixed a real bug where the full non-serializable `page.data` was passed into a Client Component), `lib/permission-labels.ts`/`lib/module-labels.ts` (sparse plain-language maps + humanize fallback), `lib/status-tone.ts` (mirrors `ui-tokens.md §1.4`), `lib/analytics.ts` (stub `trackEvent`, wired for real at D1.5). Demo page `content/docs/_kitchen-sink.mdx` (`status: draft`) exercises every component — confirmed Fumadocs doesn't treat an underscore-prefixed filename specially (it's a normal route, hidden by the D1.3 draft filter, not a framework convention). `next.config.mjs` gained `images.remotePatterns` for `i.ytimg.com` (`VideoEmbed`'s thumbnail). `type-check`/`lint`/`build` (both with and without `NEXT_PUBLIC_SHOW_DRAFTS`) all pass; `check:frontmatter` and `gen:skeleton`'s drift check both still pass (198 pages now, kitchen-sink added to the generator's exemption list). **Not done: a real screen-reader pass** — reviewed against WCAG/WAI-ARIA patterns by reading each component (native `<button>`/`<details>` semantics, `aria-hidden` on decorative icons/markers, inherited Fumadocs Tabs/Accordion ARIA patterns, a fixed missing `<label>` on Feedback's textarea), but no actual screen reader or automated audit was run — no browser automation tool was available this session, same gap as D1.2. Do that check before demo.
- [x] D1.5 Search, SEO, analytics & feedback — 2026-10-12 — **Search:** `app/api/search/route.ts` gained a custom `buildIndex` tagging each page by section (`tag: page.slugs[0]`, filterable via a new `<TagsList>` in `components/search.tsx`) and folding `lib/search-synonyms.ts`'s term pairs (dues↔subscription fee, levy↔contribution, proof↔receipt, exco↔officer) into each matching page's hidden, indexed `structuredData.contents` — adapted from architecture.md §14.6's "keywords field" wording since the installed engine's advanced schema has no such field (another stale-assumption correction, `library-docs.md` updated). Added an optional `keywords` frontmatter field for authors to hint extra search terms. **SEO:** `app/sitemap.ts` (published pages only — all 0 right now, correctly), `app/robots.ts`, canonical URLs + `metadataBase` (also fixed a pre-existing "metadataBase not set" build warning), `TechArticle`+`BreadcrumbList` JSON-LD per page (`components/json-ld.tsx`, `lib/breadcrumbs.ts`). **Analytics:** `components/analytics.tsx` — GA4 with consent-mode defaults (analytics_storage/ad_storage denied), no visible banner (owner decision — see Decisions log), renders nothing without `NEXT_PUBLIC_GA_ID`; also carries `docs_outbound` click tracking via one delegated listener. `lib/analytics.ts`'s `trackEvent()` stub (from D1.4) now does real work once GA loads — `Feedback` needed no changes. **UTM:** `lib/utm.ts`'s `withUtm()` applied to the header and footer's "Open SocietyLedger" links. `type-check`/`lint`/`build` (with and without `NEXT_PUBLIC_GA_ID`, with and without drafts) all pass; `check:frontmatter`/`gen:skeleton` unaffected (198/219, as before). **Not verified: Lighthouse SEO score and GA4's debug view** — no browser tool this session (same gap as D1.2/D1.4); search *indexing* was confirmed by the successful build (which runs `buildIndex` over every page without error) but live query-matching wasn't independently tested — `lib/source.ts` can't be loaded under plain `tsx` (same macro-compilation limitation noted at D1.3), and poking at the exported Orama database's internal format directly wasn't productive. Do a real browser check before demo.
- [x] D1.6 Screenshot pipeline & demo association — 2026-10-12 — **Code-only, unverified** (owner's explicit choice: no staging environment or demo association existed to test against — confirmed by investigation before starting: zero Playwright anywhere in the repo, no provisioned staging URL, no demo-tenant seed beyond a thin "attach an admin to an existing `demo` association" helper that itself errors if that association doesn't exist). Built: `apps/api/prisma/seeds/demo-association.seed.ts` (new — 60 members, 12 months of dues across 4 payment-status buckets, a levy campaign, a nominations-open election, 2 meetings, 1 disbursed loan, a welfare fund + payout; every date fixed/absolute, documented in `apps/docs/scripts/screenshots/seed-demo.md`; type-checked against the real generated `@prisma/client` types with zero errors — confirmed this check methodology actually catches errors by deliberately breaking a field name first and verifying `tsc` flagged it). `apps/docs/scripts/screenshots/{capture.config.ts, constants.ts, auth.setup.ts, capture.spec.ts, capture.ts, flows/}` — `@playwright/test` + `sharp` added as docs devDependencies (greenfield, nothing to reuse). Capture freezes the browser clock (`context.clock.install`) to a fixed instant, since fixed seed dates alone don't stop the app's own relative-time text drifting with the real wall clock — architecture.md's "hide clocks/relative dates via fixed demo dates" needed both pieces. `code-standards.md §17.2` gained a `-phone` filename marker (the original wording only reserved room for light/dark, not the full desktop/phone × light/dark matrix `library-docs.md`'s Playwright section already specified). Also backfilled a D1.5 gap found while correcting this section: `docs_search` GA4 event was never wired — fixed in `components/search.tsx`. `type-check`/`lint`/`build` all still pass. **Never run end-to-end** — no live target, and the login selectors in `auth.setup.ts` are unconfirmed against the actual rendered DOM. Whoever runs this first should expect to fix selectors/seed issues that only surface at runtime.
- [x] D1.7 CI, preview deploys & hosting — 2026-10-12 — **Docs Phase D1 complete (7/7).** `apps/docs/Dockerfile` (`turbo prune` → pnpm install → static export build → `nginx:1.27-alpine` runtime) + `apps/docs/nginx/default.conf.template` (long cache for `/_next/static/*`/`/images/*`, CSP allowing GA only, templated `X-Robots-Tag`) — both **actually built and run** with real `docker build`/`docker run` (Docker was available this session), not just written and assumed. That caught two real bugs fixed along the way: `turbo prune --docker` doesn't carry a plain relative-path `tsconfig.json` `extends` across the workspace boundary (needed an explicit `COPY tsconfig.base.json`), and nginx's template `envsubst` crashes the container if a templated var is merely *absent* rather than empty (needed `ENV ROBOTS_TAG=""` in the Dockerfile). Verified serving correctly: security/cache headers, `X-Robots-Tag` present only when `ROBOTS_TAG` is set (confirms the noindex-on-staging design works), 404 page, `/api/search`, `/robots.txt`, `/sitemap.xml`. `docker-compose.dokploy.yml` gained the `docs` service (same one-Compose-stack model as `api`/`web`) and — while here — finally added the explicit Traefik `priority=1` to `web`'s wildcard router that `architecture.md §17.3` had flagged as a latent gap since `web` shipped alone; `library-docs.md`'s Dokploy section (its last remaining stale "one Dokploy Application per app" wording, deliberately deferred since D1.2) is corrected to match. `.github/workflows/docs.yml` built to the exact pipeline `architecture.md §14.9` specifies (install → `gen:reference` → fail-on-uncommitted-diff → type-check → lint → build → `check:links` → `check:frontmatter` → coverage PR comment); validated clean with `actionlint` via Docker (zero issues) — the preview-URL half of the DoD is Dokploy's own PR-preview feature, not something this workflow produces, so it's left to the owner to enable later. Three new scripts: `gen:reference.ts` (stub until D6.1, per the build-plan's explicit allowance), `coverage.ts` (per-section published/draft/review counts + a web-route-coverage proxy from `covers` frontmatter, reusing `sitemap-data.ts`), `check-links.ts` (regex-based internal link checker against the known-URL set — not full MDX/AST parsing, so a link built from a JS expression like `href={variable}` won't be caught; revisit if that turns out to matter). All three run clean locally (0 broken links, as expected — no real content with links exists yet beyond the kitchen-sink demo). `type-check`/`lint`/`build` all still pass. **Dokploy-side setup itself (creating the staging/production Compose projects in the Dokploy UI, DNS, the production app's "kept stopped until D6.4" state) is an operational step for the owner** — nothing in git encodes "stopped," that's a dashboard action.

## Docs Phase D2 — Start & concepts
- [x] D2.1 Introduction & Getting started — 2026-10-13 — 6 of 7 pages `published` (`index`, `getting-started`, `create-your-association`, `onboarding-wizard`, `joining-as-a-member`, `signing-in`, `your-first-week`); 1 stays `draft` (`install-the-mobile-app`, until D7.1, no mobile app exists yet — same precedent as D2.3's two mobile-only pages). Verified against a local docker-compose stack treated as staging for this session (see Decisions log) — a fresh founder signup, the full 5-step onboarding wizard, self-registration into the seeded demo association, sign-in, and (resolving Q1 in a follow-up pass) a real admin-sent member invite through `/auth/activate` were all actually clicked through with Playwright (no interactive browser tool was available; `@playwright/test`, already a devDependency from D1.6, drove a real headless Chromium instead — `serviceWorkers: 'block'` needed in the browser context to stop a dev-mode PWA service-worker reload loop from destabilizing automated navigation). Real screenshots captured and converted to `.webp` for all 6 pages. **Discovered and documented two real product behaviors that weren't in the original covers notes:** (1) every new account — founder or self-registered member — needs both email verification *and* SocietyLedger platform-admin approval before they can sign in (enforced, not just UI copy — confirmed via `is_active`/`approval_status` in the database); (2) an **invited** member skips both of those — activation is immediate, no code and no approval wait, since an officer already vouched for them by adding them as a member first. Both are now in `create-your-association.mdx` and `joining-as-a-member.mdx`. Also fixed a real bug in `app/docs/[[...slug]]/page.tsx`: the overview-page auto `CardGrid` listed *every* child page via `source.getPages()` regardless of `status`, so `install-the-mobile-app` would have shown as a browsable card next to its 5 published siblings — exported `isVisible()` from `lib/source.ts` (previously module-private, already used for sidebar filtering) and reused it in the child-page filter.
  - **Q1 resolution:** the admin Members page's "Failed to fetch members" turned out to be the already-logged RBAC permissions gap (`seed:rbac` hadn't been run after the demo association was created). After that fix, the invite UI worked as designed — the earlier gap was environment-only, not a product bug. Found along the way: none of the demo association's 60 seeded members have an email on file, so none were invitable; patched one directly in the DB (`chinwe.danjuma@...`) to exercise the flow. Also noticed (not fixed, same class as the known `getBaseDomain()` issue): `member-invites.service.ts`'s activation URL is hardcoded to `:3000` rather than reading `FRONTEND_URL`.
- [x] D2.2 Core concepts & glossary — 2026-10-13 — All 8 pages `published`: `your-association`, `members-and-user-accounts`, `roles-and-permissions`, `plans-and-modules`, `money-in-societyledger`, `the-member-ledger`, `notifications-and-channels`, `glossary`. This section has no index page (same as D1.3 noted — `§9.6` lists none). Written from reading the real Prisma schema and backend source directly (project-overview §9.7 step 1) rather than clicking through screens — these are concept/reference pages, not click-through tasks, so there was nothing to perform on staging; the two SVG money-flow / member-ledger diagrams `build-plan.md` calls for were hand-authored (`currentColor`-only, no hardcoded hex) and screenshotted in both themes via the local static export (`npx serve` + Playwright) to confirm they render correctly — both clean. Several corrections to the sitemap's own covers notes, found by reading the schema instead of assuming it:
  - Real `Transaction.status` values are `pending/paid/overdue/waived/partial` — the sitemap's covers note said "paid/partial/unpaid/overdue" (no `pending`, had a `unpaid` that doesn't exist, missed `waived`). Used the real ones.
  - Real platform module names (from `platform-modules.seed.ts`) are things like "Financial Ledger", "Cooperatives & Loans", "AI Integration" — the sitemap's informal list ("ledger, levies, donations, penalties...") conflates sub-features with top-level modules. Used the real module list.
  - **Module/plan gating is not actually enforced anywhere today**: `requireModule()` middleware defaults to `shadow` mode (logs only, never blocks) via `FEATURE_FLAG_MODE`, which isn't set in any env file including the Dokploy compose — and the frontend has zero handling of the `MODULE_DISABLED` error code. The "Enterprise"/"Pro"/"Beta" badges seen in the sidebar (`AdminSidebar.tsx`) are hardcoded per nav item, not computed from the association's actual plan — so `plans-and-modules.mdx` is deliberately worded to describe the badge as a hint, without claiming it blocks anything (because it currently doesn't).
  - "Push" notifications don't exist yet (mobile-only, not built) — title/content changed from the sitemap's "in-app, email, SMS and push" to "in-app, email and SMS", with a note that push arrives with the mobile app.
  - Notification preferences (`notifications.controller.ts`) are stored in an **in-memory `Map`**, not a database table — real for the user in a normal session, but lost on every server restart. Not disclosed to end users (not their concern), but logged as a Backend gap below.
- [x] D2.3 Account & security — 2026-10-13 — 6 of 8 pages `published` (`signing-in-and-out`, `verifying-your-email`, `resetting-your-password`, `changing-your-password`, `account-approval-status`, `switching-associations`); 2 stay `draft` (`signed-in-devices`, `app-lock-and-biometrics` — mobile-only, until D7.1). **Docs Phase D2 (Start & concepts) is now complete: all 3 features shipped.** Verified against the local stack as in D2.1/D2.2 — real login, logout (a two-step confirm-modal flow, easy to click the wrong element automatically), forgot/reset-password (grabbed the real reset token from the dev-only log, confirmed the new password logs in), and change-password (grabbed from `/dashboard/member/my-profile`, confirmed the new password logs in) were all click-tested end to end. Two sitemap corrections found by checking the real source instead of assuming it:
  - `changing-your-password`'s real location is `/dashboard/member/my-profile` (a "Change Password" button opening a modal), **not** `/dashboard/member/settings` as the sitemap's covers note claimed — that page has no password field at all. `covers` updated to the real route.
  - Login failure modes are more specific than the sitemap's generic "pending, rejected or suspended" — the API returns four distinct codes (`EMAIL_NOT_VERIFIED`, `PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`), and "suspended" is actually two different things: an individual account deactivated after previously working, or the *whole association* suspended by a platform admin (`tenant.middleware.ts`, a 403 before the login check even runs) — different people to contact for each. `account-approval-status.mdx` distinguishes all four.
  - Found (not fixed, logged below): `/dashboard/member/my-profile` fires a real, reproducible "Member profile not found" error toast (twice) for the `member@demo.com` test account on every page load, unrelated to the password-change feature itself (which works correctly regardless).

## Docs Phase D3 — Members & money
- [x] D3.1 Member guide (16 pages) — 2026-10-13 — All 16 pages `published`: `index` (the sibling `member-guide.mdx` overview — D1.3's skeleton generator never created a separate `index.mdx` *inside* the folder, but the real Fumadocs convention for a section overview is a sibling file named after the folder, same as `getting-started.mdx`/`core-concepts.mdx` already used — it existed as a draft stub all along, just not where a first glance at the folder would suggest), `your-dashboard`, `what-you-owe`, `paying-online`, `paying-by-bank-transfer`, `your-statement`, `dues-levies-and-penalties`, `making-a-donation`, `payment-history-and-receipts`, `your-profile`, `meetings-and-attendance`, `voting`, `welfare`, `savings-and-loans`, `notification-preferences`, `getting-help`. Verified against the local stack (same pattern as D2) as `member@demo.com` (Ngozi Eze) — real dues payment, real donation attempt, real savings account + loan application, real guarantor request all performed live, not just read from source. `voting`/`meetings-and-attendance` changed from `type: task` to `type: concept` in-flight — see Known issues (both member screens are static placeholders with no real steps to perform).
  - **Demo data extended for this feature** (local DB only, not seed-file changes): two of `member@demo.com`'s already-seeded October/November 2026 dues transactions flipped back from `paid` to `overdue`/`pending` (Payment rows deleted) so "what you owe" pages had a real outstanding balance to show; her Building Fund Levy assignment flipped to `pending`; a real `PenaltyRule` created and the actual `penaltiesService.applyLateFees()` engine run association-wide (not hand-inserted) — correctly produced 73 real penalty transactions across every genuinely-overdue member, including hers. A savings account + ₦45,000 deposit were opened for her via `treasurer@demo.com`, and two real loan applications submitted via the actual API (hers, and one from `treasurer@demo.com` naming her as guarantor) — all through validated endpoints, not direct DB inserts.
  - **RBAC gap found and fixed (demo-scoped only):** the `member` role's default permission array (`rbac-seed.ts`) has never included any permission for voting, welfare or cooperatives — confirmed by direct API calls returning `403 Permission denied` for `/api/voting/active`, `/api/welfare/dashboard` and `/api/cooperatives/my-profile` even though the member-facing pages for all three (My Voting, Welfare, My Savings/My Loans) are fully built and clearly intended for member self-service. The permissions these routes require (`ledger.view`, `ledger.create`, `members.view`) are the same **broad, officer-level** keys used to view *all* members' ledgers and the full member directory — there's no narrower `_own`-scoped permission for cooperatives/welfare/voting self-service anywhere in the codebase, unlike `ledger.view_own`/`payments.view_own`/`members.view_own` which already exist for finance. Rather than broadening the shared `member` role template (which would over-privilege every real member in every association), only the **demo association's own `member` Role row** got these 3 permissions added directly (a `RolePermission` data change, `rbac-seed.ts` untouched) — scoped to `demo` only, reversible, no production impact. See G16 below for the real fix this papers over.
  - **Two real backend bugs found and fixed** in `cooperatives.service.ts`/`cooperatives.controller.ts`'s `getPendingGuarantorRequests` (confirmed broken for every association, not just demo data): (1) filtered `guarantorMember: { userId: memberId }` when the controller passes a **Member** id, not a **User** id — fixed to `guarantorMemberId: memberId`; (2) returned `data: requests` (a flat array) when the frontend reads `result.data.requests` — fixed to `data: { requests }`. A **third** bug in the same feature was found but **not fixed** — see G16.
  - 5 new Backend/Known-issue gaps logged below (G16–G19 plus Known issues) — the largest since D2.2.

- [ ] D3.2 Members — officers (10 pages)
- [ ] D3.3 Finance (14 pages)
- [ ] D3.4 Payments & reconciliation (9 pages)
- [ ] D3.5 Reports & exports (11 pages)

## Docs Phase D4 — Community & services
- [ ] D4.1 Meetings (8 pages)
- [ ] D4.2 Elections & polls (9 pages)
- [ ] D4.3 Welfare (7 pages)
- [ ] D4.4 Cooperatives (9 pages)
- [ ] D4.5 Communication (10 pages)

## Docs Phase D5 — Admin
- [ ] D5.1 Accounting & accounting guide (15 pages)
- [ ] D5.2 Settings, users & roles (14 pages)
- [ ] D5.3 Plan & billing (8 pages)
- [ ] D5.4 AI assistant & help/support (9 pages)

## Docs Phase D6 — Reference, integration & launch
- [ ] D6.1 Reference pages (5 pages, generated where possible)
- [ ] D6.2 Troubleshooting & FAQ (9 pages)
- [ ] D6.3 Web integration (links, redirects, HelpLink, link map)
- [ ] D6.4 Launch
- [ ] **Milestone DL** — docs live at docs.societyledger.com.ng

## Docs Phase D7 — Mobile app documentation
- [ ] D7.1 Mobile docs: member features (after mobile M2)
- [ ] D7.2 Mobile docs: officer features (after mobile M3)

## Docs coverage (update as sections publish)
| Section | Pages | Published | Screenshots done | Pending questions |
|---|---|---|---|---|
| Introduction & Getting started | 7 | 6 | 5 | 0 |
| Core concepts | 8 | 8 | 0 | 0 |
| Account & security | 8 | 6 | 4 | 0 |
| Member guide | 16 | 16 | 14 | 0 |
| Members | 10 | 0 | 0 | 0 |
| Finance | 14 | 0 | 0 | 0 |
| Payments & reconciliation | 9 | 0 | 0 | 0 |
| Accounting + guide | 15 | 0 | 0 | 0 |
| Reports & exports | 11 | 0 | 0 | 0 |
| Meetings | 8 | 0 | 0 | 0 |
| Elections & polls | 9 | 0 | 0 | 0 |
| Welfare | 7 | 0 | 0 | 0 |
| Cooperatives | 9 | 0 | 0 | 0 |
| Communication | 10 | 0 | 0 | 0 |
| AI assistant | 6 | 0 | 0 | 0 |
| Settings | 14 | 0 | 0 | 0 |
| Plan & billing | 8 | 0 | 0 | 0 |
| Mobile app | 10 | 0 | 0 | 0 |
| Help & support | 3 | 0 | 0 | 0 |
| Troubleshooting & FAQ | 9 | 0 | 0 | 0 |
| Reference | 5 | 0 | 0 | 0 |
| **Total** | **197** | **36** | **23** | **0** |

Web route coverage (from `scripts/coverage.ts`): 25 / 107 referenced routes (published pages only).

## Docs questions (unresolved content questions)
| # | Page | Question | Asked | Answer / status |
|---|---|---|---|---|
| Q1 | `getting-started/joining-as-a-member` | Invite-by-email section (steps/labels) written from source only, not click-tested — admin Members screen hit a permissions error this session, root-caused (seed order) after the page was drafted | 2026-10-13 | **Resolved 2026-10-13** — permissions fixed (`seed:rbac` re-run), invite flow click-tested for real end to end (send invite → `/auth/activate` → immediate login, no approval wait), page rewritten accordingly and set `status: published` |

---

# Track A — Platform admin console (`apps/admin`, admin.societyledger.com.ng)

## Admin Phase A1 — Backend, scaffold & shell
- [ ] A1.1 Super Admin inventory & migration map
- [ ] A1.2 Backend: platform login, reserved subdomains, CORS, reasons
- [ ] A1.3 Backend: impersonation handoff
- [ ] A1.4 Backend: TOTP 2FA for platform users *(owner may defer)*
- [ ] A1.5 Scaffold `apps/admin`
- [ ] A1.6 Admin shell, theme & shared components
- [ ] A1.7 Dokploy deployment (staging + production)

## Admin Phase A2 — Migrate platform screens
- [ ] A2.1 Dashboard & analytics (X4, X9)
- [ ] A2.2 Associations & association detail (X5, X6)
- [ ] A2.3 Tenant operations (X7)
- [ ] A2.4 User approvals (X8)
- [ ] A2.5 Settlements (X10)
- [ ] A2.6 Modules catalogue (X11)
- [ ] A2.7 Action log & audit log (X12, X13)
- [ ] A2.8 Platform settings (X14)
- [ ] A2.9 Webhooks & scheduled jobs (X15, X16)
- [ ] A2.10 Blog CMS (X17)
- [ ] A2.11 Help content & support desk (X18, X19)
- [ ] A2.12 Impersonation & my account (X20, X21)

## Admin Phase A3 — Cutover & launch
- [ ] A3.1 Remove Super Admin from the web app
- [ ] A3.2 Security review & launch
- [ ] **Milestone AL** — admin live at admin.societyledger.com.ng; Super Admin removed from web

## Admin parity (web page → admin screen)
| Web page (apps/web/src/app) | Admin screen | Migrated | Parity checked | Web copy deleted |
|---|---|---|---|---|
| `/admin` | X4 Dashboard | ☐ | ☐ | ☐ |
| `/admin/analytics` | X9 Analytics | ☐ | ☐ | ☐ |
| `/admin/associations` | X5 Associations | ☐ | ☐ | ☐ |
| `/admin/associations/[id]` + `/admin/tenants/[id]` | X6 Association detail | ☐ | ☐ | ☐ |
| `/admin/tenants` | X7 Tenant operations | ☐ | ☐ | ☐ |
| (approvals card / API) | X8 Approvals | ☐ | ☐ | ☐ |
| `/admin/settlements` | X10 Settlements | ☐ | ☐ | ☐ |
| `/admin/modules` | X11 Modules | ☐ | ☐ | ☐ |
| `/admin/action-logs` | X12 Action log | ☐ | ☐ | ☐ |
| `/admin/audit-logs` | X13 Audit log | ☐ | ☐ | ☐ |
| `/admin/settings` + `/admin/settings/platform` | X14 Settings | ☐ | ☐ | ☐ |
| `/admin/webhooks`, `/events`, `/test` | X15 Webhooks | ☐ | ☐ | ☐ |
| `/admin/cron*` + `/admin/cron-jobs*` | X16 Jobs | ☐ | ☐ | ☐ |
| `/admin/blog/**` | X17 Blog | ☐ | ☐ | ☐ |
| `/dashboard/settings/help-content` (platform branch) | X18 Help content | ☐ | ☐ | ☐ |
| `/dashboard/settings/support` (platform branch) | X19 Support desk | ☐ | ☐ | ☐ |
| in-app impersonation (`/admin/associations/[id]`) | X20 + handoff | ☐ | ☐ | ☐ |
| `/admin/documentation/**` | — not migrated (G6) | n/a | n/a | ☐ |
| `/dashboard/debug-permissions` | — removed | n/a | n/a | ☐ |

---

# Track F — Mobile app (`apps/mobile`)

## Phase 0 — Backend enablement
- [ ] F0.1 Mobile docs folder & API contract audit
- [ ] F0.2 Push notifications backend
- [ ] F0.3 Refresh-token sessions
- [ ] F0.4 Mobile payment return bridge
- [ ] F0.5 Machine-readable error codes
- [ ] F0.6 Web "Open in app" links

## Phase 1 — Foundation
- [ ] F1.1 Scaffold Expo app in monorepo
- [ ] F1.2 Theme, tokens & NativeWind
- [ ] F1.3 API types & enums
- [ ] F1.4 Core UI kit (part 1)
- [ ] F1.5 Core UI kit (part 2) — forms & feedback
- [ ] F1.6 Storage, permissions & utilities
- [ ] F1.7 API client & error handling
- [ ] F1.8 App shell & navigation skeleton

## Phase 2 — Authentication & member core
- [ ] F2.1 Welcome & association selection
- [ ] F2.2 Login & account states
- [ ] F2.3 Register, forgot/reset password, accept invite
- [ ] F2.4 Session lifecycle & app lock
- [ ] F2.5 Home — Me
- [ ] F2.6 Money overview & ledger
- [ ] F2.7 Dues, levies, penalties, donations
- [ ] F2.8 Pay online with Paystack
- [ ] F2.9 Pay by bank transfer with proof
- [ ] **Milestone M1** — internal build (TestFlight + Play internal)

## Phase 3 — Engagement
- [ ] F3.1 Push notifications client
- [ ] F3.2 Notifications inbox & preferences
- [ ] F3.3 Profile & settings
- [ ] F3.4 Meetings (member)
- [ ] F3.5 Elections & voting (member)
- [ ] F3.6 Polls (member)
- [ ] F3.7 Welfare (member)
- [ ] F3.8 Community hub & announcements

## Phase 4 — Cooperatives & support
- [ ] F4.1 Savings (member)
- [ ] F4.2 Loans (member) & apply
- [ ] F4.3 Guarantor requests
- [ ] F4.4 Help center & FAQs
- [ ] F4.5 Support tickets (member)
- [ ] **Milestone M2** — public beta (member features)

## Phase 5 — Officer essentials
- [ ] F5.1 Manage tab hub & Home — Association
- [ ] F5.2 Members list & detail
- [ ] F5.3 Member create/edit, invites, approvals
- [ ] F5.4 Payment proofs queue & verification
- [ ] F5.5 Bank transfers & bank accounts
- [ ] F5.6 Finance overview, transactions & record payment
- [ ] F5.7 Overdue & reminders, member ledgers
- [ ] F5.8 Meetings admin & live attendance
- [ ] **Milestone M3** — officer beta

## Phase 6 — Officer advanced
- [ ] F6.1 Categories, dues, levies
- [ ] F6.2 Donations & penalties admin
- [ ] F6.3 Elections & polls admin
- [ ] F6.4 Welfare admin
- [ ] F6.5 Cooperatives admin
- [ ] F6.6 Communication: announcements & SMS
- [ ] F6.7 Reports & exports
- [ ] F6.8 Reconciliation

## Phase 7 — Admin & intelligence
- [ ] F7.1 Accounting
- [ ] F7.2 Association settings
- [ ] F7.3 Users, roles & audit
- [ ] F7.4 Support tickets (officer)
- [ ] F7.5 AI assistant

## Phase 8 — Association signup & onboarding
- [ ] F8.1 Create association
- [ ] F8.2 Onboarding wizard

## Phase 9 — Hardening & release
- [ ] F9.1 Performance pass
- [ ] F9.2 Accessibility pass
- [ ] F9.3 E2E test suite
- [ ] F9.4 Security review
- [ ] F9.5 Store readiness
- [ ] F9.6 Production release

**Totals:** Docs 11 / 30 · Admin 0 / 21 · Mobile 0 / 65 features (116 total) · Milestones 0 / 5 (DL, AL, M1, M2, M3)

---

## Backend gaps (API needs that block or limit a screen)
Log here instead of inventing endpoints. Each: what, which screen, proposed fix, status (open / approved / done / won't do).

| # | Gap | Screens | Proposed fix | Status |
|---|---|---|---|---|
| G1 | Paystack `initialize` accepts one `transactionId` only — no multi-item checkout | M2, M3 | Add optional `transactionIds[]` creating one gateway transaction covering several items, or keep sequential single-item checkout | open — v1 uses sequential checkout |
| G2 | `packages/shared` types are stale (`User.id: string`, API returns numbers) | all | F1.3 adds verified types; decide whether web uses the old ones before changing them | open |
| G3 | `MEETING_MINUTES` alias differs: API `members.view_own`, web `members.edit` | GV5 | Owner to choose; mobile uses stricter `members.edit` meanwhile | open |
| G4 | Subscription/RBAC/tenant errors identified by message text only | all | F0.5 adds `code` fields | approved (F0.5) |
| G5 | No public endpoint to list a member's associations by email | A3 | Not needed for code entry; revisit if users struggle | won't do (v1) |
| G6 | Existing DB-backed docs CMS (`/admin/documentation`, `/api/docs`, `DocPage`/`DocFeedback`) overlaps the new docs site | web `/documentation` | Keep it, unlinked, after D6.3 redirects; owner decides later whether to retire it | open |
| G8 | Platform routes are guarded by `SUPER_ADMIN` only; `SUPPORT_AGENT`, `FINANCE_ADMIN`, `COMPLIANCE_ADMIN` exist but can't use any admin section | admin X4–X21 | Approve the role matrix in project-overview §10.7, then widen `requirePlatformRole([...])` per route | open |
| G9 | No API to create/manage platform staff accounts or their platform roles | admin | Keep seed/script for v1 (`pnpm -F @societyledger/api …`); add endpoints + X-screen later if wanted | open — script in v1 |
| G10 | Web currently sets the auth cookie with `COOKIE_DOMAIN` (shared across subdomains) for everyone, including platform users | web/admin | Admin uses its own host-only cookie (§16.3); platform users stop getting tenant cookies at A3.1 (B2). Consider host-only cookies for tenants too (separate decision) | open |
| G11 | No reserved-subdomain list — an association could register `admin`, `docs`, `api`… | API, web signup, mobile A3 | B3 in A1.2 | approved (A1.2) |
| G12 | ~~Unknown: how Dokploy builds `api`/`web` today~~ — resolved: `apps/api/Dockerfile`, `apps/web/Dockerfile` and `docker-compose.dokploy.yml` already exist on `main` (the "Migrate SocietyLedger from Vercel to Dokploy" commit, b61d388) and are the real source of truth — **one Dokploy Compose application**, not one Dokploy Application per app. `architecture.md §17.1`/§17.2/§17.3/§17.4 and §1 corrected to match (2026-10-12). `API_DOMAIN` confirmed by owner: `https://api.societyledger.com.ng`. `library-docs.md`'s "each app = one Dokploy Application" wording still predates this — owner explicitly deferred correcting it to D1.7 (when `docs` is actually added as a compose service) rather than now | deploy | None — reconcile `library-docs.md`'s wording at D1.7 | resolved (architecture.md); `library-docs.md` wording deferred to D1.7 by owner |
| G7 | Docs page feedback has no backend (the API's `DocFeedback` is tied to DB doc page ids) | docs Feedback | GA4 events only in v1; add a slug-based endpoint later if needed | open — GA4 in v1 |
| G13 | `requireModule()` middleware (module/plan gating) defaults to `shadow` mode — logs but never blocks — and `FEATURE_FLAG_MODE=enforce` isn't set in any env file, including `docker-compose.dokploy.yml`. The frontend also has zero handling of the `MODULE_DISABLED` error code. Found at D2.2 while verifying "what not on your plan looks like" for `plans-and-modules.mdx` | all module-gated screens | Decide whether/when to flip to `enforce` in production, and build the frontend's locked/upgrade state before doing so | open |
| G14 | Notification preferences (`notifications.controller.ts`'s `getPreferences`/`updatePreferences`) are stored in an in-memory `Map` (`preferencesStore`), not a database table or Redis — lost on every server restart/redeploy, not shared across instances if the API ever scales horizontally. Found at D2.2 while verifying `notifications-and-channels.mdx` | notification preferences screen | Add a real `NotificationPreference` Prisma model | open |
| G15 | `/dashboard/member/my-profile` fires a real "Member profile not found" error toast (twice, on every load) for at least the `member@demo.com` seeded account — some unrelated fetch on page load 404s even though the member record and profile both clearly exist and load fine otherwise. The page's own actual features (view profile, change password) work correctly regardless. Found at D2.3 while verifying `changing-your-password.mdx`; not root-caused (many `members`/`member-finance`/`cooperatives` controllers return this exact message, so the specific failing call wasn't isolated) | `/dashboard/member/my-profile` | Root-cause which fetch is 404ing and why | open |
| G16 | **The `member` role has no self-service permission for voting, welfare or cooperatives anywhere in the system** — `/api/voting/active`, `/api/welfare/dashboard`, `/api/cooperatives/my-profile` all require the same broad, officer-level keys (`members.view`, `ledger.view`, `ledger.create`) used to view *all* members/ledgers, with no `_own`-scoped equivalent of the kind that already exists for finance (`ledger.view_own`, `payments.view_own`). Found at D3.1 verifying `savings-and-loans.mdx`/`welfare.mdx`/`voting.mdx` — confirmed by direct `403` responses from a real `member` token. Worked around *for the demo association only* (3 `RolePermission` rows added directly, `rbac-seed.ts` untouched) so these pages could be documented against real, working screens — not shipped anywhere else. **Separately, even with that workaround, `getPendingGuarantorRequests` (cooperatives) still crashes the frontend on a populated list** (`Cannot read properties of undefined (reading 'member')` — `GuarantorsPage` assumes `request.loanApplication.member`, but `formatLoanGuarantorResponse` never includes `loanApplication` at all). Two *other* bugs in this same function were found and fixed this session (wrong filter field — `guarantorMember.userId` instead of `guarantorMemberId`; wrong response wrapper — flat array instead of `{ requests }`) — this third one needs a dedicated response shape for this one endpoint, not a one-line fix, so it was left as-is. The Guarantor Requests screen has likely never worked end-to-end for any association | voting, welfare, cooperatives self-service; Guarantor Requests screen specifically | Design proper `_own`-scoped permissions for these 3 modules and widen the real `member` role template with them (product decision, not a docs fix); separately, give `getPendingGuarantorRequests` its own response shape with `loanApplication`/applicant details so the frontend doesn't crash | open |
| G17 | **Members have no way to pay via real Paystack checkout or submit a bank-transfer proof for officer verification on the web today.** `/dashboard/my-finances/pay`'s payment-method dropdown (Bank Transfer/Cash/Card/POS) is cosmetic — `POST /api/members/me/pay` marks the transaction `paid` immediately regardless of method, with no Paystack redirect, no card charge, no proof attachment, and no officer confirmation step; it's a self-declaration, confirmed instantly by the member themselves. The real Paystack `initialize`/`verify` and the bank-transfer-proof endpoints both require officer-only permissions (`payments.view`/`payments.manual_create`), unreachable from a `member` token. Confirmed by reading `member-finance.controller.ts`'s `processPayment` and by a real live payment (`PAY000647`) that completed with zero verification. Found and confirmed with the owner at D3.1 — `paying-online.mdx`/`paying-by-bank-transfer.mdx` document this real behaviour with a warning callout rather than the Paystack/proof-upload flow the original build-plan description assumed; true Paystack checkout and proof upload are mobile-track features (F2.8/F2.9), not yet built | member payment pages (web) | Owner's call whether the unverified self-declare flow is acceptable long-term for web, or should be gated the same way the mobile flows will be | open — documented as current behaviour |
| G18 | **The member financial ledger (`/dashboard/my-finances/ledger`, `MemberFinancialLedger` table) is never populated** — confirmed by a real live payment that completed successfully (appeared immediately in Payment History) but left the Ledger page showing "No transactions yet" / ₦0 across every stat. Whatever writes `Transaction`/`Payment` rows (both the demo seed and the live `processPayment` self-service endpoint) never also posts to `MemberFinancialLedger`. Found at D3.1 verifying `your-statement.mdx` — documented honestly with a callout pointing to Payment History instead | `/dashboard/my-finances/ledger`, `your-statement.mdx` | Root-cause whether anything in the codebase ever posts to `MemberFinancialLedger`, or whether it's entirely unwired | open |
| G19 | `/dashboard/member/my-meetings` and `/dashboard/member/my-voting` are **static placeholder pages** — no `useEffect`, no fetch, no API call of any kind; "No upcoming meetings scheduled", "No attendance records yet", "No active elections", and every stat ("0") are hardcoded JSX, not conditionally rendered. Confirmed by reading both page components directly. Real meeting/election data exists and is reachable via the API (`/api/meetings/upcoming` returns a real scheduled meeting) — these two screens simply were never wired up to it. Found at D3.1; `meetings-and-attendance.mdx`/`voting.mdx` changed from `type: task` to `type: concept` and describe the intended behaviour with a "still rolling out" callout, since there are no real steps to perform yet | `/dashboard/member/my-meetings`, `/dashboard/member/my-voting` | Wire both pages to their real endpoints (`/api/meetings/upcoming`, `/api/voting/active`, plus an attendance-history and voting-history endpoint if those don't exist yet) | open |

## Decisions log
| Date | Decision | Why |
|---|---|---|
| 2026-10-10 | Near-full parity minus platform/Super Admin | Owner choice |
| 2026-10-10 | `apps/mobile` inside the Turborepo monorepo | Reuse `packages/shared`, one CI |
| 2026-10-10 | Tenant chosen by typing the association code (subdomain); last 5 remembered | Uses existing `check-subdomain` endpoint; no tenant list exposed |
| 2026-10-10 | Backend additions approved: push notifications, mobile payment return bridge, refresh tokens (+ error `code` fields, web "open in app" links as supporting changes) | Owner choice |
| 2026-10-10 | No in-app subscription or SMS-credit purchases; read-only status | App Store / Play billing rules |
| 2026-10-10 | Visual direction "the passbook": ledger-green + brass accent, Manrope, ledger rows | Distinct mobile identity rooted in cooperative passbooks; continuity with web teal |
| 2026-10-10 | Expo SDK 56 / RN 0.85 baseline; NativeWind version confirmed at F1.2 | Latest stable SDK at project start |
| 2026-10-10 | **Add documentation site** `apps/docs` at docs.societyledger.com.ng, modelled on docs.businesscopilot.com.ng; linked from web and mobile | Owner request |
| 2026-10-10 | Docs stack: **Fumadocs + Next.js + MDX, static export**, built-in static search *(hosting changed to Dokploy on 2026-10-11)* | Same look as the BusinessCopilot docs (sidebar, ⌘K, On this page, cards); fits the Next.js monorepo; static = fast and cheap. Owner may override framework/host (e.g. if BusinessCopilot docs use another generator or Dokploy hosting) — change here and in architecture §14 |
| 2026-10-10 | Docs track runs **before** the mobile track; mobile docs (D7) follow mobile milestones | Web app is finished and needs a manual now |
| 2026-10-10 | Docs share the mobile brand (ledger green + brass, Manrope) | One brand across manual, app and store listings |
| 2026-10-10 | No prices and no platform/Super Admin content on the public docs; mobile app never links to plan-billing docs | Prices change; platform features are internal; store billing rules |
| 2026-10-12 | Docs nav logo/favicon reuse `apps/web`'s existing teal→green gradient brand as-is, not the ledger+brass system `ui-tokens.md §14` otherwise assumes for docs | Owner's explicit choice at D1.2: match the live product today; no real logo asset exists anywhere in the repo to begin with |
| 2026-10-12 | Docs header "Get the app" link omitted until D7 (mobile ships) | Mobile doesn't exist yet; avoids a dead link; matches `ui-rules.md §11.3`'s own deferral of the equivalent homepage strip |
| 2026-10-12 | Docs frontmatter zod schema lives in `apps/docs/lib/docs-schema.ts` (loader-free), re-exported from `lib/source.ts` where `defineDocs` is called — **not** a `source.config.ts` as `architecture.md §14.3`/`library-docs.md` assumed. This Fumadocs version's `defineDocs` (`fumadocs-mdx/macro`) is a compile-time macro with no fixed-filename config-loader contract; confirmed by reading the installed `fumadocs-mdx@15.4.7` source. Both docs corrected | Same pattern as the D1.1 `@fumadocs/base-ui` rename and the D1.2 Dokploy correction: verify against the installed package, not training-era assumptions, before writing config |
| 2026-10-12 | Docs `meta.json`/frontmatter `icon` values resolve via `fumadocs-core/source/plugins/lucide-icons`'s `lucideIconsPlugin()` (added to the loader's `plugins` array) — no hand-written `lib/icons.ts` icon map, as `library-docs.md` previously (incorrectly) described. `library-docs.md` corrected, with a note that some icon names from older Lucide releases don't exist in the installed `lucide-react@1.50` (`BarChart3`, `BookMarked`, `HelpCircle` have no equivalent by that name — use `ChartColumn`, `Bookmark`, `CircleQuestionMark`) | Simpler than the originally assumed icon map; found by reading the installed `fumadocs-core@16.17.1` package exports rather than guessing |
| 2026-10-12 | D1.3's draft-visibility requirement (sidebar only, not search/sitemap) implemented as `getVisiblePageTree()` in `lib/source.ts` — a plain recursive filter over `source.getPageTree()`, not a Fumadocs `pageTree.transformers` plugin | Fumadocs' transformer `file` hook can only modify a node, not remove it from its parent's `children`; a plain post-hoc filter is simpler and was verified directly (empty sidebar by default, full tree with `NEXT_PUBLIC_SHOW_DRAFTS=true`) |
| 2026-10-12 | D1.7's Dockerfile/nginx config were actually built and run (`docker build` + `docker run`) rather than written and left unverified | Docker was genuinely available in this session's environment, unlike the live staging target D1.6 needed — no reason to leave something testable untested. Caught two real bugs (`turbo prune` not carrying a cross-package `tsconfig.json extends`; nginx's template `envsubst` crashing on an absent, not just empty, var) that would only otherwise have surfaced on a real Dokploy deploy |
| 2026-10-12 | `web`'s Traefik wildcard router got an explicit `priority=1` label at D1.7, alongside adding `docs` | `architecture.md §17.3` flagged this as a latent gap the day `web` shipped alone (no competing specific-host router existed yet to need the ordering) — fixed now that `docs` (`priority=100`) actually creates the competing rule `web`'s `HostRegexp` would otherwise risk capturing |
| 2026-10-12 | D1.6 (screenshot pipeline) built as code-only, unverified — no attempt to seed a local dev stack or install real Playwright browsers and run a live capture | Owner's explicit choice among three options (ship unverified code / prove it end-to-end locally / defer to D1.7) after an investigation confirmed no staging environment, demo association, or Playwright setup existed anywhere in the repo to test against |
| 2026-10-12 | Docs GA4 ships with consent-mode defaults (analytics_storage/ad_storage denied) and **no visible cookie-consent banner** | Owner's explicit D1.5 call (`architecture.md §14.8` flagged this as "decide at D1.5"): the consent-mode defaults are the privacy-respecting technical baseline either way, and already a strict improvement over `apps/web`'s existing `GoogleAnalytics` component, which loads with no consent gating at all. Revisit before the DL launch milestone if the owner's own NDPR read says a banner is required |
| 2026-10-12 | Docs `Callout` built from scratch rather than wrapping Fumadocs' own `Callout` component | Fumadocs' type enum (`info`/`warn`/`error`/`success`/`idea`) doesn't match our required four (`note`/`tip`/`warning`/`danger`), and it reads `--color-fd-*` vars rather than the dedicated `--docs-callout-*` bg/border pairs `ui-tokens.md §14.2` defines specifically for this component |
| 2026-10-12 | Docs `PlatformTabs` only passes `persist={true}` to Fumadocs' `Tabs` after a feature-detect localStorage write/read/remove succeeds in a try/catch | `ui-rules.md §11.5` requires try/catch around the persisted choice; Fumadocs' own `groupId`/`persist` implementation calls `localStorage` directly with no try/catch, so an app-level guard was needed around it rather than forking the library |
| 2026-10-12 | Docs `LastUpdated`'s git-commit-date fallback (`architecture.md §14.3`) deferred — renders nothing if `lastVerified` is unset, no `git log` shell-out | Every real page sets `lastVerified` per the `code-standards.md §17.5` authoring workflow, so the fallback only covers a page that skipped that step; running `git log` for all 197 currently-unverified draft pages on every build has a real cost for zero present benefit — revisit when a concrete page needs it |
| 2026-10-12 | Docs `Faq`/`FaqItem` component (Accordion) built alongside, not instead of, `code-standards.md §17.3`'s plain-H2 FAQ page template | The two aren't actually in conflict: the H2 template is for the 9 dedicated FAQ *pages* (D6.2, SEO/anchor-browsable); the component is for Q&A blocks inside other pages that want the collapsed treatment. Authors choose per use, not a forced either/or |
| 2026-10-12 | Dokploy deployment is **one Compose application** (root `docker-compose.dokploy.yml`), not one Dokploy Application per app; `architecture.md §1`/§17 corrected to match. `library-docs.md`'s "each app = one Dokploy Application" wording is **not** corrected yet — owner explicitly deferred that to D1.7 | Reflects the real, already-working deployment (confirmed by reading the actual compose file); avoids touching unrelated doc wording before the apps it describes (docs, admin) actually exist as compose services |
| 2026-10-10 | `help-guides/*` and `docs/*` feature notes are migrated into the docs site and rewritten in the docs voice; web `/documentation*` 301-redirects to the docs site | One canonical manual |
| 2026-10-11 | **Split Super Admin into a separate app** `apps/admin` at admin.societyledger.com.ng, deployed separately on Dokploy; remove all Super Admin code from `apps/web` | Owner request: professional separation, independent deploys, smaller tenant attack surface |
| 2026-10-11 | Admin stack: Next.js (same major as web) + Mantine 7 + Tailwind, lift-and-shift of existing pages; server-side `/bff` proxy with host-only `httpOnly` session cookie | Fastest safe migration of ~13,400 lines; token never in browser JS or shared across subdomains |
| 2026-10-11 | Platform login only at the admin console (`/api/admin/auth/login`, 8 h sessions); tenant login returns `PLATFORM_LOGIN_REQUIRED` for platform users (from A3.1) | Clear separation of platform and tenant sessions |
| 2026-10-11 | Impersonation via single-use 60-second handoff code exchanged on the tenant subdomain; reason + duration (≤ 4 h) required | No JWTs in URLs; full audit trail |
| 2026-10-11 | TOTP 2FA for platform users planned (A1.4) — owner may defer without blocking the split | Platform accounts can change any tenant's data |
| 2026-10-11 | DB-backed documentation CMS not migrated to admin (replaced by the docs site) | Avoid two documentation systems |
| 2026-10-11 | Monorepo uses **pnpm 9** (`pnpm-workspace.yaml`); all commands in context files use pnpm | Owner migrated from npm |
| 2026-10-11 | **All apps deploy on Dokploy** (api, web, admin, docs; database and optional Redis as Dokploy services); docs hosting changed from Netlify to Dokploy (Nginx static container) | Owner's hosting platform |
| 2026-10-11 | PostgreSQL 16 runs as a Dokploy-managed database (migrated from Neon); `DATABASE_URL` = `DIRECT_URL` until a pooler is added; daily backups to S3-compatible storage | Owner migrated off Neon |
| 2026-10-11 | Track order: docs (D) → admin (A) → mobile (F); D and A may run in parallel except D6.3/A3.1 (both edit web) | Admin restructures web + auth before mobile builds on it |
| 2026-10-11 | Fixed pre-existing `apps/web` build break found while verifying D1.1: `src/app/dashboard/member/settings/page.tsx` was the **only** file in `apps/web` using `import React, { useState } from 'react'` (a default + named import); every other file imports `{ useState }` only. That default `React` binding made `React.ReactNode` resolve structurally differently from the `ReactNode` Mantine 7's compiled `.d.ts` files reference, so every Mantine component in that file's JSX tree failed `TS2786`. Fixed by switching to `import { useEffect, useState } from 'react'` (matching every other file) and removing `useEffect`. Also removed `"ignoreDeprecations": "6.0"` from `apps/web/tsconfig.json` (current TypeScript rejects that value; a second, independently-broken line masked behind the first). Several false leads ruled out along the way, worth not re-trying: pinning `typescript` down to 5.4.5 (no effect — error is independent of the TS minor version), pinning `@types/react`/`@types/react-dom` down to 18.2.x (no effect — `Key = string \| number \| bigint` has been in `@types/react` since at least 18.2.79, nothing to do with a recent bump) | Caught by the D1.1 DoD's "web still passes" check; file was apparently never type-checked after being written (a `next build`/`tsc` run was not part of the original workflow) |
| 2026-10-13 | D2.1 treats a local `docker-compose.yml` stack (local Postgres, `apps/api` + `apps/web` run via `pnpm dev` on non-default ports 4001/3002) as equivalent to "staging" for `code-standards.md §17.5`'s accuracy workflow, rather than waiting on the Dokploy deploy | Owner's explicit call: same code/schema/seed data as real staging; no reason to block a session on infra when a real browser (via Playwright, see below) can verify locally. Revisit if something ever behaves differently on the real Dokploy staging URL |
| 2026-10-13 | No interactive browser-automation tool was available this session (same gap as D1.2/D1.4/D1.5/D1.6) — used `@playwright/test` (already an `apps/docs` devDependency from D1.6) scripted via Bash/Node instead: a real headless Chromium, screenshots read back via the Read tool, driven by small throwaway scripts in `apps/docs/.tmp-verify/` (not committed) | Equivalent verification value to a live browser tool for this kind of walkthrough-and-screenshot work; also exercises the exact tool (Playwright) D1.6's own capture pipeline depends on |
| 2026-10-13 | `install-the-mobile-app` (D2.1) stays `status: draft` until D7.1, same precedent as D2.3's two mobile-only pages, even though the build-plan's D2.1 bullet didn't call it out explicitly | No mobile app exists yet (Mobile track hasn't started) — nothing to screenshot or verify, same underlying reason as the D2.3 precedent |
| 2026-10-13 | D2.1 pages use `platforms: ["web"]` rather than the sitemap's literal `W+M`, for pages genuinely verified this session (`onboarding-wizard`, `joining-as-a-member`, `signing-in`) | Mobile doesn't exist yet; claiming mobile support before D7.1 adds real mobile steps would be asserting something unverifiable. Expect this pattern to repeat for other W+M pages until D7 |
| 2026-10-13 | Three small, `NODE_ENV === 'development'`-guarded changes added to `apps/api` to make local verification practical, left in place rather than reverted: (1) `auth.service.ts` logs the plain verification code / password-reset URL to the server console (there's no email inbox to read in dev); (2) `server.ts`'s CORS allow-list also accepts any `*.localhost:<port>` origin, not just `:3000` (needed once two local instances run on different ports); (3) `rate-limit.middleware.ts` skips rate limiting entirely (repeated local test runs otherwise trip the same limiter real abuse would) | Owner approved each one individually as it came up. None of the three can fire in a deployed environment (Dokploy sets `NODE_ENV=production`) — but worth a deliberate decision on whether to keep, tighten, or remove them before D6.4 launch, not just leave them from momentum |
| 2026-10-13 | **Real, previously-undocumented product behavior found while verifying D2.1: every new account — founder (`/signup`) or self-registered member (`/auth/register`) — needs both email verification *and* approval by a SocietyLedger platform admin before they can sign in**, and that approval currently only happens through the platform Super Admin console (`/admin/associations` → Pending Approvals), not any tenant-level screen. Confirmed by direct DB inspection (`is_active`/`approval_status`), not just UI copy. Documented in `create-your-association.mdx` and `joining-as-a-member.mdx` | Not an assumption to silently work around — every real signup in later features will hit the same gate, and whoever owns demo/QA data entry needs platform-admin access to unblock it |
| 2026-10-13 | Fixed a real bug in `app/docs/[[...slug]]/page.tsx` (D1.4-era code): the overview-page auto `CardGrid` listed every child page via `source.getPages()` with no status filter, so a still-`draft` page would appear as a browsable card next to its published siblings. Exported `isVisible()` from `lib/source.ts` (previously module-private, already used for sidebar draft-filtering) and reused it in the child-page filter | Directly affects the `getting-started` overview page being published this feature (`install-the-mobile-app` would otherwise show up as a card) — in scope, not a tangent |
| 2026-10-13 | D3.1's RBAC gap (G16) fixed **for the demo association's data only** — 3 `RolePermission` rows added directly to `demo`'s own `member` Role, `rbac-seed.ts`'s shared template left untouched | Owner's explicit call ("fix this in the most professional way possible") after being shown that the only available fix meant granting broad officer-level keys (`ledger.view`, `ledger.create`, `members.view`) with no narrower self-service equivalent existing anywhere in the codebase — broadening the real template would over-privilege every member in every association; a scoped, reversible, demo-only data change gets the pages documented against real screens without that risk |
| 2026-10-13 | Two bugs in `cooperatives.service.ts`/`.controller.ts`'s `getPendingGuarantorRequests` fixed directly (wrong filter field; wrong response wrapper) — a third, deeper bug (missing `loanApplication` in the formatted response, crashing the frontend) left unfixed, logged as G16 | The first two were one-line, obviously-correct fixes confirmed by curl before and after, same class as other small real-bug fixes this session (D2.1's `isVisible()` fix, the two demo-seed bugs at D1.6). The third would mean designing a new response shape for a feature that's apparently never been tested end-to-end — a real feature fix, not a docs-session-scoped change |
| 2026-10-13 | `paying-online.mdx`/`paying-by-bank-transfer.mdx` kept as two separate pages per the original sitemap, each documenting the real self-declare payment behaviour (G17) with a warning callout, rather than merged into one page or blocked pending a product decision | Owner's explicit choice among three options presented after the Paystack/proof-upload gap was found |
| 2026-10-13 | `meetings-and-attendance.mdx` and `voting.mdx` changed from `type: task` to `type: concept` in-flight, since both underlying screens (G19) are static placeholders with no real steps a member can currently perform | Matches the actual page template rules (`code-standards.md §17.3`) — a task page needs real steps to perform on staging; neither screen has any |

## Known issues / tech debt
- `apps/web/src/utils/domain.ts`'s `getBaseDomain()` hardcodes `'localhost:3000'` whenever `window.location.hostname === 'localhost'`, ignoring `NEXT_PUBLIC_BASE_DOMAIN` and the real port. Only surfaces in local dev on a non-default port (e.g. the signup success screen's "Your association URL" showed the wrong port during D2.1 verification); production is unaffected since `hostname` is never literally `localhost` there. Not fixed — out of scope for a docs feature.
- No tenant-level screen lets an association's own admin approve a newly self-registered member (`/auth/register`) — the only `approvalStatus` UI anywhere is the platform Super Admin console. Confirmed by grep (`approvalStatus` appears only in `apps/admin`-bound `apps/web/src/app/admin/**` and `types/index.ts`). May be intentional for this version or may be a gap — flagging rather than assuming either way.
- `prisma/seeds/demo-association.seed.ts`'s three login users (`admin@demo.com`, `treasurer@demo.com`, `member@demo.com`) need `pnpm seed:rbac` run *after* the demo association exists to get real RBAC permissions — `rbac-seed.ts` only assigns per-association system-role permissions to associations that already exist at the time it runs. Running `db:seed` → `seed:demo` → `seed:rbac` in that order (not just the first two, as `seed-demo.md` said before this session) gets a fully working demo association. Worth considering whether `seed:demo` should just call this itself.
- `apps/api/tsconfig.json`'s `"ignoreDeprecations": "6.0"` / `"moduleResolution": "node"` pair is load-bearing, not just stale wording (unlike `apps/web`'s equivalent, fixed at D1.1): removing both to try the same fix surfaced `TS2742` ("inferred type of 'router' cannot be named") in 38 route files, meaning this package has apparently never been type-checked clean either. Reverted the attempt — real fix is annotating each file's exported `Router`, out of scope for a docs feature. `pnpm -F @societyledger/api type-check` should be treated as currently non-functional, not as a signal about code touched this session.
- The member dashboard's (`/dashboard/member`) **Outstanding Balance** stat card shows ₦0.00 even when the member genuinely has an outstanding balance elsewhere (confirmed with `member@demo.com` showing ₦0.00 on the dashboard while **My Finances** correctly showed ₦5,500 outstanding at the same time). Not root-caused; found at D3.1 writing `your-dashboard.mdx`, worked around there by pointing readers to My Finances for the real figure rather than describing the dashboard stat as reliable.
- A penalty's displayed reason text includes a literal `null` (e.g. "Late fee for null - Late Dues Fee") — `penalties.service.ts`'s `applyLateFees()` builds the note from `` `Late fee for ${txn.referenceNumber} - ...` ``, and `referenceNumber` is apparently unset on at least some transactions. Found at D3.1; not fixed, not described verbatim in `dues-levies-and-penalties.mdx` (described generically as "a late fee" instead).
- `apps/api/src/modules/member-invites/member-invites.service.ts` hardcodes the activation URL to `:3000` (`http://${subdomain}.localhost:3000/auth/activate?token=...`) rather than reading `FRONTEND_URL` — same class of issue as `getBaseDomain()` above, found while resolving Q1. Not fixed, same reasoning (local-dev-only, out of scope for a docs feature).

## Session notes
_(Short notes for the next session: what was in progress, anything half-done. Clear when resolved.)_
