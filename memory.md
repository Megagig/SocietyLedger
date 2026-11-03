# Memory: Demo data seed, built, merged and run on production (2026-11-02)

Last updated: 2026-11-03

> Replaces the 2026-11-02 cooperative memory. The cooperative work was committed and merged (see `context/progress-tracker.md` Track C and git history). Items still open are under "Carried over" and "Open questions". No secrets here.

## What was built

One-time, idempotent demo-data seed for production testers. Code in `apps/api/prisma/seeds/demo/` (`config.ts`, `core.ts`, `finance.ts`, `community.ts`, `cooperative.ts`, `ajo.ts`, `invariants.ts`, `reset.ts`, `credentials.ts`, `run.ts`, `index.ts`). Runbook in `DEMO_SEED.md`; tracker entry in `context/progress-tracker.md`.

- **Schema:** `is_demo` on `associations` and `users`, new `system_seeds` table (migration `20261128_demo_flags_and_system_seeds`).
- **Runtime guards for demo tenants:** `middleware/demo-guard.middleware.ts` (403 `DEMO_PAYMENTS_DISABLED`, `DEMO_ACCOUNT_LOCKED`, `DEMO_OUTBOUND_DISABLED`, `DEMO_EMAIL_RESTRICTED`, 413 over 1 MB), `lib/demo.ts`, and demo checks in `lib/email.ts`, `sms-engine.ts`, `push.service.ts`. Platform admin counts exclude `is_demo`.
- **Tests:** `apps/api/__tests__/demo-seed/` (15 unit, 13 integration; the integration suite needs `DEMO_TEST_DATABASE_URL`).
- **8 tenants, 52 logins** (48 can sign in; `member-suspended` and `member-pending` in unity and umuahia are blocked on purpose): `demo-unity`, `demo-umuahia`, `demo-lagoscoop`, `demo-alumni`, `demo-grace`, `demo-club`, `demo-balogun` (rotating Ajo circles), `demo-mamangozi` (collector thrift). Emails are `<key>.<short>@demo.societyledger.com.ng`; `amaka.dual@...` is one person in unity and balogun.
- Branches `Cooperative-Enhancement` and `demo-seed` were merged to `develop`, then `main`, and deployed on Dokploy.

## Decisions made

- Script is `seed:demo-tenants`. The older `seed:demo` is the docs-screenshot seed; never run it on production.
- Gateway calls are blocked with 403 for demo tenants, not simulated (the app has no gateway test mode).
- No platform Super Admin for testers; admin-console testing is staging-only. A "demo platform viewer" role was proposed, not built.
- Seed is manual only: not run on deploy, no `SEED_DEMO` in Dokploy env. A one-time opt-in deploy variant was discussed and not built.
- A killed or failed run cannot resume: the next run refuses and says to use `--reset-demo`.
- Not seeded: documents (no module), receipt and proof files (need object storage), dividends, penalties, bank reconciliation, cash collections. Welfare, savings and loan rows are not posted to the books.

## Problems solved

- Standalone thrift groups need the `ajo-business` add-on (base plan allows 0 contributors); `ensureAjoAccess` grants it.
- Some tables carry `association_id` with no foreign key (`onboarding_progress`, `ajo_levy_assessments`, `platform_action_logs`); `--reset-demo` sweeps them by demo tenant ids.
- Dokploy: this app is a compose project, so there is no Backups tab. The Docker Terminal puts you in a `/bin/sh` shell inside the API container at `/`, so `docker exec` does not apply; run `cd /app/apps/api` first. Run the seed with `nohup ... &` and `tail -f /tmp/seed.log` so a dropped browser session does not kill it. Do not start it twice: two runs share one log file and the second refuses with "earlier run did not finish".
- Backup was taken with `pg_dump` inside the postgres container (checked with `pg_restore --list`).
- Cloudflare: the wildcard `*.societyledger.com.ng` A record (DNS only) already covers `demo-*`; no DNS change was needed.

## Current state

- The seed ran on production on 2026-11-02 and finished: `Result: applied, 52 accounts`, all 10 integrity checks passed. `admin.unity@demo.societyledger.com.ng` signed in on `https://demo-unity.societyledger.com.ng` with the chosen shared password (60 members, dashboard populated).
- The credentials sheet and log were deleted from the server. The shared password is held only by the owner; if lost, run `--reset-demo` with a new `DEMO_PASSWORD` (needs `DEMO_RESET_CONFIRM="DELETE DEMO DATA"` when there is no terminal).
- The pre-seed backup `/tmp/pre-demo-seed.dump` still sits inside the postgres container; delete it after the testing window, ideally after copying it off the server.
- Not verified: restore of a production backup to a copy, the web and mobile UIs by eye or on a device (only API-level login and permission checks), the full existing test suites and e2e, the strict production `tsc` (accounting controllers show errors, not touched here), mobile login with a tenant code.

## Next session starts with

1. Ask whether testers could sign in on web and mobile; check mobile with tenant code `demo-unity` and one login per role.
2. Delete `/tmp/pre-demo-seed.dump` in the postgres container once the testing window is over.
3. If a v2 seed is wanted (new features), follow "Adding data for new features" in `DEMO_SEED.md`; bump `SEED_VERSION`.

## Open questions

- Build the restricted "demo platform viewer" role, or keep admin testing on staging?
- Build the one-time opt-in deploy variant of the seed, or keep the manual run?
- Cooperative: is the cashbook interest meaning (charged at payout, shown as "still to pay") what the owner wants? Is "Part paid" for a past month acceptable instead of "Defaulted"? Should custom roles get the new cooperative permissions automatically (currently they do not)?

## Carried over

- Cooperative follow-ups from the last round: rerun `ajo-bulk` alone to confirm the timeout flake; decide on `billing/default-plans.integration` (redeclared `TEST_DB` and `suite` across test files) and `multi-tenancy/isolation` and `multi-tenancy/subdomain` (Jest cannot parse `otplib`; not confirmed pre-existing; the demo integration test mocks `otplib`). Browser-check the unverified web items: loan-product category field, goods-loan item description, account-type choice when opening an account, editing a type, reject dialogs, Excel export and Print. Run mobile on a device.
- Thrift/Ajo security review (`docs/thrift/security-review.md`): open findings F-1 (check production is not `FEATURE_FLAG_MODE=shadow`), F-3 (no password re-check on payout-account change or reveal), F-4 (idempotency replay does not check who asks). T12.2 failure drills and T12.3 pilot are not done.
- Owner to rotate `REVALIDATE_SECRET`, confirm Redis, `COOKIE_DOMAIN` and the Paystack callback and webhook in production, and make one small real payment to watch the full return flow.
- Caching follow-ups: about 200 older web query keys use the old shape; about 50 web files fetch in `useEffect` outside the cache; board reads repeat a roughly 13-query preamble; about 160 unbounded `findMany` calls; `lib/prisma.ts` retries a failed connection for up to 12 s.
- Never run `robocopy /MIR` or bulk-delete through links or worktrees (it wiped `apps/` and `packages/` once). `node_modules` has gone empty before builds; `pnpm repair:deps` fixes it.
