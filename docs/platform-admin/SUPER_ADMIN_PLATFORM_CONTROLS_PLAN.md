# SaaS Owner / Super Admin Platform Controls - Implementation Plan

**Document Version:** 1.0  
**Created:** December 30, 2025  
**Status:** PENDING APPROVAL  
**Priority:** 🔴 HIGH - Platform Management Critical

---

## 📋 Executive Summary

This document outlines the implementation plan for a comprehensive SaaS Owner / Super Admin system that enables platform-level controls for managing associations (tenants), modules, features, billing, and compliance. The implementation follows a **non-breaking, incremental, backward-compatible** approach.

### Key Objectives
1. **Tenant Management** - Full lifecycle control of associations
2. **Module & Feature Flags** - Dynamic enable/disable per tenant
3. **Plans & Tiers** - Subscription management with feature inheritance
4. **Billing Overrides** - Manual billing controls and exceptions
5. **Platform Roles** - Internal RBAC for platform staff
6. **Security Controls** - 2FA enforcement, session management
7. **Analytics & Metrics** - Platform health monitoring
8. **Audit Logging** - Complete action trail

---

## 🏗️ Architecture Overview

### Current State Analysis

**Existing Infrastructure:**
- ✅ Multi-tenant architecture with `Association` model
- ✅ `PlatformRole` enum (`SUPER_ADMIN`, `SUPPORT_AGENT`)
- ✅ Basic admin module at `apps/api/src/modules/admin/`
- ✅ Tenant middleware with suspension handling
- ✅ Database-driven RBAC system
- ✅ Audit logging infrastructure
- ✅ Platform settings service (basic)

**Gaps to Address:**
- ❌ No module/feature flag system
- ❌ No per-tenant feature overrides
- ❌ No billing override capabilities
- ❌ Limited platform role granularity
- ❌ No force logout / session invalidation
- ❌ No platform analytics dashboard
- ❌ No soft delete for associations

### Design Principles

1. **Non-Breaking Changes** - All existing functionality preserved
2. **Shadow Mode First** - New enforcement runs in logging mode before blocking
3. **Default Permissive** - Missing flags default to enabled
4. **Explicit Overrides** - All overrides require reason and are logged
5. **Backward Compatible** - Existing tenants work without migration

---

## 📊 Database Schema Design

### New Models

