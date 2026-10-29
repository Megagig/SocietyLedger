# Memory — Thrift/Ajo add-on: T7 Web and the web review fix pass

Last updated: 2026-10-29

> Replaces the earlier "Billing review fixes / Ajo plan" memory. Billing and mobile work is recorded in `context/progress-tracker.md`. No secrets here.

## What was built

- **T7 Web** (all steps): member/staff split (`MemberSidebar`, `AdminSidebar`, `useAjoNav`, `AjoGate`), staff pages under `apps/web/src/app/dashboard/ajo/**`, member pages under `dashboard/my-thrift/**`, standalone sign-up `signup/thrift`, thrift onboarding wizard `onboarding/thrift` (steps profile/circle/contributors/team/review, CSV upload, resume after skip).
- **Flexible frequency**: DAILY/WEEKLY/MONTHLY/QUARTERLY/ANNUALLY/CUSTOM (`intervalCount`/`intervalUnit`), `ajo-schedule.ts`.
- **Guarantor link (THM6)**: `AjoGuarantorInvite`, public `/api/public/ajo/guarantor/:token`, web page `/guarantor/[token]`.
- **Review fixes (14 issues)**: names-only `/groups/:id/people`, roster `verification`, `pastDue`, paged queue/handovers, receipts, phone confirm, swap/leave on member page, semantic colour tokens (`--c-*` in `globals.css`/`tailwind.config.ts`), docs section `apps/docs/content/docs/ajo-thrift*`.
- **Password re-entry** on payout approve/reverse/case close (`ajo-reauth.ts`).
- **Migrations**: `20261114_platform_settings_nullable_association`, `20261115_ajo_flexible_frequency`, `20261116_ajo_guarantor_links`.
- **Web tests (new)**: `apps/web/jest.config.js`, `test-support/style-mock.js`, `__tests__/ajo/logic.test.ts`, `__tests__/ajo/gate.test.tsx`; `pnpm --filter @societyledger/web test` passes 20 tests.
- `context/progress-tracker.md` has a "Web review fix pass" section.

## Decisions made

- Ajo group is "circle" in web UI; standalone tenant stays "group"; server messages still say "group".
- Standalone thrift uses hidden `ajo-trial` add-on (14-day trial); sign-up gated by platform setting `ajoStandaloneSignup`.
- `RuleError` status limited to 400/402/403/404/409/429/503 (use 409 for used/expired links).
- Money always shown in full (₦10,000.00).
- `Sidebar.tsx` fallback intentionally untouched; HelpLink only on onboarding page until T11.

## Problems solved

- Bash heredoc/`node -e` quoting breaks: use Write/Edit tools.
- Prisma `generate` EPERM while API runs: stop API first.
- Jest in web: no `0n` literals; `style-mock.js` must live outside `__tests__` or Jest treats it as a test.
- `ajo-latefees`/`ajo-payouts` failed once in the full parallel run but pass alone (contention).

## Current state

- Web and API `tsc` clean; Ajo API suites pass (rerun alone for latefees/payouts); web Jest 20/20.
- NOT verified: real-browser walk-through of web screens; migrations on a production copy; full billing/auth/multi-tenancy regression after the fixes.
- `architecture.md` and `ui-registry.md` not yet updated for this pass. Nothing is committed.

## Next session starts with

1. Decide with the user: run the Playwright + Chromium end-to-end walk-through (scratch DB `sl_ajo_test`, API on 4101, web on 3100) or go straight to T8 Mobile.
2. Update `architecture.md` (guarantor link, people endpoint, tokens, paging) and `ui-registry.md` (MemberExtras, colour tokens, GuarantorConsent).
3. T8 Mobile must ask for the password on payout approve/reverse/case close.

## Open questions

- Fix the ai-settings `created_at` bug (offered, not done)?
- Restart steps for the user: stop API, `prisma generate` in `apps/api`, rebuild `packages/shared`, run the Ajo seed and migrations on other databases.
