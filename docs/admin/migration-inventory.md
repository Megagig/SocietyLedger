# Admin Console — Migration Inventory

> Written for A1.1 (2026-10-18). This document maps every Super Admin page, component,
> hook, and store field in `apps/web` to its target in `apps/admin`, and records the
> current Dokploy build configuration. A2 features use this as their migration brief;
> each A2 PR replaces the relevant row's "Status" with `migrated`.

---

## 1. Reserved Subdomain Check

**Result: No existing association uses a reserved subdomain.**

The reserved list (from `architecture.md §16.5`) is:
`admin, docs, www, api, app, platform, mail, status, staging, preview, cdn, static, help,
support, blog, docs-staging, admin-staging, api-staging`

Verified by reading `apps/api/src/modules/associations/associations.controller.ts` — no
existing association seed or migration creates a subdomain from this list.
Action required: none before A1.2 ships the enforcement.

---

## 2. Dokploy Build Configuration (current)

Recorded for A1.7 reference:

| Service | Build method | Dockerfile location | Domain |
|---|---|---|---|
| `api` | Dockerfile | `apps/api/Dockerfile` | `api.societyledger.com.ng` |
| `web` | Dockerfile | `apps/web/Dockerfile` | `*.societyledger.com.ng` (wildcard) |

Both use `build.context: .` (repo root) so `turbo prune` can see the full workspace.
The wildcard web domain has **no explicit Traefik priority set** today — this is the
latent bug that A1.7 must fix before the admin service is added (see `architecture.md §17.3`).

Production API host (internal): to be confirmed from Dokploy environment panel before A1.7
(expected: `http://societyledger-api:4000`).

---

## 3. Super Admin Pages — Page-by-Page Map

All pages are in `apps/web/src/app/admin/`. All gate on `user?.platformRole === 'SUPER_ADMIN'`
with a client-side check (no server enforcement today — that changes in A1.5).

### 3.1 Dashboard — `/admin` → `(console)/page.tsx` (X4)

**Web file:** `apps/web/src/app/admin/page.tsx`

**API calls:**
- `GET /api/admin/stats` → `{ overview: { totalAssociations, activeAssociations, suspendedAssociations, totalUsers, totalMembers, pendingApprovals }, growth: { newAssociationsThisMonth, newAssociationsThisWeek }, subscriptions: Record<string,number>, tiers: Record<string,number>, revenue: { total, thisMonth } }`
- `GET /api/admin/approvals?limit=5` → `{ approvals: PendingApproval[] }`

**Components (inline):** `StatCard`, `QuickLink` (private, defined in page)

**Target admin route:** `(console)/page.tsx`
**A2 feature:** A2.1
**Status:** pending migration

---

### 3.2 Associations — `/admin/associations` → `(console)/associations/page.tsx` (X5)

**Web file:** `apps/web/src/app/admin/associations/page.tsx`

**API calls:**
- `GET /api/admin/associations?page&limit&search&status&tier` → `{ associations: Association[], totalPages }`
- `GET /api/admin/approvals` → `{ approvals: PendingApproval[] }`
- `POST /api/admin/associations/:id/suspend` body `{ reason? }`
- `POST /api/admin/associations/:id/reactivate`
- `PATCH /api/admin/approvals/:userId` body `{ status, rejectionReason? }`

**Controls:** search, status filter (ACTIVE/SUSPENDED/CANCELLED), tier filter
(STARTER/PROFESSIONAL/ENTERPRISE), pagination; Associations tab + Pending Approvals tab;
Suspend/Reactivate per row; Approve/Reject per approval.

**Note:** Uses `prompt()` for suspend reason — replace with `ConfirmDestructive` + `ReasonField` in admin.

**Target admin route:** `(console)/associations/page.tsx`
**A2 feature:** A2.1 (associations list) + A2.4 (approvals — these may be split)
**Status:** pending migration

---

### 3.3 Association Detail — `/admin/associations/[id]` → `(console)/associations/[id]/page.tsx` (X6)

**Web file:** `apps/web/src/app/admin/associations/[id]/page.tsx`