```prisma
// ============================================
// PLATFORM ADMIN: MODULE & FEATURE FLAGS
// ============================================

// Platform Module Definition
model PlatformModule {
  id          Int                   @id @default(autoincrement())
  code        String                @unique // e.g., "members", "ledger", "payments"
  name        String
  description String?
  isCore      Boolean               @default(false) @map("is_core") // Core modules can't be disabled
  sortOrder   Int                   @default(0) @map("sort_order")
  createdAt   DateTime              @default(now()) @map("created_at")
  updatedAt   DateTime              @updatedAt @map("updated_at")
  features    PlatformFeature[]
  planModules PlanModule[]
  tenantModules TenantModule[]

  @@map("platform_modules")
}

// Platform Feature Definition (fine-grained)
model PlatformFeature {
  id          Int                   @id @default(autoincrement())
  moduleId    Int                   @map("module_id")
  code        String                @unique // e.g., "ledger.export", "audit.export"
  name        String
  description String?
  isCore      Boolean               @default(false) @map("is_core")
  sortOrder   Int                   @default(0) @map("sort_order")
  createdAt   DateTime              @default(now()) @map("created_at")
  updatedAt   DateTime              @updatedAt @map("updated_at")
  module      PlatformModule        @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  planFeatures PlanFeature[]
  tenantFeatures TenantFeature[]

  @@index([moduleId])
  @@map("platform_features")
}

// Plan-Module Assignment (what modules each plan includes)
model PlanModule {
  id        Int             @id @default(autoincrement())
  planId    Int             @map("plan_id")
  moduleId  Int             @map("module_id")
  isEnabled Boolean         @default(true) @map("is_enabled")
  createdAt DateTime        @default(now()) @map("created_at")
  plan      Plan            @relation(fields: [planId], references: [id], onDelete: Cascade)
  module    PlatformModule  @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@unique([planId, moduleId])
  @@map("plan_modules")
}

// Plan-Feature Assignment (what features each plan includes)
model PlanFeature {
  id        Int             @id @default(autoincrement())
  planId    Int             @map("plan_id")
  featureId Int             @map("feature_id")
  isEnabled Boolean         @default(true) @map("is_enabled")
  createdAt DateTime        @default(now()) @map("created_at")
  plan      Plan            @relation(fields: [planId], references: [id], onDelete: Cascade)
  feature   PlatformFeature @relation(fields: [featureId], references: [id], onDelete: Cascade)

  @@unique([planId, featureId])
  @@map("plan_features")
}

// Tenant-Module Override (per-tenant module overrides)
model TenantModule {
  id            Int             @id @default(autoincrement())
  associationId Int             @map("association_id")
  moduleId      Int             @map("module_id")
  isEnabled     Boolean         @map("is_enabled")
  overrideType  OverrideType    @default(MANUAL) @map("override_type")
  reason        String?
  overriddenBy  Int             @map("overridden_by")
  expiresAt     DateTime?       @map("expires_at")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")
  association   Association     @relation(fields: [associationId], references: [id], onDelete: Cascade)
  module        PlatformModule  @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@unique([associationId, moduleId])
  @@index([associationId])
  @@map("tenant_modules")
}

// Tenant-Feature Override (per-tenant feature overrides)
model TenantFeature {
  id            Int             @id @default(autoincrement())
  associationId Int             @map("association_id")
  featureId     Int             @map("feature_id")
  isEnabled     Boolean         @map("is_enabled")
  overrideType  OverrideType    @default(MANUAL) @map("override_type")
  reason        String?
  overriddenBy  Int             @map("overridden_by")
  expiresAt     DateTime?       @map("expires_at")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")
  association   Association     @relation(fields: [associationId], references: [id], onDelete: Cascade)
  feature       PlatformFeature @relation(fields: [featureId], references: [id], onDelete: Cascade)

  @@unique([associationId, featureId])
  @@index([associationId])
  @@map("tenant_features")
}

// ============================================
// PLATFORM ADMIN: BILLING OVERRIDES
// ============================================

model BillingOverride {
  id            Int                 @id @default(autoincrement())
  associationId Int                 @map("association_id")
  overrideType  BillingOverrideType @map("override_type")
  value         String?             // JSON or simple value depending on type
  reason        String
  startDate     DateTime            @default(now()) @map("start_date")
  endDate       DateTime?           @map("end_date")
  isActive      Boolean             @default(true) @map("is_active")
  createdBy     Int                 @map("created_by")
  revokedBy     Int?                @map("revoked_by")
  revokedAt     DateTime?           @map("revoked_at")
  createdAt     DateTime            @default(now()) @map("created_at")
  updatedAt     DateTime            @updatedAt @map("updated_at")
  association   Association         @relation(fields: [associationId], references: [id], onDelete: Cascade)

  @@index([associationId, isActive])
  @@index([overrideType])
  @@map("billing_overrides")
}

// ============================================
// PLATFORM ADMIN: PLATFORM ACTION LOG
// ============================================

model PlatformActionLog {
  id            Int         @id @default(autoincrement())
  actorId       Int         @map("actor_id")
  actorRole     String      @map("actor_role")
  actionType    String      @map("action_type")
  targetType    String      @map("target_type") // association, user, module, feature, billing
  targetId      Int?        @map("target_id")
  associationId Int?        @map("association_id")
  beforeState   Json?       @map("before_state")
  afterState    Json?       @map("after_state")
  reason        String?
  ipAddress     String?     @map("ip_address")
  userAgent     String?     @map("user_agent")
  createdAt     DateTime    @default(now()) @map("created_at")

  @@index([actorId])
  @@index([actionType])
  @@index([associationId])
  @@index([createdAt])
  @@map("platform_action_logs")
}

// ============================================
// ENUMS
// ============================================

enum OverrideType {
  MANUAL      // Admin manually set
  TRIAL       // Trial period override
  PROMOTION   // Promotional access
  SUPPORT     // Support-granted access
  COMPLIANCE  // Compliance requirement
}

enum BillingOverrideType {
  BYPASS_BILLING      // Skip all billing
  EXTEND_TRIAL        // Extend trial period
  PAUSE_BILLING       // Pause billing temporarily
  APPLY_CREDIT        // Apply credit to account
  MARK_PAID_EXTERNAL  // Paid outside system
  OVERRIDE_PLAN       // Force specific plan
  GRACE_PERIOD        // Grace period for payment
}
```

