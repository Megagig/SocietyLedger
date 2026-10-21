# Memory — Mobile Phase 3 follow-ups, billing/permission fixes, tab fix

Last updated: 2026-10-21

## What was built

**Mobile (apps/mobile)**
- Community tab rebuilt to web parity: `community/_layout.tsx` (Stack — its absence made every sub-screen bounce to Home), Meetings (`meetings/index`, new `meetings/attendance.tsx` = C4 My Attendance with `ProgressRing`), Voting (`elections/index` = "My Voting"), Polls (search + `FilterDropdown` status/type), Welfare hub + new `welfare/contributions`, `welfare/requests`, Announcements (paginated, expandable).
- New shared UI: `FilterChip`, `StatTile`, `IconCircle`, `ProgressRing`, `SectionCard`, `InlineEmpty`, `forms/FilterDropdown`, `feedback/ModuleLockedScreen`, `feedback/NoMemberProfile`, `ErrorState` (takes `error`, says "Can't reach the server" for network errors). Notifications inbox got filters/search/bulk select/pagination.
- Hooks: `useModuleAccess` / `useModuleDisabled` (permission AND module entitlement), `useMemberId`. Queries stop firing for disabled modules or member-less accounts; screens show `ModuleLocked` / `NoMemberProfile` instead of generic errors.
- `TabBar` now emits `tabPress` (tap active tab → nested stack pops to top); Community has `popToTopOnBlur`. `ScreenHeader` lost its duplicate `px-4`.
- `expo-notifications` only loaded after `requireOptionalNativeModule('ExpoPushTokenManager')` probe (lazy `loadNotifications()` in `lib/push.ts`) — dev build without it no longer crashes/logs errors.
- Jest: `sonner-native` stub via moduleNameMapper; push/storage mocks in session + layout tests. 40 suites / 196 tests pass; tsc + eslint clean.

**API (apps/api)**
- `services/subscription-plan.service.ts` (`resolvePaidPlan`, `setTenantPlan`, `tierForPlanCode`) — verify (Paystack/Nomba) + Paystack webhook now apply the plan actually paid for (checkout metadata `planId`+`subscriptionId`) and sync `association.tier`.
- Admin endpoints `GET /admin/plans`, `POST /admin/tenants/:id/plan`; meetings: `GET /meetings/my-attendance`; attendance data scoped to own rows unless `meetings.manage_attendance` or `members.view_all`.
- Welfare: new own-scoped permissions `welfare.view_own` / `welfare.request_own` (routes accept officer OR own; list endpoints server-scoped to the member). Registered in `rbac-seed.ts`, `PERMISSIONS`, default `member` role mapping.
- Tests: `__tests__/payments/subscription-plan.service.test.ts`, `__tests__/meetings/attendance-scoping.test.ts`, `__tests__/welfare/welfare-scoping.test.ts`.

**Admin (apps/admin)**
- `ChangePlanCard` (Subscription tab), `TenantModulesManager` (Modules tab: every module, source plan/default/override, toggle with reason, "Reset to plan"), `lib/tenant-url.ts` + `NEXT_PUBLIC_TENANT_URL_TEMPLATE` for tenant links and impersonation hand-off.

## Decisions made

- **Officer attendance marking (GV3/GV4/GV6) deliberately stays in Phase 5 (F5.8)** — user asked to keep phases in order. Do not build early.
- Welfare for members uses dedicated `_own` permissions, never `ledger.*` (officer keys). Officer "see all" = `members.view_all` (+ `payments.approve` for payouts).
- "Module disabled" answers are session-only in `stores/modules`; reset on app foreground and via "Check again".
- `bg-primarySoft`-style camelCase classes and `h-px`/`gap-1.5`/plain `rounded` don't exist in this Tailwind config — use kebab tokens (`bg-primary-soft`), arbitrary px values, `Divider`.
- Don't run `prettier --write` (no config; it rewrote files to double quotes).

## Problems solved

- "We couldn't load this" on Community screens = API `403 MODULE_DISABLED` (tenant plan lacked meetings/voting/welfare), not a bug. Plan upgrade "didn't apply" because verify/webhook ignored plain-checkout `planId` metadata.
- Admin account has no member record → `/welfare/my-profile` 400 and attendance never loads; use a member account for member screens.
- Members saw no welfare: member role lacks `ledger.view` → fixed via own-scoped permissions.
- Tenant link pointed at production domain; fixed via template env (dev: `http://{subdomain}.localhost:3000`).
- Shell quoting repeatedly corrupted template literals/CRLF edits — use Edit/Write tools or script files, not `node -e` with backticks.

## Current state

All of the above works and is tested at unit level; **nothing verified on a physical device this session**. Dev DB: tenant 15 (Oko Youth Forum) upgraded to Enterprise; member permissions backfilled via `scripts/grant-member-welfare-permissions.ts` (5 member roles). Tenant 15 has **zero meetings**, so attendance screens show empty states until a meeting is created on the web. Known pre-existing lint warnings remain in a few untouched files. Admin app has no ESLint config; admin `tsc` has 2 pre-existing type errors in untouched files.

## Next session starts with

1. Restart API (permission cache is 5 min), admin dev server (new env var), and Metro; sign out/in on phone, then smoke-test: Community → each screen → tap Community tab returns to hub; Welfare as a member; module toggles in admin.
2. Create a meeting + attendance on the web for tenant 15 and confirm mobile Meetings tiles / My Attendance populate.
3. Then Phase 4 per `context/build-plan.md` (officer work incl. F5.8 attendance only when its phase arrives).

## Open questions

- Run `scripts/grant-member-welfare-permissions.ts` on every non-dev environment before release (production not yet done).
- Poll detail still lacks per-option results (not built).
- Whether to also give Money/Profile `popToTopOnBlur` (only Community has it).
