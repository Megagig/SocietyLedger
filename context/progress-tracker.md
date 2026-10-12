# Progress Tracker — SocietyLedger Docs Site, Admin Console & Mobile

> **Living document.** Updated after every feature ships. A new session reads this first to know exactly where things stand. Build the **next unchecked item in the Master sequence** whose dependencies are checked (order and details in `build-plan.md`). Docs track (D) comes first, then the admin track (A), then the mobile track (F), with D7.x after mobile milestones.

## Current status
- **Track / phase:** Docs D1 — in progress
- **Next feature:** D1.4 MDX component kit
- **Last updated:** 2026-10-12 (D1.3 shipped; architecture.md §14.3 and library-docs.md's Fumadocs section corrected same session — `source.config.ts` and the hand-rolled icon map were both stale)
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
- [ ] D1.4 MDX component kit
- [ ] D1.5 Search, SEO, analytics & feedback
- [ ] D1.6 Screenshot pipeline & demo association
- [ ] D1.7 CI, preview deploys & hosting

## Docs Phase D2 — Start & concepts
- [ ] D2.1 Introduction & Getting started (8 pages)
- [ ] D2.2 Core concepts & glossary (8 pages)
- [ ] D2.3 Account & security (8 pages; 2 mobile-only stay draft until D7.1)

## Docs Phase D3 — Members & money
- [ ] D3.1 Member guide (16 pages)
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
| Introduction & Getting started | 8 | 0 | 0 | 0 |
| Core concepts | 8 | 0 | 0 | 0 |
| Account & security | 8 | 0 | 0 | 0 |
| Member guide | 16 | 0 | 0 | 0 |
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
| **Total** | **197** | **0** | **0** | **0** |

Web route coverage (from `scripts/coverage.ts`): _not run yet_.

## Docs questions (unresolved content questions)
| # | Page | Question | Asked | Answer / status |
|---|---|---|---|---|
| _(none yet)_ | | | | |

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

**Totals:** Docs 0 / 30 · Admin 0 / 21 · Mobile 0 / 65 features (116 total) · Milestones 0 / 5 (DL, AL, M1, M2, M3)

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

## Known issues / tech debt
_(none yet)_

## Session notes
_(Short notes for the next session: what was in progress, anything half-done. Clear when resolved.)_
