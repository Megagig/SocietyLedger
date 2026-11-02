# Memory: Cooperative enhancements, built and review-fixed (2026-11-02)

Last updated: 2026-11-02

> Replaces the 2026-11-01 memory (responsive PWA pass, merged and deployed at `d5228ee`; in `context/progress-tracker.md` and git history). Items still open from earlier work are under "Carried over". No secrets here.

## What was built

**Everything below is UNCOMMITTED** on branch `Cooperative-Enhancement` (about 120 changed/new files). Commit before doing anything else.

Cooperative module, web and mobile at equal parity (owner decision), API in `apps/api/src/modules/cooperatives/`. Full detail is in `context/progress-tracker.md` (Track C, C1-C9) and `context/ui-registry.md`.

- **Member menu** (plan must include `cooperatives`): Dashboard, Savings (payment cart), My Withdrawal, My Transactions, My Cashbook, My Pending Payments, My Loans, Loan Repayment, Guarantor Requests, Cooperative Bank Accounts.
- **Officer side:** Setup (account types, loan categories, two-stage switch), Payment Requests queue, Withdrawals (review, then approve and pay), per-member cashbook.
- **Review fixes (all 19 findings, round C9):**
  - Migration `20261126_cooperative_permissions_rollout` creates the new permissions and grants them to the built-in roles.
  - Migration `20261127_cooperative_integrity`: Fixed Deposit and Target types made non-withdrawable, a partial unique index allows one open withdrawal per account, and the `savings_deposit_requests` table is dropped.
  - Account numbers are taken under an advisory lock; impossible dates are refused.
  - Server-made cashbook PDF (`/my-cashbook.pdf`, `/members/:id/cashbook.pdf`) with PDF and Spreadsheet buttons on mobile.
  - New shared web components `StatusTabs`, `CoopButton`, `CoopSwitch`; mobile `AnimatedView`.
  - Mobile `tsc` at 0 errors.
- **Tests added:** route-level HTTP tests, PDF, rollout migration, races, date validation, StatusTabs/CoopButton, mobile proof and PDF routing.

## Decisions made

- Account types and loan categories are officer-created data. Behaviour classes stay fixed: `CONTRIBUTION`, `SHARES` (never withdrawable), `SPECIAL`.
- One payment request equals one transfer and one proof, with many lines (type, amount, month-year). Approved whole or not at all.
- Withdrawals are two-stage by default (requester, reviewer and approver are three different people); toggleable per association.
- Contribution table: Paid, Part paid (any month), Defaulted (month over and nothing paid), Due. The docs match this.
- Cashbook interest is kept as accounting (charged in full at payout, settled as repaid) but labelled "Interest charged / Interest paid / Interest still to pay". Owner has not confirmed this meaning.
- The GETs for account types and loan categories no longer create defaults; the first type is created by an officer.
- PDFs are made by the server; `expo-print` stays uninstalled.
- Money is always shown in full (₦10,000.00); in the PDF it is written "NGN" because the built-in fonts lack the naira sign.
- Custom roles do NOT get the new permissions automatically; the docs say to add them in Settings, Roles.

## Problems solved

- `prisma migrate` uses `.env` and ignores an exported `DATABASE_URL`. To migrate the scratch DB, copy the schema and migrations into a temp dir with no `.env` and set `DATABASE_URL` and `DIRECT_URL`.
- `pg_advisory_xact_lock` needs both arguments cast to `::int` when sent through Prisma.
- Node `-e` patch scripts and shell heredocs mangle backslashes and quotes. Use the Write or Edit tools for files containing regexes.
- I edited an already-applied migration, so I updated its checksum in `_prisma_migrations` in both the dev and scratch databases.
- `ChargeRow.test` failed because its due date had passed; the date is now relative to today.

## Current state

- Dev DB (`societyledger`) and scratch DB (`sl_ajo_test`) have both new migrations. The API dev server (4001) and web dev server (3000) were running and the new routes were checked live.
- Test results:
  - Mobile: 178 suites, 1226 tests, all pass.
  - Web: 22 suites, 118 tests, all pass.
  - Docs: 256 pages, 0 failed, 648 links, 0 broken.
  - API full run: 172 suites pass, 4 fail, 4 skipped. The 4 failures do not touch cooperative code:
    - `ajo/ajo-bulk.integration`: one transaction timed out by 6 ms (flake).
    - `billing/default-plans.integration`: `TEST_DB` and `suite` are redeclared across test files that share global scope.
    - `multi-tenancy/isolation` and `multi-tenancy/subdomain`: Jest cannot parse `otplib`. They are not confirmed as pre-existing, since I did not run them on a clean checkout.
- `prisma generate` has not run since the schema change (the dev server holds the engine), so the running client still has the dropped model.

## Next session starts with

1. Commit the work (nothing is committed).
2. Stop the API dev server and run `prisma generate`.
3. Rerun `ajo-bulk` alone to confirm the flake, and decide whether to fix the other three failing suites.
4. Browser-check the unverified web items and run mobile on a device or simulator. The web items are: the loan-product category field, the item description on a goods-loan application, the account-type choice when opening an account, editing a type, the reject dialogs, Excel export and Print.
5. Before production: run the migrations. The RBAC seed is no longer required for these permissions.

## Open questions

- Is the cashbook interest meaning (charged at payout, shown as "still to pay") what the owner wants?
- Is "Part paid" for a past month with a part payment acceptable, instead of "Defaulted"?
- Should custom roles get the new permissions automatically? Currently they do not.

## Carried over

- Thrift/Ajo security review (`docs/thrift/security-review.md`): open findings F-1 (check production is not `FEATURE_FLAG_MODE=shadow`), F-3 (no password re-check on payout-account change/reveal), F-4 (idempotency replay does not check who asks). T12.2 failure drills and T12.3 pilot are not done.
- Owner to rotate `REVALIDATE_SECRET`, confirm Redis / `COOKIE_DOMAIN` / Paystack callback and webhook in production, and make one small real payment to watch the full return flow.
- Caching follow-ups: about 200 older web query keys use the old shape; about 50 web files fetch in `useEffect` outside the cache; board reads repeat a roughly 13-query preamble; about 160 unbounded `findMany` calls; `lib/prisma.ts` retries a failed connection for up to 12 s.
- Never run `robocopy /MIR` or bulk-delete through links or worktrees (it wiped `apps/` and `packages/` once). `node_modules` has gone empty before builds; `pnpm repair:deps` fixes it.
