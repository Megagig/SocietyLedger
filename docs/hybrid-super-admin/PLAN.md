# Hybrid Super Admin Architecture - Implementation Plan

**Document Version:** 1.0  
**Created:** January 1, 2026  
**Status:** PENDING APPROVAL  
**Priority:** 🔴 HIGH - Architecture Enhancement

---

## 📋 Executive Summary

This document outlines the plan to refactor the Super Admin architecture to follow a **Hybrid SaaS Model** where Super Admins are normal users who belong to an association AND also have system-level (platform) privileges, with explicit impersonation when acting on other associations.

### Key Objectives
1. Every Super Admin MUST belong to an association (real or "Platform/System Association")
2. Super Admin has system-level privileges separate from tenant privileges
3. Impersonation remains the ONLY way to act on other associations
4. Zero regressions to existing functionality
5. Backward-compatible, additive changes only

---

## 🔍 Current State Analysis

### What Exists (DO NOT MODIFY)

| Component | Location | Status |
|-----------|----------|--------|
| Impersonation Logic | `apps/api/src/modules/admin/admin.controller.ts` | ✅ Working |
| RBAC Middleware | `apps/api/src/middleware/rbac-enhanced.ts` | ✅ Working |
| Tenant Middleware | `apps/api/src/middleware/tenant.middleware.ts` | ✅ Working |
| Auth Middleware | `apps/api/src/middleware/auth.middleware.ts` | ✅ Working |
| Platform Roles | `PlatformRole` enum in Prisma | ✅ Working |
| Admin Routes | `apps/api/src/modules/admin/admin.routes.ts` | ✅ Working |
| Super Admin UI | `apps/web/src/app/admin/` | ✅ Working |

### Current Super Admin Behavior
- Super Admins have `platformRole = SUPER_ADMIN` and `associationId = NULL`
- Can access `/api/admin/*` routes without tenant context
- Can impersonate any association via `POST /api/admin/impersonate/:associationId`
- Impersonation generates new JWT with target `associationId`
- All impersonation actions are logged to `AuditLog`

### Current Limitations (To Be Addressed)
1. Super Admins have `associationId = NULL` - no "home" association
2. No clear separation between "System Context" and "Tenant Context"
3. No explicit tracking of impersonation state in token
4. No "Platform/System Association" concept
5. Super Admin dashboard is separate from tenant dashboard

---

## 🎯 Target Architecture

### Hybrid Model Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HYBRID SUPER ADMIN MODEL                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SUPER ADMIN USER                                  │   │
│  │  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │   │
│  │  │  TENANT IDENTITY    │    │  PLATFORM IDENTITY                  │ │   │
│  │  │  - associationId    │    │  - platformRole = SUPER_ADMIN       │ │   │
│  │  │  - Normal tenant    │    │  - System-level privileges          │ │   │
│  │  │    roles/perms      │    │  - Cross-tenant visibility          │ │   │
│  │  │  - Can be "Platform │    │  - Impersonation capability         │ │   │
│  │  │    Association"     │    │                                     │ │   │
│  │  └─────────────────────┘    └─────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CONTEXT MODES                                     │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │   │
│  │  │  TENANT MODE    │  │  SYSTEM MODE    │  │  IMPERSONATION MODE │  │   │
│  │  │                 │  │                 │  │                     │  │   │
│  │  │  - Normal ops   │  │  - Platform     │  │  - Acting as        │  │   │
│  │  │  - Own assoc    │  │    dashboard    │  │    another tenant   │  │   │
│  │  │  - Tenant RBAC  │  │  - All tenants  │  │  - Tenant RBAC      │  │   │
│  │  │    applies      │  │    visibility   │  │    applies          │  │   │
│  │  │                 │  │  - No tenant    │  │  - Fully logged     │  │   │
│  │  │                 │  │    data access  │  │                     │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Context Separation

| Context | When Active | Capabilities | RBAC |
|---------|-------------|--------------|------|
| **Tenant Mode** | Super Admin in own association | Normal tenant operations | Tenant RBAC applies |
| **System Mode** | Super Admin accessing `/admin/*` | Platform management, analytics | Platform role check |
| **Impersonation Mode** | After calling impersonate endpoint | Full tenant access | Tenant RBAC applies |

---

## 🚫 Hard Constraints (MUST NOT VIOLATE)

1. ❌ **DO NOT** remove or rewrite existing impersonation logic
2. ❌ **DO NOT** change existing tenant admin or member behavior
3. ❌ **DO NOT** auto-grant cross-association access
4. ❌ **DO NOT** refactor unrelated modules
5. ❌ **DO NOT** change existing API contracts unless strictly additive
6. ❌ **DO NOT** break existing authentication flows
7. ❌ **DO NOT** modify existing RBAC permission checks

---

## ✅ Allowed Changes (Safe Enhancements)