### Schema Updates to Existing Models

```prisma
// Update Association model
model Association {
  // ... existing fields ...
  
  // New fields for platform admin
  deletedAt             DateTime?           @map("deleted_at") // Soft delete
  deletedBy             Int?                @map("deleted_by")
  deletionReason        String?             @map("deletion_reason")
  force2FA              Boolean             @default(false) @map("force_2fa")
  passwordPolicyLevel   String              @default("standard") @map("password_policy_level")
  sessionTimeoutMinutes Int                 @default(480) @map("session_timeout_minutes")
  ipRestrictions        String[]            @default([]) @map("ip_restrictions")
  
  // New relations
  tenantModules         TenantModule[]
  tenantFeatures        TenantFeature[]
  billingOverrides      BillingOverride[]
}

// Update Plan model
model Plan {
  // ... existing fields ...
  
  // New relations
  planModules   PlanModule[]
  planFeatures  PlanFeature[]
}

// Update PlatformRole enum
enum PlatformRole {
  SUPER_ADMIN
  SUPPORT_AGENT
  FINANCE_ADMIN    // NEW: Billing and payment management
  COMPLIANCE_ADMIN // NEW: Compliance and audit access
}
```

---

## 🔧 Implementation Phases

### Phase 1: Foundation (Safe) - Days 1-3

**Objective:** Add database tables and seed defaults without affecting existing behavior.

#### Tasks

| Task ID | Description | Priority | Est. Hours |
|---------|-------------|----------|------------|
| PA-001 | Create Prisma schema for new models | 🔴 HIGH | 4 |
| PA-002 | Generate and apply migrations | 🔴 HIGH | 2 |
| PA-003 | Create seed script for modules/features | 🔴 HIGH | 4 |
| PA-004 | Seed default plan-module assignments | 🔴 HIGH | 2 |
| PA-005 | Add soft delete fields to Association | 🟡 MEDIUM | 1 |
| PA-006 | Create PlatformActionLog model | 🔴 HIGH | 2 |

#### Seed Data: Modules

```typescript
const PLATFORM_MODULES = [
  { code: 'members', name: 'Member Management', isCore: true },
  { code: 'ledger', name: 'Financial Ledger', isCore: true },
  { code: 'payments', name: 'Payment Processing', isCore: true },
  { code: 'reports', name: 'Reports & Analytics', isCore: false },
  { code: 'audit', name: 'Audit & Compliance', isCore: false },
  { code: 'notifications', name: 'Notifications', isCore: false },
  { code: 'integrations', name: 'Integrations', isCore: false },
  { code: 'accounting', name: 'Accounting System', isCore: false },
  { code: 'welfare', name: 'Welfare & Social Funds', isCore: false },
  { code: 'cooperatives', name: 'Cooperatives & Loans', isCore: false },
  { code: 'voting', name: 'Voting & Elections', isCore: false },
  { code: 'meetings', name: 'Meetings & Attendance', isCore: false },
  { code: 'sms', name: 'SMS & Bulk Communication', isCore: false },
  { code: 'ai', name: 'AI Integration', isCore: false },
];
```

#### Seed Data: Features

```typescript
const PLATFORM_FEATURES = [
  // Ledger features
  { moduleCode: 'ledger', code: 'ledger.export', name: 'Export Ledger Data' },
  { moduleCode: 'ledger', code: 'ledger.bulk_import', name: 'Bulk Import Transactions' },
  
  // Audit features
  { moduleCode: 'audit', code: 'audit.export', name: 'Export Audit Logs' },
  { moduleCode: 'audit', code: 'audit.advanced', name: 'Advanced Audit Analytics' },
  
  // Reports features
  { moduleCode: 'reports', code: 'reports.custom', name: 'Custom Report Builder' },
  { moduleCode: 'reports', code: 'reports.scheduled', name: 'Scheduled Reports' },
  
  // Members features
  { moduleCode: 'members', code: 'members.bulk_import', name: 'Bulk Member Import' },
  { moduleCode: 'members', code: 'members.custom_roles', name: 'Custom Roles' },
  
  // Integrations features
  { moduleCode: 'integrations', code: 'integrations.api_access', name: 'API Access' },
  { moduleCode: 'integrations', code: 'integrations.webhooks', name: 'Webhooks' },
];
```

