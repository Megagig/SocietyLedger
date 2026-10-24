# Memory — Mobile Phase 6 (Officer advanced): F6.3, F6.6, F6.7, F6.8 built

Last updated: 2026-10-29

## What was built

Phase 6 is built on API, mobile, web and docs, apart from the points under Open questions. Per-feature detail (bugs fixed, files, tests, deploy notes) is in `context/progress-tracker.md` (rows F6.3, F6.6, F6.7, F6.8) and `context/ui-registry.md`, so it is not repeated here. F6.1 to F6.5 were done before this session; F6.1 to F6.4 are committed.

Work of this session, in order:
- **F6.3 elections and polls admin:** an Election Committee role and its screens; live voting turnout for all members (turnout only, never who is ahead); optional configurable voting and candidacy eligibility rules (per election plus an association template; default behaviour unchanged).
- **F6.6 announcements and SMS:** one announcement with an audience and ticked channels, kept as a record; SMS credits reserved before sending, failed texts refunded once, background sends with progress; a "Don't send me text messages" opt-out; mobile CM1–CM6 and a rebuilt web announcements page. The SMS webhook now follows Termii's real format: `POST /webhooks/termii`, signed in `X-Termii-Signature` (HMAC-SHA512 of the raw body, key `TERMII_WEBHOOK_SECRET` or else `TERMII_API_KEY`).
- **F6.7 reports and exports:** mobile RP1–RP7, plus the rule that every figure is drillable to the last record (`GET /reports/charges` and `/reports/payments`, web `/dashboard/reports/charges` and `/payments`). Reports are live and never cached. Home, Finance overview and member Home tiles were wired to open their records. Added `expo-file-system` and `expo-sharing`; `expo-print` was deliberately not added. A shared period dropdown and an `OptionDropdown` replaced sideways chip rows on report screens.
- **F6.8 reconciliation (PY8):** server-side statement parsing (CSV and Excel, any bank layout, preview and column mapping remembered per account), line fingerprints so nothing imports twice, ranked suggestions, one-to-one matches that use the bank line's own amount, and a second officer confirms. Mobile Manage → Payments → Reconciliation; the four web pages were rebuilt; direct web sidebar links were added at the very end.

## Decisions made

- **Money is always shown in full** (₦10,000.00, never 10k), including chart axes. Web report pages and the dashboard formatter now show two decimals.
- **Counted money rules shared everywhere** (`reports/report-rules.ts`): a charge counts as owed only if it is not voided, not waived, and the member is not disabled. Periods and months are cut in Lagos time (UTC+1). Overdue means the due date has passed on an open charge. Money received means every payment dated in the period.
- **Nothing is recorded until a second officer confirms** (matches, cash, welfare): whoever proposes cannot confirm. A bank line pays one charge only; confirmed matches are not reversible (void the payment instead).
- **Drill-down is a standing rule:** a figure and the list behind it are worked out by the same filters, and the list's total equals the figure.
- **PDF and old .xls statements are refused**; the file type is judged by contents and name.
- **Library rule:** ask before adding a library, then record it in `context/library-docs.md`. `expo-sharing` is a native module: it is imported lazily inside `share.ts`, so an older development build still opens and only Share asks for the new build.

## Problems solved

- **Metro "Unable to resolve expo-sharing":** a stale Metro file map, not a missing package. The fix is to stop Metro and run `npx expo start -c`.
- **Home Association overview went blank:** a charge filter slipped into the member count in `dashboard.service.ts`, so `/dashboard/overview` failed with a database error. A regression test now guards it.
- **Heredocs and regexes in the Bash tool collapse backslashes and backticks:** use the Write tool for scripts, or the Edit tool for patches. Never run `prisma format`.
- **Web reconciliation and statement pages read response shapes the API never returned**, and the statement import never worked. They were rebuilt on a corrected `nigerian-payments.ts` client.

## Current state

- **Verified:** API 817 tests pass (excluding the two server-dependent multi-tenancy suites). Mobile 129 suites and 749 tests pass. API, mobile and web typecheck clean, lint 0 errors. Docs checks: 214 pages and 478 links, 0 failures.
- **Migrations applied locally** (`20261101` and `20261102`); both run on API start in deployment.
- **Nothing from F6.3 onward is committed.**
- **Not device or browser tested:** the share sheet and file download, the phone's file picker and statement upload, and the new web reconciliation pages.
- **Last fix:** the web sidebar's direct Reconciliation link (both sidebar files, permission `payments.approve`) was typechecked but not yet seen in a browser. The mobile Manage-hub reconciliation row was NOT applied (the Payments hub row exists).

## Next session starts with

1. Ask whether the web Reconciliation sidebar link now shows (needs an API restart and a hard refresh). If not, find out the signed-in role and whether the page errors.
2. Offer to commit the Phase 6 work (F6.3, F6.6, F6.7, F6.8) in sensible commits.
3. Check what remains in Phase 6 in `context/progress-tracker.md`, then run `/architect` for the next feature.

## Open questions

- Is `TERMII_API_KEY` really the key Termii signs delivery reports with? Check after the first real send that a text moves from Sent to Delivered. If the webhook returns 401, the signing key is wrong.
- The development build must be rebuilt for `expo-sharing` before Share works on a phone.
- The remaining web chip rows (by-category type, SMS history status, export member filter) are still sideways chips; the owner was offered dropdowns and has not answered.
- Whether to add a bank-line split (one transfer paying two charges) and reversal of confirmed matches later.
