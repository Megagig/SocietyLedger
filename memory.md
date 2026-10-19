# Memory — Production deploy debugging + post-launch admin/impersonation remediation

Last updated: 2026-10-19

## What was built

**Infrastructure root-cause fix** (`docker-compose.dokploy.yml`): hand-written Traefik Docker labels for `admin`/`docs`/`web` were a second, parallel routing config fighting Dokploy's own native per-app **Domains tab** (the mechanism that made `api` reliable the whole time — it only ever had `dokploy.domain`/`dokploy.port` labels). This was the root cause of a multi-hour "multiple Services" / 502 / no-cert saga. Fixed: `admin`/`docs` now use the same `dokploy.domain`/`dokploy.port` pattern as `api`; `web`'s router (renamed `sl-tenant`) now matches **only** tenant subdomains via `HostRegexp`, never the apex domain, so it can never overlap with Dokploy's native "web" domain entry.

**Two Prisma migration-drift gaps** found and fixed (fields existed in `schema.prisma`, added via `db push` in dev, never had a migration file, so `prisma migrate deploy` never created them in production — P2022 on every request touching them):
- `transactions.last_reminder_sent_at` — migration `20261019_add_transaction_last_reminder_sent_at`
- `payment_proofs.transaction_ids`/`declaration_note`/`payment_method` + nullable file fields — migration `20261019_add_payment_proof_multi_transaction_declare`

**Env var wiring gaps** (set in Dokploy's project-level Environment tab, but never referenced in the relevant service's `environment:` block in `docker-compose.dokploy.yml` — Dokploy only injects what a service explicitly asks for via `${VAR}`): `EMAIL_FROM`/`EMAIL_REPLY_TO` (api service) — fixed in compose. `ADMIN_URL` — was never set at all in Dokploy; user added it directly.

**Admin bug fixes** (all were "built but never wired" or field-name-mismatch bugs, not logic bugs):
- Analytics page crash: `ModuleAdoption` interface used `moduleId`/`moduleName`/`activeCount`/`totalEnabled`, API actually returns `code`/`name`/`enabledCount` + top-level `totalAssociations`
- Action log stats crash: backend never computed `actionsToday`/`uniqueAdmins`/`mostCommonAction` — now computed in `platform-action-log.service.ts`
- Action logs list "Invalid Date": backend returned raw `platform_action_logs` rows (`createdAt`, bare `actorId`/`associationId` ints, `pagination.total` nested, no `description`) while UI expected `performedAt`/`admin`/`association` objects/top-level totals — `getActionLogs` in `platform-admin.controller.ts` now batch-fetches and maps correctly
- `/blog/new`, `/blog/[id]/edit`, `/help/new`, `/help/[id]/edit` all 404'd — never built despite being marked done. Built `BlogPostForm`/`DocPageForm` (`apps/admin/src/components/forms/`), registered in `ui-registry.md`
- Blog's "New category" / Help's "New section" modals had been silently broken since they shipped (sent `{ name }` only; `slug` is a required unique column with no default) — now slugify client-side
- `BlogCategory.postCount`/`DocSection.pageCount` → actually `_count.posts`/`_count.pages`

**Full security event audit log built from scratch** — the Audit Log page was designed against a security-event concept (severity, actor type, IP/user-agent) that never existed server-side; only a generic record-change table did. Added `SecurityEventLog` model + migration (`20261019_add_security_event_log`), `apps/api/src/lib/security-audit-log.ts` (`logSecurityEvent()`, fire-and-forget, never throws), rewired `GET /admin/audit-logs`. Instrumented: login success/failure/suspended-denied, impersonation start/end, association suspend/reactivate, user approve/reject.

**Admin logout button** — `DELETE /bff/session` already existed and worked; just had no UI. Added to `AppShell.tsx` sidebar.

**Platform admin invite flow built from scratch** (owner chose email-link invite, not direct creation w/ temp password): `PlatformAdminInvite` model + migration (`20261019_add_platform_admin_invites`), `POST /api/admin/platform-admins/invite` (+ list/revoke), public `GET/POST /api/admin/auth/invite/:token`/`/accept` (no session — invitee doesn't have one), new admin `/admins` page, public `/invite/[token]` accept page with its own `/bff/invite/*` proxy routes (added `/invite` to `middleware.ts`'s `PUBLIC_PATHS`), new `platform-admin-invite` email template.

**Impersonation — four separate root causes found and fixed, in sequence** (each was real; fixing one revealed the next):
1. `startImpersonation()` (`apps/web/src/store/authStore.ts`) never set `isAuthenticated: true`
2. `router.replace('/dashboard')` could serve a stale Next.js App Router response cached before the cookie existed → switched to `window.location.href` hard navigation in `apps/web/src/app/auth/impersonate/page.tsx`
3. The hard navigation then exposed a **hydration race**: `AuthenticatedLayout`/`ProtectedRoute` called `checkAuth()`/redirected before Zustand's `persist` middleware finished rehydrating `auth-storage` from localStorage (the store already had an unused `_hasHydrated` flag) — both now wait for it
4. **The actual final root cause**: `GET /api/auth/me` queried `prisma.user.findFirst({ where: { id: userId, associationId: tenantId } })` — during impersonation `userId` is the super admin's own id, `tenantId` is the impersonated association's id (resolved from subdomain), which never matches the admin's real `associationId` column by design. Query returned null → 404 → `checkAuth()`'s catch block wiped the session. Fixed: query by `id` alone (`authMiddleware` already enforces real tenant isolation with its own correct `SUPER_ADMIN` bypass). Also fixed in the same function: the response always showed the fake "SocietyLedger Platform" association for any `SUPER_ADMIN`, even while impersonating — now gated on `!isImpersonating`.