#### Plan-Module Mapping

```typescript
const PLAN_MODULES = {
  STARTER: ['members', 'ledger', 'payments', 'notifications'],
  PROFESSIONAL: ['members', 'ledger', 'payments', 'reports', 'audit', 'notifications', 'welfare', 'voting', 'meetings', 'sms'],
  ENTERPRISE: ['members', 'ledger', 'payments', 'reports', 'audit', 'notifications', 'integrations', 'accounting', 'welfare', 'cooperatives', 'voting', 'meetings', 'sms', 'ai'],
};
```

---

### Phase 2: Services & Middleware (Shadow Mode) - Days 4-7

**Objective:** Build services and middleware that log mismatches without blocking.

#### Tasks

| Task ID | Description | Priority | Est. Hours |
|---------|-------------|----------|------------|
| PA-007 | Create ModuleFeatureService | 🔴 HIGH | 6 |
| PA-008 | Create requireModule() middleware | 🔴 HIGH | 4 |
| PA-009 | Create requireFeature() middleware | 🔴 HIGH | 4 |
| PA-010 | Create BillingOverrideService | 🔴 HIGH | 6 |
| PA-011 | Create PlatformActionLogService | 🔴 HIGH | 4 |
| PA-012 | Create TenantManagementService | 🔴 HIGH | 6 |
| PA-013 | Add shadow mode logging | 🔴 HIGH | 3 |

#### ModuleFeatureService

```typescript
// apps/api/src/services/module-feature.service.ts

export class ModuleFeatureService {
  /**
   * Check if a module is enabled for an association
   * Resolution order: TenantOverride → PlanModule → Default (enabled)
   */
  static async isModuleEnabled(associationId: number, moduleCode: string): Promise<boolean> {
    // 1. Check tenant override
    const tenantOverride = await prisma.tenantModule.findFirst({
      where: {
        associationId,
        module: { code: moduleCode },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: { module: true }
    });

    if (tenantOverride) {
      return tenantOverride.isEnabled;
    }

    // 2. Check plan assignment
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      include: {
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          include: {
            plan: {
              include: {
                planModules: {
                  where: { module: { code: moduleCode } },
                  include: { module: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const planModule = association?.subscriptions[0]?.plan?.planModules[0];
    if (planModule) {
      return planModule.isEnabled;
    }

    // 3. Default: enabled (backward compatible)
    return true;
  }

  /**
   * Check if a feature is enabled for an association
   */
  static async isFeatureEnabled(associationId: number, featureCode: string): Promise<boolean> {
    // Similar logic to isModuleEnabled
    // ...
  }

  /**
   * Get all enabled modules for an association
   */
  static async getEnabledModules(associationId: number): Promise<string[]> {
    // ...
  }

  /**
   * Get all enabled features for an association
   */
  static async getEnabledFeatures(associationId: number): Promise<string[]> {
    // ...
  }
}
```

#### Middleware Implementation

```typescript
// apps/api/src/middleware/module-feature.middleware.ts

const FEATURE_FLAG_MODE = process.env.FEATURE_FLAG_MODE || 'shadow';

export function requireModule(moduleCode: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const associationId = req.user?.associationId;
    
    if (!associationId) {
      return next(); // Let auth middleware handle this
    }

    const isEnabled = await ModuleFeatureService.isModuleEnabled(associationId, moduleCode);

    if (!isEnabled) {
      // Log the access attempt
      await PlatformActionLogService.log({
        actorId: req.user?.id || 0,
        actorRole: req.user?.platformRole || req.user?.role || 'unknown',
        actionType: 'MODULE_ACCESS_DENIED',
        targetType: 'module',
        associationId,
        afterState: { moduleCode, mode: FEATURE_FLAG_MODE }
      });

      if (FEATURE_FLAG_MODE === 'enforce') {
        return res.status(403).json({
          success: false,
          message: `Module '${moduleCode}' is not available on your current plan.`,
          code: 'MODULE_DISABLED'
        });
      }
      
      // Shadow mode: log but allow
      console.warn(`[SHADOW] Module '${moduleCode}' would be blocked for association ${associationId}`);
    }

    next();
  };
}

export function requireFeature(featureCode: string) {
  // Similar implementation
}
```