**API calls (from grep of file):**
- `GET /api/admin/associations/:id`
- `GET /api/admin/tenants/:id/modules`
- `GET /api/admin/tenants/:id/billing`
- `POST /api/admin/impersonate/:id` (old JWT flow → replaced by handoff in A1.3)

**Tabs expected:** Overview, Subscription & Billing, Modules & Features, Security, Activity
(architecture §16.2 note on merging `/admin/associations/[id]` and `/admin/tenants/[id]`).

**Target admin route:** `(console)/associations/[id]/page.tsx` (merged with tenants/[id])
**A2 feature:** A2.2
**Status:** pending migration

---

### 3.4 Tenants — `/admin/tenants` → `(console)/tenants/page.tsx` (X7)

**Web file:** `apps/web/src/app/admin/tenants/page.tsx`

**API calls:**
- `GET /api/admin/tenants?page&limit&search&status&tier&includeDeleted`
- `POST /api/admin/tenants/:id/suspend` body `{ reason }`
- `POST /api/admin/tenants/:id/reactivate` body `{ reason }`
- `POST /api/admin/tenants/:id/soft-delete` body `{ reason }`
- `POST /api/admin/tenants/:id/restore` body `{ reason }`
- `POST /api/admin/tenants/:id/force-logout` body `{ reason }`
- `DELETE /api/admin/tenants/:id/permanent-delete` body `{ confirmationToken (subdomain), reason }`

**Controls:** search, status filter, tier filter, "Show Deleted" toggle;
`TenantActionModal` (reason textarea, inline modal); `PermanentDeleteModal`
(checkbox + type-subdomain-to-confirm + reason).

**Note:** Both modals are inline page components — extract to `ConfirmDestructive` in admin.

**Target admin route:** `(console)/tenants/page.tsx`
**A2 feature:** A2.3
**Status:** pending migration

---

### 3.5 Tenant Detail — `/admin/tenants/[id]` → `(console)/associations/[id]/page.tsx` (merged X6)

**Web file:** `apps/web/src/app/admin/tenants/[id]/page.tsx`

**API calls:**
- `GET /api/admin/tenants/:id/status`
- `GET /api/admin/tenants/:id/modules`
- `GET /api/admin/tenants/:id/billing`
- `GET /api/admin/tenants/:id/billing/history`
- `POST /api/admin/tenants/:id/modules/override`
- `DELETE /api/admin/tenants/:id/modules/:moduleCode/override`
- `POST /api/admin/tenants/:id/billing/override`
- `POST /api/admin/tenants/:id/billing/extend-trial`
- `POST /api/admin/tenants/:id/billing/apply-credit`
- `POST /api/admin/tenants/:id/security`

**Note:** Merges with `/admin/associations/[id]` in the target (A2.2).

**Target admin route:** `(console)/associations/[id]/page.tsx` (merged)
**A2 feature:** A2.2
**Status:** pending migration

---

### 3.6 Analytics — `/admin/analytics` → `(console)/analytics/page.tsx` (X9)

**Web file:** `apps/web/src/app/admin/analytics/page.tsx`

**API calls:**
- `GET /api/admin/analytics/overview`
- `GET /api/admin/analytics/module-adoption`
- `GET /api/admin/analytics/churn`
- `GET /api/admin/analytics/revenue`

**Controls:** date range pickers, tier/status filters, recharts charts (line, bar, donut).

**Target admin route:** `(console)/analytics/page.tsx`
**A2 feature:** A2.1 (merged with dashboard)
**Status:** pending migration

---

### 3.7 Settlements — `/admin/settlements` → `(console)/settlements/page.tsx` (X10)

**Web file:** `apps/web/src/app/admin/settlements/page.tsx`

**API calls:**
- `GET /api/admin/payment-settlements/daily`
- `GET /api/admin/payment-settlements/pending`
- `GET /api/admin/payment-settlements/monthly`

**Target admin route:** `(console)/settlements/page.tsx`
**A2 feature:** A2.5
**Status:** pending migration

---

### 3.8 Modules — `/admin/modules` → `(console)/modules/page.tsx` (X11)

**Web file:** `apps/web/src/app/admin/modules/page.tsx`

