# Memory — Mobile Phase 7 (Admin & intelligence): F7.5 AI assistant, Phase 7 review and fixes

Last updated: 2026-10-26

## What was built

Phase 7 is complete and reviewed (F7.1 accounting, F7.2 settings, F7.3 users/roles/audit, F7.4 support tickets built earlier under F4.5/F4.6 and ticked this session, F7.5 AI). Per-feature detail is in `context/progress-tracker.md` and `context/ui-registry.md`.

F7.5 this session:
- **API** (`apps/api/src/modules/ai/*`): `ai-credits-rules` (pure rules, settings schema, defaults), `ai-settings.service` (`platform.ai` JSON in `settings`), `ai-credits.service` (DB-locked daily allowance + bought credits, hold/settle/release, Paystack purchase, idempotent credit, verify), `ai-privacy` (members shown to the model as "Member N"), `ai-context` (figures from the same reports/accounting calculations), `ai-assistant.service` (ask / reminders / report), `ai-report-format`, `ai-admin.service` (cost vs credits sold). Migration `20261026_add_ai_credits`. Paystack webhook credits `AIC-` and `SMS-` references. `lib/tenant-url.ts` builds the association's own address for payment returns (AI and SMS).
- **Admin console:** Settings → AI section (`apps/admin/src/app/(console)/settings/ai-section.tsx`); routes `GET/PATCH /admin/settings/ai`, `GET /admin/ai/usage` in `admin.routes.ts`.
- **Mobile:** `manage/ai/` (index chat, reminders, report, credits), `src/features/ai/*`, hub entry on Manage, docs keys AI1–AI4.
- **Web:** `dashboard/ai/credits` page, "Buy AI Credits" in both sidebars, usage page shows free requests and credits separately.
- **Docs:** new `ai/buying-ai-credits`, other AI pages updated; deploy steps in `docs/deployment/AI_CREDITS_DEPLOY.md`.

## Decisions made

- Free requests per day (reset at midnight Lagos): Starter 10, Pro 30, Enterprise 100. Question 1, reminders 1, report 5. ₦20 per credit, ₦3,000 minimum. All editable in the admin console, no code change. Bought credits never expire; free requests are spent first. A failed request costs nothing.
- Model default `deepseek/deepseek-chat`, changeable in the admin console. Model never sees names, phones or emails; real names are restored in the answer.
- Chat history is in memory only on the phone (never in unencrypted storage). Reports are not saved; shared as text.
- The owner's deliberate additions to the plan (expenses, drill-down, periods screen, AI4 buy credits, SMS webhook crediting) must not be touched or removed.
- Working rule from the owner: when fixing review findings, list what will be fixed and get approval before writing code; fix only what could harm the project.

## Problems solved

- Paystack returned buyers to `FRONTEND_URL` (bare domain), where they were signed out, so purchases stayed "Waiting". Fixed by returning to the association's own address; the AI credits page also re-checks waiting purchases when opened.
- Usage page mixed free requests and credits into one count; now shown separately.
- "Buy AI Credits" page had no navigation entry; added to both sidebars (needs `ledger.view`).
- Mobile AI report icon/screen now need `reports.generate` (matches the API).
- Closing Paystack without paying no longer leaves a "Waiting" notice.
- Tests: RNTL 14 `render`/`fireEvent`/`act` are async (await them); mock `@/lib/storage` when a screen pulls in MMKV.

## Current state

All green: API 1105+ tests, mobile 989 tests, mobile/web/API/shared typechecks clean, docs checks pass. Admin typecheck has 2 old errors (`query-client.tsx`, `session.server.ts`) not from this work. Nothing committed. Nothing tried on a device or against live Paystack/OpenRouter.

## Next session starts with

1. Stop the API, run `npx prisma generate`, restart it (new tables already applied locally); restart the admin dev server.
2. Test a real purchase end to end (web and mobile) and one AI question, reminder and report.
3. Then Phase 8 (F8.1 create association, F8.2 onboarding wizard) per `context/build-plan.md`; run `/architect` first.

## Open questions

- Still not on credits: `ai-help.service.ts` and `ai-support.service.ts` (own limiter / direct provider calls).
- `GET /ai/reminders/suggestions` spends a credit (a GET with a cost); could become a POST.
- Admin cost view takes the naira-per-dollar rate typed by hand.
- Dev/preview builds use different app schemes, so Paystack's browser must be closed by hand there.
- Phase 6 (F6.3, F6.6, F6.7, F6.8) notes were replaced by this file; their detail lives in `context/progress-tracker.md`.