**Tooling fix**: found that local `npx tsc --noEmit -p tsconfig.json` checks had been giving false "clean" results all session due to a stale incremental `.tsbuildinfo` cache — a `new Map(arr.map(a => [a.id, a]))` tuple-inference error (missing `as const`) only surfaced in the actual `tsconfig.prod.json` build. Fixed the error, added `*.tsbuildinfo` to `.gitignore`, untracked the 3 previously-committed ones.

## Decisions made

- **Traefik/Dokploy routing**: never hand-write Docker labels for a domain Dokploy's native per-app Domains tab already manages (apex/admin/docs domains) — only hand-write for what that simple UI can't do (wildcard tenant subdomains), and scope that router so it can never overlap with a native entry.
- **Audit Log**: build the real security event model properly rather than adapting the UI down to the existing generic table — owner's explicit choice when asked.
- **Admin invite**: email-link flow, not direct account creation with a temp password — owner's explicit choice when asked.
- **Prisma JSON fields in TS**: cast with `Prisma.InputJsonValue`, not `any`, when a loosely-typed `Record<string, unknown>` won't satisfy the generated input type.

## Problems solved

- Pattern seen repeatedly across admin pages (analytics, action logs, blog, help): frontend TS interfaces were built against an assumed/planned API response shape that drifted from what the backend actually returns. Always verify the real controller response shape, don't trust the frontend interface.
- Env vars set in Dokploy's Environment tab do **not** automatically reach a service's container — `docker-compose.dokploy.yml` must explicitly list `VAR: ${VAR}` in that specific service's `environment:` block.
- Prisma schema/migration drift: a field added to `schema.prisma` via `db push` in dev (or by hand) with no matching migration file silently never reaches production, since `prisma migrate deploy` (run automatically in `apps/api/docker-entrypoint.sh`) only applies tracked migrations.
- Local `tsc --noEmit -p tsconfig.json` can give false "clean" results from a stale incremental `.tsbuildinfo` cache. For a trustworthy check, either delete `tsconfig.tsbuildinfo` first or check against `tsconfig.prod.json` (what the actual Docker build runs) — note `tsconfig.prod.json` has `strict: false`/`noEmitOnError: false`/wrapped in `|| true` in the Dockerfile, so most type errors there are cosmetic and non-blocking; only a hard Docker-level failure actually stops the build.

## Current state

- **Infra/routing**: confirmed working — subdomains load with valid HTTPS, wildcard cert via Cloudflare DNS-01 issued successfully.
- **Email sending**: confirmed working (EMAIL_FROM wired correctly, invite emails arrived).
- **Dashboard/finance-summary/payment-proofs 500s**: fixed, not yet re-confirmed by user after the latest deploy.
- **Blog/Help CMS create/edit, Audit Log page, admin logout, admin invite**: all built and pushed, **not yet confirmed working** by the user — the deploy that should carry them (and the 4th impersonation fix) **failed**.
- **Impersonation**: all 4 fixes pushed (latest: commit `3496091`), **not yet confirmed working** — same failed deploy.
- **Latest commit pushed**: `64915d2` (Map tuple `as const` fix, found while investigating the failed deploy).
- **BLOCKING**: the Dokploy deployment that should include all of the above **failed**. The user pasted a 50,000-character build log that got truncated mid-way through a long list of **pre-existing, non-fatal** TS warnings (tolerated by `|| true` + `noEmitOnError: false` in the API's `build:prod` step) — confirmed these aren't the real cause. The actual fatal error is further down in the log, past the truncation point. **Was waiting on the user to paste the tail of the log (last 30-50 lines) when the session ended.**

## Next session starts with

**Get the tail of the failed deployment log** (ask the user to scroll to the bottom in Dokploy, or use "Download logs") to find the actual fatal error — it's not the API's TS warnings (those are tolerated). Likely candidates: a `pnpm build` failure in `web`/`admin`/`docs` (those are NOT wrapped in `|| true`, unlike the API), or a container failing to start after a successful image build. Once found and fixed, redeploy and have the user re-verify, in order: impersonation (full flow, pathfinder or similar), Blog CMS create/edit, Help Content create/edit, Audit Log page, admin logout, admin invite end-to-end (send → email → accept → login), Action Logs page.

## Open questions

- Root cause of the current failed deployment — unresolved when session ended.
- Whether `git push` failing with `ssh: connect to host ssh.github.com port 443: Connection timed out` (happened several times this session, always succeeded on immediate retry) is a recurring local network flake worth a standing note, or was coincidental.