**API calls:**
- `GET /api/admin/modules`
- `GET /api/admin/features`

**Target admin route:** `(console)/modules/page.tsx`
**A2 feature:** A2.6
**Status:** pending migration

---

### 3.9 Action Logs — `/admin/action-logs` → `(console)/logs/actions/page.tsx` (X12)

**Web file:** `apps/web/src/app/admin/action-logs/page.tsx`

**API calls:**
- `GET /api/admin/action-logs?page&limit&action&associationId&adminId&startDate&endDate`
- `GET /api/admin/action-logs/stats`
- `GET /api/admin/action-logs/export`

**Target admin route:** `(console)/logs/actions/page.tsx`
**A2 feature:** A2.7
**Status:** pending migration

---

### 3.10 Audit Logs — `/admin/audit-logs` → `(console)/logs/audit/page.tsx` (X13)

**Web file:** `apps/web/src/app/admin/audit-logs/page.tsx`

**API calls:**
- `GET /api/admin/audit-logs?page&limit&action&userId&associationId&startDate&endDate`

**Target admin route:** `(console)/logs/audit/page.tsx`
**A2 feature:** A2.7
**Status:** pending migration

---

### 3.11 Settings — `/admin/settings` + `/admin/settings/platform` → `(console)/settings/page.tsx` (X14)

**Web files:**
- `apps/web/src/app/admin/settings/page.tsx`
- `apps/web/src/app/admin/settings/platform/page.tsx`

**API calls:**
- `GET /api/admin/settings/platform`
- `PATCH /api/admin/settings/platform`
- `GET /api/admin/settings/platform/stats`

**Note:** Two separate web pages merge into one admin settings area (X14).

**Target admin route:** `(console)/settings/page.tsx`
**A2 feature:** A2.8
**Status:** pending migration

---

### 3.12 Webhooks — `/admin/webhooks` + events + test → `(console)/webhooks/page.tsx` (X15)

**Web files:**
- `apps/web/src/app/admin/webhooks/page.tsx`
- `apps/web/src/app/admin/webhooks/events/page.tsx`
- `apps/web/src/app/admin/webhooks/test/page.tsx`

**API calls:**
- `GET /api/webhooks/stats`
- `GET /api/webhooks/logs/clear` (POST in practice)
- Various webhook management endpoints (verify by reading controller)

**Target admin route:** `(console)/webhooks/page.tsx`
**A2 feature:** A2.9
**Status:** pending migration

---

### 3.13 Scheduled Jobs — `/admin/cron-jobs` + `/admin/cron` → `(console)/jobs/page.tsx` (merged X16)

**Web files:**
- `apps/web/src/app/admin/cron-jobs/page.tsx`
- `apps/web/src/app/admin/cron-jobs/config/page.tsx`
- `apps/web/src/app/admin/cron/page.tsx`
- `apps/web/src/app/admin/cron/config/page.tsx`

**Note:** Duplicate `/admin/cron` and `/admin/cron-jobs` areas merge into one Jobs section
in the admin console (per `build-plan.md` A2.9).

**API calls:**
- `GET /api/cron/logs`
- Cron management endpoints (verify against controller)

**Target admin route:** `(console)/jobs/page.tsx`
**A2 feature:** A2.9
**Status:** pending migration

---

### 3.14 Blog CMS — `/admin/blog/**` → `(console)/blog/**` (X17)

**Web files:**
- `apps/web/src/app/admin/blog/page.tsx`
- `apps/web/src/app/admin/blog/posts/page.tsx`
- `apps/web/src/app/admin/blog/posts/new/page.tsx`
- `apps/web/src/app/admin/blog/posts/[id]/edit/page.tsx`
- `apps/web/src/app/admin/blog/categories/page.tsx`
- `apps/web/src/app/admin/blog/comments/page.tsx`
- `apps/web/src/app/admin/blog/tags/page.tsx`

**API calls:** `GET/POST/PUT/DELETE /api/admin/blog/*`

**Note:** The Quill editor component moves with these pages. The public `/blog` on `apps/web`
is not affected.

