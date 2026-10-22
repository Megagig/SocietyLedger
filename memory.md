# Memory — Mobile Phase 4 complete (Cooperatives & support), ready for Phase 5

Last updated: 2026-10-23

## What was built

Phase 4 (F4.1–F4.6) is built on API, web, mobile and docs, reviewed with `/review`, and every finding fixed except one (see Open questions). Per-feature detail lives in `context/progress-tracker.md` (rows dated 2026-10-21 to 2026-10-23) and `context/ui-registry.md` — not repeated here.

- **F4.1 Savings, F4.2 Loans & apply, F4.3 Guarantor requests, F4.4 Help centre & FAQs** — mobile screens under `apps/mobile/app/(app)/(tabs)/money/*` and `profile/help/*`; web pages under `apps/web/src/app/dashboard/{cooperatives,help}`.
- **F4.5 Support tickets Tier 1** (member ↔ association admins, attachments, notifications) and **F4.6 Tier 2** (association admin ↔ SocietyLedger: platform inbox in the admin console at `apps/admin/src/app/(console)/support`, escalate, "Contact SocietyLedger", mobile staff desk at `manage/support/*`).
- **Review round (2026-10-23):**
  - Notifications now persist a deep-link type: new nullable `Notification.pushType` column (migrations `20261023_add_notification_push_type` and `20261023_backfill_notification_push_type`). `dispatchNotification` writes it; the mobile inbox routes on `notif.pushType ?? pushTypeForKind(type)`; web has `apps/web/src/lib/notification-link.ts` plus "View details →" on the bell dropdown and the Notifications page.
  - `cooperativesService.notifyApprovers` alerts officers (holders of `ledger.create` for savings, `payments.approve` for loans) when a member submits a deposit, repayment or loan application; deposit/repayment decisions go through `dispatchNotification` (`savings.deposit_decision`, `loan.repayment_decision`).
  - Docs: `mobile-app/*` (9 pages) written for real; `support.escalate` added to the permissions reference; release notes updated; three pages that wrongly said notification preferences do nothing were corrected; `.env.example` documents `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`.
- Last regression run: API 208 tests (22 suites, multi-tenancy excluded), mobile 270 (57 suites), API/mobile/web typecheck clean, mobile and touched-web lint clean, docs frontmatter 205/0 failed, links 420/0 broken, docs build passes.

## Decisions made

- Tier 2 tickets are visible only to the admin who opened them; platform staff (`platformRole` SUPER_ADMIN / SUPPORT_AGENT) answer from the admin console; escalation never shares the member's ticket.
- Officer approval screens (savings deposits, loan repayments, loan applications) stay web-only until Phase 5; mobile officer alerts land on the Manage hub.
- OpenRouter model is configurable via `OPENROUTER_MODEL`, defaulting to `openrouter/auto` because `openai/gpt-4-turbo-preview` was retired.
- Notification preferences are applied only to senders that use `dispatchNotification`; quiet hours are stored but not enforced; meeting reminder jobs and tenant announcements bypass preferences.

## Problems solved

- Support routes never installed `attachPermissions()`, so `req.permissions` was undefined and admins saw only their own tickets — fixed in `support.routes.ts` (regression test `support-routes-permissions.test.ts`).
- Web bell dropdown used PATCH for mark-read; the API route is PUT.
- Admin console BFF proxy used `searchParams.set`, collapsing repeated `status` params; now `append`.
- "Suggest a reply": needs `OPENROUTER_API_KEY`; model output isn't always clean JSON, so `parseSuggestionJson` tolerates prose, fences and truncation.
- `prisma generate` EPERM while the dev API runs — stop the API, generate, restart. The user runs the API themselves; free port 4001 with `Get-NetTCPConnection -LocalPort 4001 -State Listen | ForEach-Object { taskkill /PID $_.OwningProcess /T /F }`.
- Heredocs and `node -e` with `$` or nested quotes corrupt files — write scripts to the scratchpad with the Write tool, and preserve CRLF when patching.

## Current state

Everything above works in tests. Not verified on a device or in a browser this round: new officer alerts, notification taps, the new mobile docs pages' accuracy against a real device. The web new-ticket page has never been viewed in a browser. 12 docs screenshots are still `pending` placeholders.

## Next session starts with

Mobile Phase 5 (officer features), starting with `/architect` for the first Phase 5 feature in `context/build-plan.md` (F5.x; officer attendance F5.8 is already planned there). Before that, on every non-local environment: run `prisma migrate deploy`, run the `help-permissions` seed, set `OPENROUTER_API_KEY`, rebuild `packages/shared`, and have users sign in again. Restart Metro with `npx expo start -c`.

## Open questions

- `apps/api/__tests__/multi-tenancy/{isolation,subdomain}.test.ts` can't run: they import the live server and write real associations/users to the configured DB, and `otplib` is ES-module only. They need a dedicated test database — decision pending. My aborted runs left test associations 16 and 19 and users `admin1@test.com` / `admin2@test.com` in the dev DB (audit-log rows reference them, so they were not deleted).
- Whether to hide "Suggest a reply" when the AI key is missing, or reword its message.
- Whether to make meeting reminders and tenant announcements respect notification preferences, and enforce quiet hours.
- Store links for the "Getting the app" docs page are unknown (beta is invitation-only).
