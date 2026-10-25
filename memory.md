# Memory — Mobile Phase 8: association signup, free trial, blocking, setup wizard

Last updated: 2026-10-25 (session dates in the app's own notes say 2026-11-03)

## What was built

Phase 8 (F8.1 and F8.2) across API, admin console, web and mobile. Per-feature detail is in `context/progress-tracker.md` (F8.1, F8.2), `context/ui-registry.md` (Phase 8 section) and `docs/deployment/PHASE8_SIGNUP_DEPLOY.md`.

- **Shared (`packages/shared/src`):** `association-signup.ts` (association kinds incl. "other", subdomain rules, naming reminder, signup schema, base domain) and `onboarding.ts` (five steps, officer roles, team-invite schema, finance starter templates, brand colour presets). Web, mobile and API all use these.
- **API:** new signup (`associations.controller.ts`): founder name and phone, creates their `Member` (MEM0001), always Enterprise, honours platform switches. `services/subscription-access.service.ts` (access rules, `startTrialIfPending`, cache), gate in `middleware/auth.middleware.ts` (403 `SUBSCRIPTION_INACTIVE`), `subscriptionAccess` on login and `/auth/me`. Approval (`auth.service.ts updateUserApproval`) starts the trial. Onboarding: `onboarding-rules.ts`, `complete-step` with `skipped`, `POST /onboarding/team`. Admin: `POST /admin/users/:id/verify-email` and `resend-verification`; approvals list search, `emailVerified` filter, association kind. Reminders at 3 and 1 day in `jobs/subscription-jobs.ts`. Migration `20261103_add_invite_role_and_onboarding_skips`.
- **Admin console:** Approvals page (verify email, resend code, kind, founder), Settings (blocking switch, trial days 1 to 90).
- **Web:** rewritten `signup/page.tsx`; all `onboarding/*` steps save real data and record skips; `components/subscription/SubscriptionBanners.tsx` (trial banner, blocked screen) wired into `AuthenticatedLayout`; axios and fetch interceptors mark blocked; Settings > Association uses the shared kind list with "other".
- **Mobile:** `(auth)/create-association.tsx`, `(app)/onboarding/*` (overview, profile, team, members, finance, complete), `features/onboarding`, `features/associationSignup`, `features/session/landing.ts` and components (blocked screen, trial banner), guard in `(app)/_layout.tsx`, `stores/session.ts markSubscriptionBlocked`, client interceptor, Settings kind list with "other".
- **Docs:** create-your-association, onboarding-wizard, free-trial, when-a-subscription-ends rewritten; frontmatter and link checks pass.

## Decisions made

- Trial: 14 days of Enterprise, starts on **approval** of the founding admin (not signup); length is the platform setting `defaultTrialDays`. After it ends everyone in the association is blocked until paid. Login, `/auth/me`, subscriptions, support, help and devices stay open. Billing overrides respected. Platform switch `enforceSubscriptionAccess` (default on) turns blocking off. No subscription row at all means allowed. Past-due is allowed during its 3-day grace.
- Mobile never shows prices or a pay button; officers are told to renew on the web (WhatsApp `SupportCard`), members to contact their admin.
- Association kind is the **existing** setting `association.associationType` (+ `customAssociationType`), one shared list; no new DB columns for it.
- Wizard order follows web: Profile, Team, Members, Finance, Complete. Skipped is stored apart from done (`skipped_steps`). Invites carry `role_name`, applied on acceptance.
- Password minimum stays 6 (login, reset and signup already matched).
- Working rule from the owner: list fixes and get approval before changing code for review findings; the owner approved cross-platform bug fixes for this phase.

## Problems solved

- The subscription middleware existed but was never applied, so nothing was ever blocked.
- Platform settings (sign-ups open, email verification, approval, trial days) were saved but ignored by signup.
- Approval email linked to `.com`, now the association's own address on the live domain.
- Wizard sent `annually`; the API accepts `annual`.
- Login 500 after approval was only a missing column: the migration had not been applied to the local DB. Applied with `prisma db execute --file`; verified columns exist. `prisma generate` fails with EPERM while the API runs (engine file locked), but the generated types were already updated.
- Expo typed routes regenerate unreliably on the dev server; new screens are typed once via `SETUP_HREF` in `landing.ts`. Restart Metro to refresh them.
- Tooling gotcha: inline shell/heredoc edits mangle backticks; write files with the Write tool and patch with small node scripts.

## Current state

- Typechecks clean: shared, API, web, mobile. Admin has the 2 old errors (`query-client.tsx`, `session.server.ts`). Tests: API 1151 pass (2 multi-tenancy suites fail to load on an `otplib` ESM error, same without these changes), mobile 1037 pass. Docs checks pass.
- Local database now has the new columns. Nothing committed. Nothing run end to end against real email, Paystack or a device.
- Not done: the idea to show "not yet approved" with the WhatsApp card when someone signs in on the **bare** `localhost:3000` (no association in the address). Cause: with no tenant the API finds no user and returns "Invalid credentials". Proposed fix (API only): on a tenant-less login, look the email up across associations, check the password, and for exactly one match that is pending/unverified/rejected return that specific code, never logging anyone in. The owner has not yet confirmed it.
- `/imprint` and `/review` were not run for Phase 8.

## Next session starts with

1. Ask the owner whether to build the tenant-less login "pending approval" message (above).
2. Test end to end: create an association from the phone, verify email (try the admin console "Mark as verified" and "Resend code"), approve, check trial dates and the approval email link, sign in on `<subdomain>.localhost:3000`, walk the wizard on web and mobile.
3. Test blocking: set a trial end in the past and check the blocked screen on web and mobile, then renew or extend and check access returns.
4. Run `/review` on Phase 8, then Phase 9 (hardening and release) per `context/build-plan.md`, starting with `/architect`.

## Open questions

- Associations that already have an Expired or Cancelled subscription are blocked at once when this ships; decide whether to bypass them first (see the deploy note).
- The mobile blocked screen uses the WhatsApp support card, not a support email.
- `ai-help.service.ts` and `ai-support.service.ts` are still not on credits (from Phase 7); `GET /ai/reminders/suggestions` still spends a credit.
- Apply `20261103_add_invite_role_and_onboarding_skips` wherever else the API runs (staging, production).
