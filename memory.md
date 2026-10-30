# Memory — Thrift/Ajo add-on: mobile (T8) follow-ups and the transparency work (T13, spec §16)

Last updated: 2026-10-29

> Replaces the earlier "T7 Web and the web review fix pass" memory (that work is recorded in `context/progress-tracker.md`). No secrets here.

## What was built

- **Standalone thrift groups get a trimmed mobile app**, matching the web allow-list: Money tab shows My thrift directly, Manage keeps only Members, Thrift, Settings (`money/index.tsx`, `manage/index.tsx`, `useAjoNav().thriftOnly` and `resolving`).
- **T13 Phase A, Circle board** (rotating pots): `memberVisibility` (`FULL`/`OFF`, text) and `nameDisplay` on rule versions; `ajo-status.ts` (one status set, pure); `ajo-board.service.ts` + `ajo-board.controller.ts` (8 member-safe endpoints under `/api/ajo/groups/:id/board`); web `components/ajo/board/*`; mobile `features/ajo/components/board/*`, a **Circle tab** for a standalone rotating pot, and a "Circle board" button on the circle page for association members. Leak test in `ajo-board.integration.test.ts`.
- **Phase B, collector-thrift cycles**: per-saver amount, withdraw or continue (no answer means withdraw), fee = one of that saver's contributions, savings carried forward. `ajo-cycle.ts` (pure), `ajo-cycle.service.ts`, `ajo-cycle-data.ts`; `AjoMembershipCycle`, `cycleNo` on groups/installments/payouts. Web `CycleCard` + officer "Savings cycle" tab; mobile `CycleCard` + `manage/thrift/[groupId]/cycle.tsx`.
- **Phase C, saver's own view**: `ajo-savings.service.ts`, `ajo-savings-statement.ts`, `ajo-savings.controller.ts` (savings, payments, cash tracker, collector, record, statement PDF/CSV, receipt PDF). Web `components/ajo/savings/SavingsView.tsx`; mobile `features/ajo/components/savings/SavingsView.tsx`.
- **Phase D**: circle statement PDF with verification code (`ajo-circle-statement.ts`, public `GET /api/public/ajo/statement/:code`, web `/verify/circle/[code]`); circle notifications + preferences (`ajo-circle-notices.service.ts`); officer accountability (`ajo-accountability.service.ts`, web tab + mobile screen, CSV); docs page `apps/docs/content/docs/ajo-thrift/what-members-can-see-in-a-circle.mdx` (registered in `scripts/sitemap-data.ts`).
- **Migrations** (all applied to the dev database on 2026-10-29): `20261117_ajo_member_visibility`, `20261118_ajo_collector_cycles`, `20261119_ajo_statement_codes`, `20261120_ajo_circle_notices`.
- **Fixes found by using the app**: rules screens crashed because the API sends `{ versions, acceptance? }` and clients read a bare list (fixed on web and mobile, plus onboarding steps); start-circle refusals now show under their own button with a "Go to Members" path and Start disabled when nobody is approved (`startReadiness.ts`).

## Decisions made

- Spec is `context/thrift-ajo-spec.md` §16 (owner-approved 2026-10-29). Board is rotating-pot only; collector thrift is always private. "Status only" visibility was dropped. A person shows by name only after accepting a rule version with the board on; otherwise "Member n". Officers always see names.
- Mobile placement: standalone rotating pot gets a **Circle tab**; association members open the board from the circle page. Standalone collector thrift has no Community tab.
- Collector thrift: each saver chooses one amount (at least the group's `contributionKobo`, which now means "smallest amount") and keeps it for the whole cycle; a cycle's question opens 3 days before the last due date; no answer = withdraw; next cycle is started by the admin only once the cycle is over and every withdrawing saver is paid.
- Mobile parity rule from the owner: everything on web works on mobile, unless the owner removed it (guarantor consent screen, CSV upload, offline collector work) or it can't be done properly, and then they must be told.
- Money always shown in full (₦10,000.00); PDFs say "NGN" because built-in PDF fonts have no ₦.

## Problems solved

- **Applying a migration to the dev DB**: it has drift, so do not use `migrate deploy`. Run `node node_modules/prisma/build/index.js db execute --file <migration.sql> --schema prisma/schema.prisma`, then `migrate resolve --applied <name>`. Scratch DB `sl_ajo_test` uses `migrate deploy` (run from outside `apps/api`).
- **`prisma generate` EPERM** on the engine file while the user's dev server runs: the types still get written; restart the API after migrating.
- **Full Ajo suite is flaky under load** (Prisma's 5-second transaction limit); a different test fails each run. Run suites with `--runInBand` or `--maxWorkers=2` and the user's dev servers stopped. One real cause was mine: `runAjoDailyJobs(now, { groupIds })` must pass `groupIds` to every step (cycle questions, circle notices); it now does.
- **Bash tool**: big heredocs with apostrophes and backticks inside commands break or get mangled; write files with the Write tool and keep node patch scripts in the scratchpad.
- Tests: pdfkit stores text as hex in TJ arrays (decode in tests); a cash handover's `createdAt` is the database clock (set it in tests); the API's `RuleError` status is limited to 400/402/403/404/409/429/503.
- "Cannot find native module" errors in the mobile dev build mean the installed development build is older than the packages: rebuild the dev client.

## Current state

- API, web and mobile typecheck (mobile shows only its 6 old errors). New database tests pass: board 16, cycles 16, savings 12, statement 8, accountability 6, notifications 10, plus pure tests. Docs `check:frontmatter` and `check:links` pass.
- **Nothing in T8 or T13 has been looked at in a browser or run on a device or emulator**; Maestro flows are written, not run. Check `git status` for what is not yet committed (phases A and B were committed by the user; C, D and the two fixes may not be).
- Not built: bulk CSV "amount" column; carrying arrears across cycles; downloadable statements for past cycles; collector collection days/time window and an office contact (not in the data); a Docs page performed step by step on staging.

## Next session starts with

1. Run `git status`, then walk the real flows on a device and in a browser: a rotating pot (board, statement, notifications) and a collector-thrift group (cycle, savings, cash tracker), as a member, a collector and an officer. Rebuild the mobile dev client first. Fix what the user finds, one issue at a time.
2. Then the remaining Track T plan in `context/build-plan.md`: T9 admin console, T10 reports, T11 docs for collectors and officers, T12 hardening and the pilot.

## Open questions

- Should collector-thrift bulk upload accept an amount column, and should unpaid arrears from a finished cycle carry into the next one?
- Where should a collector's collection days, time window and an office contact be recorded, so the saver's collector card can show them?
- Does the owner want past cycles' statements downloadable, not just the running cycle?