---

### Phase 3: API Endpoints - Days 8-12

**Objective:** Build Super Admin APIs for platform management.

#### Tasks

| Task ID | Description | Priority | Est. Hours |
|---------|-------------|----------|------------|
| PA-014 | Tenant Management APIs | 🔴 HIGH | 8 |
| PA-015 | Module/Feature Toggle APIs | 🔴 HIGH | 6 |
| PA-016 | Billing Override APIs | 🔴 HIGH | 6 |
| PA-017 | Platform Analytics APIs | 🟡 MEDIUM | 6 |
| PA-018 | Session Management APIs | 🟡 MEDIUM | 4 |
| PA-019 | Platform Action Log APIs | 🟡 MEDIUM | 4 |

#### API Endpoints

```typescript
// Tenant Management
POST   /api/admin/associations/:id/soft-delete
POST   /api/admin/associations/:id/restore
POST   /api/admin/associations/:id/force-logout
POST   /api/admin/associations/:id/security-settings

// Module & Feature Management
GET    /api/admin/modules
GET    /api/admin/features
GET    /api/admin/associations/:id/modules
PUT    /api/admin/associations/:id/modules/:moduleId
GET    /api/admin/associations/:id/features
PUT    /api/admin/associations/:id/features/:featureId

// Billing Overrides
GET    /api/admin/associations/:id/billing-overrides
POST   /api/admin/associations/:id/billing-overrides
DELETE /api/admin/associations/:id/billing-overrides/:overrideId
POST   /api/admin/associations/:id/extend-trial
POST   /api/admin/associations/:id/bypass-billing
POST   /api/admin/associations/:id/apply-credit

// Platform Analytics
GET    /api/admin/analytics/overview
GET    /api/admin/analytics/churn
GET    /api/admin/analytics/mrr
GET    /api/admin/analytics/module-adoption
GET    /api/admin/analytics/error-trends

// Platform Action Logs
GET    /api/admin/action-logs
GET    /api/admin/action-logs/export
```

---

### Phase 4: Enforcement (Active Mode) - Days 13-15

**Objective:** Enable blocking mode after validation.

#### Tasks

| Task ID | Description | Priority | Est. Hours |
|---------|-------------|----------|------------|
| PA-020 | Add module checks to existing routes | 🔴 HIGH | 8 |
| PA-021 | Add feature checks to existing routes | 🔴 HIGH | 6 |
| PA-022 | Update subscription middleware | 🔴 HIGH | 4 |
| PA-023 | Add billing override checks | 🔴 HIGH | 4 |
| PA-024 | Create enforcement toggle | 🔴 HIGH | 2 |

#### Route-Module Mapping

```typescript
// apps/api/src/config/module-routes.ts

export const MODULE_ROUTE_MAP: Record<string, string> = {
  // Members module
  '/api/members': 'members',
  '/api/member-invites': 'members',
  
  // Ledger module
  '/api/finance': 'ledger',
  '/api/member-ledger': 'ledger',
  '/api/member-finance': 'ledger',
  
  // Payments module
  '/api/payments': 'payments',
  '/api/nigerian-payments': 'payments',
  
  // Reports module
  '/api/reports': 'reports',
  '/api/exports': 'reports',
  
  // Audit module
  '/api/audit': 'audit',
  
  // Accounting module
  '/api/accounting': 'accounting',
  
  // Welfare module
  '/api/welfare': 'welfare',
  
  // Cooperatives module
  '/api/cooperatives': 'cooperatives',
  
  // Voting module
  '/api/voting': 'voting',
  '/api/elections': 'voting',
  '/api/polls': 'voting',
  
  // Meetings module
  '/api/meetings': 'meetings',
  
  // SMS module
  '/api/sms': 'sms',
  
  // AI module
  '/api/ai': 'ai',
};
```

---

## 🔐 Security Implementation

### Platform Roles & Permissions

