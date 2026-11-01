# Memory: T12 hardening, performance caching, and the production fixes after the first real deploy (2026-10-31)

Last updated: 2026-10-31

> Replaces the 2026-10-30 memory (Thrift/Ajo T11 docs, standalone groups, payments, payout order). That work is recorded in `context/progress-tracker.md` and git history. No secrets here (a deploy secret was pasted in chat once; its value is deliberately not kept).

## What was built

**Security review (T12.1, partly):** `docs/thrift/security-review.md`. One fix: an officer cannot waive their own late fee while another officer exists (`ajo-latefee.service.ts`, test in `ajo-latefees.integration.test.ts`). Open findings F-1 (check production is not `FEATURE_FLAG_MODE=shadow`; it is `enforce`/empty), F-3 (no password re-check on payout-account change/reveal), F-4 (idempotency replay does not check who asks). **T12.2 failure drills and T12.3 pilot are NOT done.**

**Performance caching (merged: PR #33 into Thrift-Add-on, then develop, then main):**
- `packages/query` (`@societyledger/query`): pure logic, NO React (web/admin are React 18, mobile React 19; react-query installs once per React version, so a shared hook binds to the wrong React). Keys always start with the association; freshness table (static 30 min, directory 5, aggregate 90 s, money 30 s + recheck on open); deny-by-default persistence; named invalidation events; client factory on `query-core`.
- Web: TanStack Query v4 to v5; one query client per signed-in identity (`lib/query/QueryBoundary.tsx`), IndexedDB persistence, `useScopedQuery`, dashboard/settings/Members migrated, Members prefetch, "Updating / Offline · last updated" line (`FreshnessNote`). Mobile: shared rules, `lib/queryClient.ts`, cache wiped on any move into `unauthenticated`. Admin: shared client, react-query pinned to the same version.
- API: gzip, `Cache-Control` private no-cache reads / no-store writes, payment callbacks clear dashboard+report caches via `syncPaymentEffects`, 30 s circle-board cache (`modules/ajo/ajo-cache.ts`, versioned per association, bumped before a writer's response and by the jobs), migration `20261124_ajo_waiting_payments_index`, DB pool `connection_limit=20&pool_timeout=20` in `docker-compose.dokploy.yml`.
- Docs: `CACHING.md`, `docs/caching/audit.md`, context files, tracker, ui-registry.

**Fixes found testing payments and after deploy (all on `main`, deployed and confirmed working by the owner):**
- `apiFetch` sent no token (HttpOnly cookie unreadable), so the API used a browser-wide cookie holding whoever signed in last: `TENANT_MISMATCH` for anyone with accounts in two groups. `utils/api.ts` now reads this tab's `auth-storage` token first.
- Plans page for standalone thrift groups shows the Ajo tiers first (`?addons=` pre-ticks checkout); trial button says Subscribe.
- Payment return page stuck on "Verifying" in development (a `started` ref + React StrictMode double effect): `components/subscription/VerifyPayment.tsx`.
- CORS: `Idempotency-Key` and `Cache-Control` request headers were blocked. Allowed list in `apps/api/src/lib/cors-headers.ts`; `Cache-Control` request header removed from two web calls; guard test scans all web header names.
- Mobile Profile -> About shows version + build (`src/lib/appVersion.ts`; set `version` in `apps/mobile/app.config.ts` line ~136, package.json's copy is unused).
- "Not part of your plan" pop-up on every page for associations without Ajo: the sidebar "payments waiting" call is now only made when `useAjoNav().available`, and a refusal is quiet.
- 429s: API never trusted its proxy, so every visitor shared one `req.ip` bucket. `app.set('trust proxy', trustProxyHops())` (1 in production, no Cloudflare in front; `TRUST_PROXY_HOPS` overrides). Per-association limiter now reads `tenantId`.
- Breadcrumbs: six folder-only sections shown as text (`lib/breadcrumb-paths.ts`, test checks against disk). Service worker `staleWhileRevalidate` now answers `Response.error()` when nothing is saved and the network fails.

## Decisions made

- The shared query package must stay React-free; each app wraps it in its own few-line hook.
- Persistence is opt-in per domain in `packages/query/src/policy.ts`; payments, payouts, bank details, proofs, links are never saved on a device. Money screens keep the old broad refresh; only dashboard, settings, Members and the board moved to the new keys.
- Board cache: never cache one person's own money (savings, payments, contributions).
- Production API build is deliberately lenient: `tsconfig.prod.json` has `strict:false` and the Dockerfile ends the build with `|| true`, so ~86 Zod "optional but required" type errors print in the Dokploy log on every deploy. Identical count (86) before and after this work; not a failure.
- `docker-entrypoint.sh` runs `prisma migrate deploy` and the seeds on EVERY container start (no manual migration step). A failing migration stops the API from starting: back up first. Ajo tiers are seeded once at 3,000 / 8,000 / 20,000 naira per month (Enterprise hidden).
- Ajo is an add-on, not part of Enterprise; the admin "Change plan" dialog only swaps the plan (no billing cycle). To set a yearly cycle use admin Subscriptions -> association -> Activate a plan.

## Problems solved (do not repeat)

- `pnpm install --filter ...` on this Windows machine leaves EMPTY package folders under `node_modules/.pnpm` (web could not find `next`, API could not find `semver`). Only ever run a full `pnpm install`; repair by deleting the empty folders and a full `pnpm install --frozen-lockfile --prefer-offline`. A package-integrity check: `pnpm store status`.
- Never `git add apps/web` or `git add .`: it swept the owner's uncommitted rules-acceptance work into a caching commit. Stage files by name. Check `git branch --show-current` before committing: the owner moves between Thrift-Add-on, develop and main; an earlier message wrongly said "Thrift-Add-on" when commits were on main.
- Shell quoting: backticks and `$use`/regex backslashes get eaten inside `node -e "..."` and heredocs; write scripts/tests with the file tool.
- A jest test that mocks `Response` fails under jsdom (no `Response`): return `{ status: 200 } as Response`. Mocks in `jest.mock` factories cannot see later `const`s (use the imported module and mutate it).
- The same email can be several accounts (one per association); logins are tenant-scoped, so never assume one user per email.
- Scratch DB for API integration tests is `sl_ajo_test`; run Ajo suites with `AJO_TEST_DATABASE_URL` (dev URL with the db name swapped, never printed) and `--forceExit --runInBand`.
- Headless Chromium via `playwright-core` (in the pnpm store) can drive the dev server with stubbed `**/api/**` routes; used to reproduce the pop-up, the CORS block and the payment page.

## Current state

- Branch `main` = `origin/main`, clean, deployed to production and working. `develop` and `Thrift-Add-on` do NOT have the last four commits (`91b09f4` pop-up, `fce9496` trust proxy, `0965cca` per-association limit, `9850f53` breadcrumbs + service worker).
- Tests at last run: package 26; web 106 (type-check 0, build passes); mobile 1,199 (only `manage/index.test.tsx` fails, pre-existing); API Ajo suites ~866 plus the new cors/http-cache/trust-proxy/rate-limit/payment-sync tests. Two API multi-tenancy suites fail as before; `billing/default-plans` failed once in a full run, not reproduced.
- NOT verified by a person: any new screen on a phone; Slow 3G timings and request counts; airplane mode / reconnect; switching association; a brand-new real Paystack payment through the fixed return page; the owner's live money check (a payment completing and the balance updating at once); the rules-acceptance feature (it came in with the owner's "Finalised the performance caching" commit and was not reviewed by me, though its tests pass).
- Savio 96 Alumni Association (association 4, production) is on Enterprise; the owner said they would grant it the Ajo add-on themselves.

## Next session starts with

1. Ask the owner whether to cherry-pick the four post-merge fixes onto `develop` and `Thrift-Add-on` (they are only on `main`). Do not touch those branches unasked.
2. Then T12.2 failure-mode drills (duplicate request, partial payment, reversal, void payout, add-on expiry, stale draw, roster change after the order is set; one test each, ledger reconciles, plus an officer runbook in `docs/thrift/failure-drills.md`), then T12.3 pilot prep (`docs/thrift/pilot-plan.md`). Re-run `/architect` first if the owner wants changes.
3. Owner to do (not me): rotate `REVALIDATE_SECRET` (it was pasted in chat), confirm Redis/`COOKIE_DOMAIN`/Paystack callback+webhook in production, and make one small real payment to watch the full return flow.

## Open questions

- Mobile Manage and Circle tabs: the owner said my earlier reading was wrong and halted it; what they want is still unknown (Manage shows an empty "Officer hub" for someone with a manage-list permission but no hub entry; Circle shows nothing when the board is off).
- Instant (no-notice) Circle board switch for an open circle: undecided. Payout-order names: full names vs first name and initial: undecided.
- Owner decisions still open: F6 (what each Ajo tier includes), F7 (standalone sign-up ships closed by default), F8 (Enterprise price placeholder).
- Admin "Change plan" dialog: show both monthly and yearly prices in the labels (safe), or add a cycle choice (changes live subscription behaviour; needs a decision).
- Whether to turn `strict` on in the production API build (needs the ~86 Zod type errors fixed first; not needed for anything deployed).
- Known follow-ups not done: ~200 older web query keys still use the old shape; ~50 web files fetch in `useEffect` outside the cache; every board read repeats a ~13-query preamble (121 queries to open a 3-person circle uncached); about 160 unbounded `findMany` calls; `lib/prisma.ts` retries a failed connection for up to 12 s; security findings F-3 and F-4.