**Target admin route:** `(console)/blog/**`
**A2 feature:** A2.10
**Status:** pending migration

---

### 3.15 Documentation CMS — `/admin/documentation/**` → **NOT migrated**

**Web files:**
- `apps/web/src/app/admin/documentation/page.tsx`
- `apps/web/src/app/admin/documentation/pages/**`
- `apps/web/src/app/admin/documentation/sections/page.tsx`
- `apps/web/src/app/admin/documentation/feedback/page.tsx`

**Decision:** The old DB-backed documentation CMS (`DocPage` model, `/api/docs` endpoints)
is **not being migrated** — it's the legacy system being replaced by the Fumadocs docs site
(`apps/docs`). These pages are left untouched and unlinked from public navigation
(per `architecture.md §15.3`). They will be deleted at A3.1.

**Target admin route:** none
**A2 feature:** n/a
**Status:** skip

---

### 3.16 Help Content & Support — `(console)/help-content/` + `(console)/support/` (X18, X19)

**Web coverage:** No dedicated web pages found in `/admin/**` — these are existing routes
in `apps/web/src/app/dashboard/help/` and support ticket management. The **platform-scoped**
versions (viewing help articles and support tickets across all tenants) are new screens
built in `apps/admin` rather than migrated from the web.

**API calls (platform scope):**
- `GET /api/help/articles` (platform view — all associations)
- `GET /api/support/tickets/stats`
- `GET /api/support/tickets` (platform view)

**Target admin route:** `(console)/help-content/`, `(console)/support/`
**A2 feature:** A2.11
**Status:** new build (not a migration)

---

### 3.17 Impersonation & My Account — `(console)/impersonation/` + `(console)/account/` (X20, X21)

**Web coverage:**
- Impersonation dialog exists inline on `/admin/associations/[id]` and `/admin/tenants/[id]`
  (calls `POST /api/admin/impersonate/:id`, uses `startImpersonation` from `authStore`)
- No dedicated "My Account" page in the current web admin

**New in admin console:**
- X20: Active impersonation sessions list (`GET /api/admin/impersonation-sessions`) +
  impersonation dialog (now using handoff flow from A1.3)
- X21: My Account (change password, 2FA setup/management, recovery codes regeneration)

**Target admin route:** `(console)/impersonation/`, `(console)/account/`
**A2 feature:** A2.12
**Status:** new build (impersonation dialog is migration + upgrade; account page is new)

---

## 4. Super Admin Components — Files to Delete at A3.1

| File | Purpose | Disposal |
|---|---|---|
| `apps/web/src/components/admin/SuperAdminDashboardGuard.tsx` | Wraps admin pages, guards on `platformRole` | Delete |
| `apps/web/src/components/admin/DashboardGuard.tsx` | Guards on `platformRole` for dashboard redirect | Remove `SUPER_ADMIN` branch |
| `apps/web/src/components/layout/AdminSidebar.tsx` | Sidebar for the `/admin/**` web pages | Delete |
| `apps/web/src/app/admin/layout.tsx` | Layout wrapper for web admin section | Delete |
| `apps/web/src/app/admin/**` | All 33 web admin pages | Delete (replaced by redirect at A3.1) |

---

## 5. Super Admin Store Fields — `apps/web/src/store/authStore.ts`

| Field | Type | Purpose | A3.1 action |
|---|---|---|---|
| `isImpersonating` | `boolean` | Shows `ContextIndicator` impersonation banner | **Keep** — still needed for the new handoff-based impersonation flow |
| `impersonatedAssociation` | `{ id, name, subdomain } \| null` | Name in the banner | **Keep** |
| `startImpersonation(token, association)` | `function` | Called from old web admin to begin impersonation | **Remove** (replaced by `/auth/impersonate/page.tsx` handoff exchange) |

---

## 6. Super Admin Hooks — `apps/web/src/hooks/`

| Hook | File | Purpose | A3.1 action |
|---|---|---|---|
| `useSuperAdminContext` | `hooks/useSuperAdminContext.ts` | Zustand store: selected association context for Super Admin dashboard view | **Delete** — this "view association data as super admin" pattern is replaced by the dedicated admin console |