```typescript
// apps/api/src/config/platform-permissions.ts

export const PLATFORM_PERMISSIONS = {
  SUPER_ADMIN: [
    'platform.*',  // Full access
  ],
  SUPPORT_AGENT: [
    'platform.associations.view',
    'platform.associations.impersonate',
    'platform.users.view',
    'platform.audit.view',
  ],
  FINANCE_ADMIN: [
    'platform.associations.view',
    'platform.billing.*',
    'platform.subscriptions.*',
    'platform.analytics.revenue',
  ],
  COMPLIANCE_ADMIN: [
    'platform.associations.view',
    'platform.audit.*',
    'platform.security.*',
    'platform.analytics.compliance',
  ],
};
```

### Security Controls

```typescript
// Association security settings
interface AssociationSecuritySettings {
  force2FA: boolean;
  passwordPolicyLevel: 'basic' | 'standard' | 'strict';
  sessionTimeoutMinutes: number;
  ipRestrictions: string[];
  maxFailedLogins: number;
  lockoutDurationMinutes: number;
}
```

---

## 📈 Analytics & Metrics

### Dashboard Metrics

```typescript
interface PlatformMetrics {
  // Tenant metrics
  totalTenants: number;
  activeTenants: number;
  trialingTenants: number;
  churnedTenants: number;
  
  // Revenue metrics
  mrr: number;
  arr: number;
  averageRevenuePerTenant: number;
  
  // Module adoption
  moduleAdoption: Record<string, number>;
  featureAdoption: Record<string, number>;
  
  // Health metrics
  errorRate: number;
  apiLatencyP95: number;
  activeUsers24h: number;
}
```

---

## 🧪 Testing Strategy

### Test Categories

1. **Unit Tests**
   - ModuleFeatureService
   - BillingOverrideService
   - Middleware functions

2. **Integration Tests**
   - API endpoint tests
   - Database operations
   - Permission checks

3. **Shadow Mode Validation**
   - Run in shadow mode for 1 week
   - Analyze logs for false positives
   - Validate no existing functionality breaks

---

## 📋 Environment Variables

```bash
# Feature Flag Mode
FEATURE_FLAG_MODE=shadow  # shadow | enforce

# RBAC Mode
RBAC_MODE=shadow  # shadow | enforce

# Platform Logging
LOG_PLATFORM_ACTIONS=true

# Security
FORCE_2FA_FOR_ADMINS=false
DEFAULT_SESSION_TIMEOUT=480
```

---

## ✅ Success Criteria

1. **Backward Compatibility**
   - [ ] All existing tenants work without changes
   - [ ] No API breaking changes
   - [ ] Default behavior is permissive

2. **Platform Control**
   - [ ] Super Admin can enable/disable modules per tenant
   - [ ] Super Admin can assign plans
   - [ ] Super Admin can bypass billing

3. **Audit Trail**
   - [ ] All platform actions are logged
   - [ ] Logs include actor, timestamp, before/after state
   - [ ] Logs include reason where applicable

4. **Security**
   - [ ] Platform roles properly enforced
   - [ ] Impersonation is logged
   - [ ] Session management works

5. **Extensibility**
   - [ ] Easy to add new modules
   - [ ] Easy to add new features
   - [ ] Easy to add new billing override types

---

## 📅 Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Foundation | Days 1-3 | Database schema, migrations, seeds |
| Phase 2: Services | Days 4-7 | Services, middleware (shadow mode) |
| Phase 3: APIs | Days 8-12 | Admin APIs, analytics |
| Phase 4: Enforcement | Days 13-15 | Active mode, route integration |

**Total Estimated Time:** 15 days

---

## 🚀 Next Steps (After Approval)

1. Review and approve this plan
2. Create feature branch: `feature/platform-admin-controls`
3. Begin Phase 1 implementation
4. Daily progress updates
5. Shadow mode validation period
6. Gradual enforcement rollout

---

**Document Status:** IN PROGRESS  
**Prepared By:** Kiro AI Assistant  
**Date:** December 30, 2025

---

## 🖥️ Frontend Implementation Plan (Phase 19.4)

### Overview

The frontend UI for Super Admin Platform Controls will be built using the existing patterns from `apps/web/src/app/admin/`. The implementation follows the established Tailwind CSS + dark mode support patterns.

### New Pages to Create