1. ✅ Add new fields (nullable/optional)
2. ✅ Add middleware (non-blocking, layered)
3. ✅ Add context checks (additive)
4. ✅ Add UI indicators
5. ✅ Add documentation comments
6. ✅ Add audit metadata
7. ✅ Create new endpoints (additive)
8. ✅ Create new services (non-invasive)

---

## 📦 Implementation Phases

### Phase 1: Platform Association Setup (Low Risk)
- Create "Platform/System Association" concept
- Add migration to create system association
- Update Super Admin users to have `associationId`

### Phase 2: Context Awareness Enhancement (Medium Risk)
- Add context detection middleware (layered, non-blocking)
- Enhance token payload with context flags
- Add impersonation tracking fields

### Phase 3: Impersonation Hardening (Low Risk)
- Add explicit `isImpersonating` flag to token
- Add `originalAssociationId` tracking
- Enhance audit logging with context

### Phase 4: Frontend UX Enhancement (Low Risk)
- Add context indicator in header
- Add "Return to Platform" button during impersonation
- Enhance Super Admin dashboard with context awareness

### Phase 5: Testing & Validation (Critical)
- Verify existing flows unchanged
- Test impersonation still works
- Validate tenant isolation
- Confirm RBAC enforcement

---

## 🔒 Security Boundaries

### Access Control Matrix

| User Type | Own Association | Other Associations | Platform Admin |
|-----------|-----------------|-------------------|----------------|
| Regular Member | ✅ (via RBAC) | ❌ | ❌ |
| Association Admin | ✅ (via RBAC) | ❌ | ❌ |
| Super Admin (Tenant Mode) | ✅ (via RBAC) | ❌ | ❌ |
| Super Admin (System Mode) | ✅ (via RBAC) | ❌ (view only) | ✅ |
| Super Admin (Impersonating) | N/A | ✅ (via RBAC) | ❌ |

### Audit Requirements
- Every impersonation action logged with:
  - `performedByUserId`
  - `originalAssociationId`
  - `targetAssociationId`
  - `isImpersonated = true`
  - `timestamp`
  - `action`

---

## 📊 Success Criteria

1. ✅ Existing users behave exactly the same
2. ✅ Existing impersonation works exactly as before
3. ✅ Super Admin can operate inside own association normally
4. ✅ Super Admin can access system modules without selecting an association
5. ✅ Super Admin can impersonate other associations safely
6. ✅ No regression in RBAC or tenant isolation
7. ✅ All changes are backward-compatible
8. ✅ All changes are additive (no removals)

---

## 📁 Files to Create/Modify

### New Files
```
apps/api/prisma/seeds/platform-association.seed.ts
apps/api/src/services/context.service.ts
apps/api/src/middleware/context.middleware.ts
apps/api/src/types/context.types.ts
apps/web/src/components/layout/ContextIndicator.tsx
docs/hybrid-super-admin/ARCHITECTURE.md
docs/hybrid-super-admin/TESTING_GUIDE.md
```

### Modified Files (Additive Only)
```
apps/api/prisma/schema.prisma (add fields, not modify existing)
apps/api/src/lib/auth.ts (extend TokenPayload)
apps/api/src/modules/admin/admin.controller.ts (enhance impersonate)
apps/api/src/middleware/auth.middleware.ts (add context detection)
apps/web/src/components/layout/AuthenticatedLayout.tsx (add indicator)
apps/web/src/store/authStore.ts (add context state)
```

---

## ⏱️ Estimated Timeline

| Phase | Duration | Risk Level |
|-------|----------|------------|
| Phase 1: Platform Association | 1 day | 🟢 Low |
| Phase 2: Context Awareness | 2 days | 🟡 Medium |
| Phase 3: Impersonation Hardening | 1 day | 🟢 Low |
| Phase 4: Frontend UX | 1 day | 🟢 Low |
| Phase 5: Testing & Validation | 1 day | 🔴 Critical |

**Total: 6 days**

---

## ❓ Clarification Questions (Before Implementation)

Before proceeding, please confirm:

1. **Platform Association**: Should we create a special "Platform" association for Super Admins, or should they be attached to an existing association?

2. **Existing Super Admins**: How many Super Admin users currently exist with `associationId = NULL`? Should we migrate them automatically or manually?

3. **Impersonation Duration**: Should impersonation tokens have a time limit (e.g., 1 hour)?

4. **End Impersonation**: Should we add an explicit "End Impersonation" endpoint, or is the current behavior (login again) acceptable?

5. **UI Preference**: Should the Super Admin see both Platform Dashboard and Tenant Dashboard in the sidebar, or switch between them?

---

## 📝 Approval

**This plan requires approval before implementation begins.**

- [ ] Architecture approach approved
- [ ] Clarification questions answered
- [ ] Risk assessment accepted
- [ ] Timeline accepted

---

**Next Step:** Once approved, proceed to `TASKS.md` for detailed implementation tasks.
