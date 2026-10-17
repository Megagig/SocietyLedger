# Memory — SocietyLedger: Track R (Gap Remediation) R0–R4 complete, R4 reviewed and fixed, none committed yet

Last updated: 2026-10-17

## What was built

**Track R0–R3**: see prior sessions — all committed (`411ca32` R0+R1, `8e52a07` R2, `970bbd1` R3). Not repeated here; read git log / prior gap rows in `progress-tracker.md` if needed.

**Track R4 — Settings & billing correctness.** Not yet committed.
- **G54 (plan downgrade not deferred)**: added `pendingPlanId`/`pendingBillingCycle` to `Subscription` (schema pushed). `subscription.controller.ts`'s `changePlan` downgrade branch sets these instead of applying immediately. New cron `applyPendingPlanChanges` (`subscription-jobs.ts`, daily 1:45 AM) applies them once `currentPeriodEnd` passes. Requesting the current plan again while a downgrade is pending now cancels it. `getCurrentSubscription` surfaces `pendingPlan`; `/dashboard/subscription` shows a banner.
- **G55 (PAST_DUE dead code)**: `checkSubscriptionRenewal` now sets `PAST_DUE` (new `subscription-past-due` email) instead of jumping straight to `EXPIRED`; `checkPastDueSubscriptions`'s existing 3-day-grace logic now actually fires, and now also sends the `subscription-expired` email it never sent before.
- **G56 (trial claim false)**: new `POST /subscriptions/start-trial` creates a `TRIALING` subscription with zero gateway redirect (reuses `initializePayment`'s trial-creation logic, minus the Paystack/Nomba step). Plans page has a real "Start 14-day free trial" CTA per plan, hidden once a subscription already exists.
- **G51 (audit log 403 for every tenant admin)**: new `GET /settings/audit-logs` (`settings.controller.ts`/`settings.routes.ts`), tenant-scoped, gated by `audit.view`. Frontend `audit-logs/page.tsx` repointed from the platform-only `/admin/audit-logs`.
- **G20 (member ID format)**: `demo-association.seed.ts` changed from `MEM-0001` to `MEM0001` to match the 4 real generation call sites (`members.controller.ts` ×2, `member-invites.service.ts`, `member-finance.controller.ts`); 2 docs examples fixed too.
- **R4.6/G53 (6 settings categories)** — scope decided as "wire existing code paths only," not new background jobs:
  - Financial: `enableLateFees`/`lateFeeType`/`lateFeeAmount`/`defaultGracePeriodDays` now drive a real fallback `PenaltyRule` in `penalties.service.ts`'s `applyLateFees` when no officer-defined rule exists (also fixed `late-fees.cron.ts`'s pre-filter, which only ever looked at existing rules); `enablePartialPayments` rejected for real in `finance.controller.ts`'s `recordPayment`.
  - Payments: `enabledChannels` rejects a disallowed method in `recordPayment`; `receiptAutoGenerate` gates a previously-orphaned `payment-receipt` email template (nothing had ever called it) via `dispatchNotification`.
  - Notifications: `paymentReminderDays`/`overdueReminderFrequency`/`emailEnabled`/`senderName` now drive `payment-reminder-jobs.ts` per-association (was one hardcoded global schedule); `senderName` wired into `sendEmail()`'s new `fromName` option (swaps the display name, keeps the one verified address).
  - Members & Access: `defaultRole` (self-signup in `auth.controller.ts`), `allowMultipleRoles` (role assignment in `rbac.controller.ts`'s `assignRole` retires other active roles when off), `inviteExpiryHours` (replaces the hardcoded `INVITE_TOKEN_EXPIRY_HOURS` constant in `member-invites.service.ts`), `memberIdPrefix` (all 4 generation sites) all wired.
  - Integrations: `paystackEnabled`/`nombaEnabled` gate the member-facing dues-payment initialize endpoints only (`paystack.controller.ts`/`nomba.controller.ts`), deliberately NOT subscription billing (separate relationship, must stay always-available); `smsProvider: 'none'` blocks SMS sending for real (checked in both `sms.controller.ts`'s HTTP methods for a clean 400, and in `sms.service.ts` as a backstop for the notification-dispatch SMS channel).
  - Data & Privacy (`dataRetentionMonths`, `anonymizeInactiveMembers`) deliberately deferred — new background jobs, not a wiring fix.

**`/review` ran against R4, found 3 issues, all resolved same session:**
- **G86**: found a pre-existing, unrelated bug while building G54 — `verifyPaystackPayment`/`verifyNombaPayment` never read back the `plan_change` Paystack metadata, so a plan "upgrade" never actually changed `planId` at all. This was entangled with a real gap in my own new code: the new `pendingPlanId` fields were never cleared on a completed plan change either. Fixed both together: both verify handlers now read the echoed-back metadata, apply the real plan/cycle on an actual plan-change confirmation, and clear the pending fields — but only then, not on a plain renewal (which must leave a pending downgrade untouched). Live-verified both branches directly against the DB.
- **G87**: logged, not fixed — `payments.enablePartialPayments` is a duplicate of the Financial one that got wired; G53's own text never mentioned it under Payment Settings, so it's an original-gap omission, not a missed instruction.
- **G88**: the two new SMS settings-gate rejections returned 500 (inherited the pre-existing generic catch-all `sms.controller.ts` already used for "insufficient credits"). Fixed by moving the `smsProvider` check into the two HTTP controller methods directly (same pattern as the Paystack/Nomba checks), returning 400 before ever calling the service.

## Decisions made

- **R4.1 (G54)**: build real deferral, not just honest messaging — the schema change is small and the cron pattern already exists elsewhere.
- **R4.2 (G55)**: make `PAST_DUE` real, don't remove it — `checkPastDueSubscriptions` was already fully built for exactly this, it just had nothing to find.
- **R4.3 (G56)**: build a real no-card trial path — `initializePayment` already created the `TRIALING` row before the gateway redirect; the fix was separating that from the unnecessary forced redirect.
- **R4.6 (G53) scope**: wire existing code paths only. `dataRetentionMonths`/`anonymizeInactiveMembers` (new purge/anonymization jobs), `memberIdAutoGenerate` (no manual-entry UI exists to fall back to — G80), and `apiAccessEnabled` (no API-key mechanism exists anywhere in the codebase to gate — G81) were all left unenforced and logged as new gaps rather than silently built or silently skipped.
- **R4.6.6**: `integrations.paystackEnabled`/`nombaEnabled` scoped to member-facing dues payments only, never subscription billing — billing is the association paying the platform, a separate relationship that must stay available regardless of this tenant toggle.
- **`ui-registry.md` does not apply to this track's work** — re-read its own scope line: it explicitly covers mobile/docs/admin plus a narrow web exception (docs-links/impersonation only), not `apps/web`'s general dashboard. The standing "process gap" flagged in the previous session's memory was a misreading — there's nothing to update there for R1–R4's dashboard work. Same finding for `code-standards.md`/`ui-rules.md`/`ui-tokens.md` — all three are scoped to mobile/docs/admin only; `apps/api` and `apps/web`'s dashboard aren't governed by them, so the actual Layer-2 check for Track R work is "does it match the surrounding file's own established convention," not these three docs.

## Problems solved

- Found and fixed (G86, see above) a pre-existing dead-upgrade-path bug entangled with a real gap in this session's own new code — caught by running `/review` before committing, not before.
- `member-finance.controller.ts`'s `processPayment` couldn't get the same `enabledChannels` treatment as `finance.controller.ts`'s `recordPayment` — G58's pre-existing uppercase/wrong-value-set validator bug (still open) blocks it. Logged as G85 rather than silently skipped or silently fixed (G58 itself is out of R4's scope).
- Resend's `from` header can carry a custom display name per send (`fromName` option added to `sendEmail()`) without needing a second verified domain — only the address portion needs verification, the display name is free-form. Useful pattern for any future per-tenant branding need.

## Current state

- **Branch `gap-remediation`, still only 3 commits ahead of `develop`** (`411ca32`, `8e52a07`, `970bbd1` — R0–R3). **R4's work (code + `progress-tracker.md` updates) is uncommitted in the working tree** — the user has not yet said "commit."
- Both `apps/api` and `apps/web` type-check clean as of the last check this session.
- One new Prisma field pair pushed to the local dev DB this session: `Subscription.pendingPlanId`/`pendingBillingCycle`. Schema in sync, no outstanding migration debt.
- All R4 work is live-verified against the local dev stack (API on port 4001, Postgres via Docker) — not just type-checked, including the post-review fixes (G86/G88). The demo association's subscription row was used as a test fixture multiple times and is confirmed restored to its exact original state (`planId: 1, status: TRIALING, pendingPlanId: null`, matching before any testing began).
- `progress-tracker.md` is fully up to date: R4's checklist (R4.1–R4.6, with the R4.6 sub-items) all ticked, every gap row (G20, G51, G53, G54, G55, G56) has a dated resolution note, new gaps G79–G88 logged (G86 and G88 already resolved inline in their own rows; G79–G85, G87 left open).
- `demo-association.seed.ts`'s format change (G20) only affects *future* seed runs — the already-seeded demo DB still shows `MEM-0001` for existing members (e.g. the admin's own member record); not a bug, just unreseeded legacy data.

## Next session starts with

**Decide whether to commit R4 now**, then continue to **R5 — Accounting completeness** (G46 re-verification — likely stale, re-verify live rather than trust its "no sync exists" text, same pattern as G45 turned out to be — G47 periods, G48 double-posting, G49 dead code, G50 unmapped categories). Run `/architect` for "Remediation Phase R5" first, same workflow as R0–R4: read the gap rows + the actual current code before proposing anything.

If committing R4: this phase touched 28 files across `apps/api`, `apps/web`, `apps/docs`, plus `progress-tracker.md` — exclude the usual pre-existing noise (`apps/web/tsconfig.json`, both `tsconfig.tsbuildinfo` files). Remember the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` line on the **first** attempt this time.

## Open questions

- **G58 (member self-service payment method casing) is still open and now explicitly blocking G85** (extending `enabledChannels` enforcement to member-initiated payments) — worth considering prioritizing ahead of strict R5 order, same way G77's attendance IDOR was flagged as higher-priority than its phase number implied.
- **G77's attendance half (markAttendance/bulkMarkAttendance/getAttendanceStats/getMeetingAttendance) is still a live cross-tenant IDOR**, same severity as G25/G26 — flagged in prior sessions, still not picked up. Same standing recommendation: consider prioritizing before R5, not leaving it to whichever phase happens to touch meetings next.
- **G86's root cause (upgrade metadata never read) was fixed, but the upgrade proration math itself (`changePlan`'s `proratedAmount`/`remainingCredit` calculation) was not independently audited this session** — it was out of scope for the review that found the metadata-reading bug. Worth a closer look if R5/R6 ever touches billing again.
- **R0.3 (member payment proof-upload model) and R0.6 (tenant self-registration approval screen) are still decided but not implemented** — no phase through R4 has touched either. Likely R6 or a dedicated pass.
- Whether to open a PR for `gap-remediation` → `develop` at all, or keep accumulating through the rest of Track R first — still not discussed.
