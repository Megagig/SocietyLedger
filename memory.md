# Memory — Mobile Phase 5 (Officer essentials) built, reviewed and fixed

Last updated: 2026-10-25

## What was built

Phase 5 (F5.1–F5.8, plus F5.5b cash collections and lodgments) is built on API, mobile, web and docs, reviewed with `/review`, and every finding fixed except the ones under Open questions. Per-feature detail is in `context/progress-tracker.md` (Phase 5 rows, "Phase 5 review fixes", "Amounts in full…", "Donation pledges can be paid…") and `context/ui-registry.md` — not repeated here.

Work of this session, in order:
- **F5.1 Manage hub & Home — Association:** one permission- and module-aware call `GET /dashboard/attention` (`apps/api/src/modules/dashboard/attention.service.ts`) feeds the "Needs your attention" list (mobile Home → Association, web dashboard card) and every Manage-hub badge. Also fixed the dashboard's overdue count (now by due date) and excluded voided charges.
- **Phase 5 review fixes:** `/dashboard/overview` now needs `ledger.view` (it had no permission check); reconciliation can be decided once; bank transfers keep `recorded_by` (migration `20261025_add_bank_transfer_recorded_by`) so the recorder can't verify their own; undo-delete restores payments and donation records; dashboard cache is 1 minute and cleared on proof verify / reconciliation / undo; production startup logs a loud error when `MINIO_PUBLIC_ENDPOINT` is missing; web lint 0 errors (98 fixed); every web `prompt()` replaced by `hooks/usePrompt`; old web transfer list/record pages redirect to the one Bank transfers page; Manage hub render test; D7.2 officer docs done.
- **Money always in full on mobile:** `formatMoney` never abbreviates (₦10,000.00, never ₦10k); the `compact` option was removed everywhere, including chart axes.
- **Donation pledges (/recover):** `GET /members/me/donations` returns `amountPaid`, `balance`, `isPledge`, `dueDate`; My Donations (mobile + web) counts only paid money as "donated" and shows "Pledged, still to pay"; a pledge opens the pay screen (online or bank transfer). Paystack/Nomba `initialize` now refuse a charge that isn't the caller's (`payments/charge-ownership.ts`).

## Decisions made

- Build every feature at parity on web AND mobile; fix API/platform loopholes found; update the docs site, `progress-tracker.md` and `ui-registry.md` after each feature; ask before adding any library.
- Charts stay on `react-native-gifted-charts` (victory-native was never installed; architecture, build plan and library docs updated).
- Money is written in full everywhere (saved as a feedback memory too).
- Manage hub / attention rows for cooperatives, welfare, voting, accounting, reports and communications are NOT added until their mobile screens exist (Phase 6+), so nothing links nowhere. Loan/savings/welfare queues are counted by the API and shown on web only.
- A user can't verify what they recorded themselves (proofs and now bank transfers); a one-officer association can't self-verify.

## Problems solved

- Signed receipt links must point at an address the phone can reach (`MINIO_PUBLIC_ENDPOINT` in production; dev follows the PC's LAN IP).
- Bash heredocs and long inline node scripts break on quotes: write script files with the Write tool, use function replacers with `String.replace`, never a bare `cat >`.
- `jest.mock` factories may only use variables whose names start with `mock`; Jest can't load reanimated/gorhom, so mock `Skeleton`/`Screen` etc. in component tests.
- Upload failures with `ECONNREFUSED 127.0.0.1:9000` mean the local MinIO container is stopped: `docker start societyledger-minio` (it exited with code 255 after a Docker/PC restart; two other projects' MinIO containers are running and may hold port 9000).

## Current state

- Typecheck clean on API, mobile and web; lint 0 errors on all three. API 397 tests pass excluding the two server-dependent multi-tenancy suites; mobile 93 suites / 472 pass; docs checks pass (211 pages, 449 links).
- **Nothing in Phase 5 has been run on a real phone or in a browser** (the attendance tap-and-rollback and the longest amounts in narrow stat tiles especially).
- The API must be restarted and the migration applied (`pnpm prisma migrate deploy`) for the latest changes.
- **Local receipt uploads currently fail** because `societyledger-minio` is stopped.

## Next session starts with

1. Start MinIO (`docker start societyledger-minio`; if port 9000 is taken by another project's container, decide whether to stop that one or move this project's port), retry a donation-pledge receipt upload.
2. If approved, make uploads answer **503 "File storage isn't available right now"** (with one clear log line naming the storage address) instead of a generic 500 — proof, lodgment slip and ticket-attachment uploads.
3. Then a real-phone pass over Phase 5 before the officer beta (M3), then Phase 6 per `context/build-plan.md`.

## Open questions

- Should a member's own "Make a donation" go through the pay-and-verify flow? Today it records the gift as already paid with no money or receipt checked (`POST /members/me/donate`).
- Rebuild every member's ledger with a one-off script (rewrites ledger entries in all associations), or member by member?
- Add a file-handling library so statements can be shared as PDF (needs owner approval)?
- Recorded gaps left on purpose: mobile bulk delete, "start meeting" button, apology reason, "rebuild all ledgers" on mobile.