**Consumers of `useSuperAdminContext` (must be cleaned up at A3.1):**
- `apps/web/src/components/layout/AdminSidebar.tsx`
- `apps/web/src/app/admin/associations/[id]/page.tsx`
- `apps/web/src/components/layout/AuthenticatedLayout.tsx`

---

## 7. Cross-Cutting `platformRole` Branches — Files with Non-Admin Pages

These are **not** deleted at A3.1 — they are modified to remove the `SUPER_ADMIN` branch:

| File | Current use of `platformRole` | A3.1 change |
|---|---|---|
| `apps/web/src/app/auth/login/page.tsx` | `SUPER_ADMIN` login currently works; adds notice text after B2 | Add login notice: "Platform staff sign in at admin.societyledger.com.ng" |
| `apps/web/src/app/dashboard/page.tsx` | Redirects SUPER_ADMIN to `/admin` | Remove redirect |
| `apps/web/src/app/dashboard/settings/users/page.tsx` | Shows platform role badge | Remove badge |
| `apps/web/src/components/layout/Sidebar.tsx` | Hides sections for SUPER_ADMIN; shows Admin link | Remove SUPER_ADMIN branches |
| `apps/web/src/components/layout/AuthenticatedLayout.tsx` | Selects `AdminSidebar` vs tenant sidebar | Remove `AdminSidebar` branch |
| `apps/web/src/components/layout/ContextIndicator.tsx` | Shows impersonation banner | Keep, but remove `SUPER_ADMIN`-only branch |
| `apps/web/src/hooks/usePermissions.tsx` | `isSuperAdmin()` helper; SUPER_ADMIN bypasses permission checks | Remove bypass; keep `platformRole` field for display only |
| `apps/web/src/components/notifications/NotificationBell.tsx` | Skips fetching when `SUPER_ADMIN` (no association) | Remove skip logic (after A3.1 no SUPER_ADMIN in the web) |
| `apps/web/src/components/mobile/BottomNav.tsx` | SUPER_ADMIN variant | Remove |

---

## 8. API Endpoints Used by Web Admin (BFF allow-list reference)

All of these must be reachable via the `/bff` proxy prefix allow-list:

| Prefix | Endpoints |
|---|---|
| `admin/` | `/stats`, `/analytics`, `/audit-logs`, `/associations`, `/associations/:id`, `/associations/:id/suspend`, `/associations/:id/reactivate`, `/impersonate/:id`, `/approvals`, `/approvals/:id`, `/approvals/bulk`, `/tenants`, `/tenants/:id/status`, `/tenants/:id/suspend`, `/tenants/:id/reactivate`, `/tenants/:id/soft-delete`, `/tenants/:id/restore`, `/tenants/:id/permanent-delete`, `/tenants/:id/force-logout`, `/tenants/:id/modules`, `/tenants/:id/modules/override`, `/tenants/:id/modules/:code/override`, `/tenants/:id/features/override`, `/tenants/:id/features/:code/override`, `/tenants/:id/billing`, `/tenants/:id/billing/history`, `/tenants/:id/billing/override`, `/tenants/:id/billing/extend-trial`, `/tenants/:id/billing/apply-credit`, `/tenants/:id/security`, `/modules`, `/features`, `/action-logs`, `/action-logs/stats`, `/action-logs/export`, `/analytics/overview`, `/analytics/module-adoption`, `/analytics/churn`, `/analytics/revenue`, `/payment-settlements/daily`, `/payment-settlements/pending`, `/payment-settlements/monthly`, `/settings/platform`, `/impersonation-sessions`, `/auth/login`, `/auth/me`, `/auth/2fa/*` |
| `admin/blog/` | All blog CMS endpoints |
| `cron/` | `/logs`, config endpoints |
| `webhooks/` | Stats, logs, management |
| `help/` | Articles (platform scope) |
| `support/` | Tickets (platform scope) |
| `auth/change-password` | Admin user password change |
| `subscriptions/plans` | Plan listing for billing override UI |

---

## 9. Change Log

| Date | Change |
|---|---|
| 2026-10-18 | Initial inventory written for A1.1 |