| Page | Path | Description |
|------|------|-------------|
| Tenant Management | `/admin/tenants` | Enhanced tenant list with advanced controls |
| Tenant Detail | `/admin/tenants/[id]` | Comprehensive tenant view with tabs |
| Module/Feature Toggles | `/admin/tenants/[id]/modules` | Module and feature management |
| Billing Overrides | `/admin/tenants/[id]/billing` | Billing controls and history |
| Security Settings | `/admin/tenants/[id]/security` | Security configuration |
| Platform Action Logs | `/admin/action-logs` | Enhanced action log viewer |

### API Routes to Add (Frontend Constants)

```typescript
// apps/web/src/utils/constants.ts - PLATFORM_ADMIN section
PLATFORM_ADMIN: {
  // Tenant Management
  TENANTS: `${API_BASE_URL}/api/admin/tenants`,
  TENANT_STATUS: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/status`,
  TENANT_SUSPEND: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/suspend`,
  TENANT_REACTIVATE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/reactivate`,
  TENANT_SOFT_DELETE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/soft-delete`,
  TENANT_RESTORE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/restore`,
  TENANT_FORCE_LOGOUT: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/force-logout`,
  TENANT_SECURITY: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/security`,
  
  // Module & Feature Management
  MODULES: `${API_BASE_URL}/api/admin/modules`,
  FEATURES: `${API_BASE_URL}/api/admin/features`,
  TENANT_MODULES: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/modules`,
  TENANT_MODULE_OVERRIDE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/modules/override`,
  TENANT_MODULE_REMOVE: (id: number, code: string) => `${API_BASE_URL}/api/admin/tenants/${id}/modules/${code}/override`,
  TENANT_FEATURE_OVERRIDE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/features/override`,
  TENANT_FEATURE_REMOVE: (id: number, code: string) => `${API_BASE_URL}/api/admin/tenants/${id}/features/${code}/override`,
  
  // Billing Overrides
  TENANT_BILLING: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/billing`,
  TENANT_BILLING_HISTORY: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/billing/history`,
  TENANT_BILLING_OVERRIDE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/billing/override`,
  TENANT_EXTEND_TRIAL: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/billing/extend-trial`,
  TENANT_APPLY_CREDIT: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/billing/apply-credit`,
  BILLING_OVERRIDE_REVOKE: (id: number) => `${API_BASE_URL}/api/admin/billing/overrides/${id}/revoke`,
  
  // Platform Action Logs
  ACTION_LOGS: `${API_BASE_URL}/api/admin/action-logs`,
  ACTION_LOGS_STATS: `${API_BASE_URL}/api/admin/action-logs/stats`,
  ACTION_LOGS_EXPORT: `${API_BASE_URL}/api/admin/action-logs/export`,
}
```

### Frontend Tasks

| Task ID | Description | Priority | Est. Hours |
|---------|-------------|----------|------------|
| PA-FE-001 | Add API routes to constants.ts | 🔴 HIGH | 1 |
| PA-FE-002 | Create Tenant Management page | 🔴 HIGH | 4 |
| PA-FE-003 | Create Tenant Detail page with tabs | 🔴 HIGH | 6 |
| PA-FE-004 | Create Module/Feature Toggles UI | 🔴 HIGH | 4 |
| PA-FE-005 | Create Billing Overrides UI | 🔴 HIGH | 4 |
| PA-FE-006 | Create Security Settings UI | 🟡 MEDIUM | 3 |
| PA-FE-007 | Create Platform Action Logs page | 🟡 MEDIUM | 3 |
| PA-FE-008 | Update admin dashboard with new links | 🟡 MEDIUM | 1 |

**Total Estimated Time:** 26 hours (3-4 days)

### UI Components

1. **TenantCard** - Displays tenant summary with quick actions
2. **ModuleToggle** - Toggle switch for module enable/disable
3. **FeatureToggle** - Toggle switch for feature enable/disable
4. **BillingOverrideForm** - Form for creating billing overrides
5. **ActionLogTable** - Table for displaying action logs with filters
6. **SecuritySettingsForm** - Form for security configuration

### Design Patterns

- Follow existing admin page patterns (dark mode, Tailwind CSS)
- Use toast notifications for success/error feedback
- Implement loading states with spinners
- Use confirmation dialogs for destructive actions
- Support pagination for lists
- Include search and filter capabilities
