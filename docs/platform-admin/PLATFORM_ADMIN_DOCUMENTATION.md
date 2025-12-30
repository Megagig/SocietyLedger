# Super Admin Platform Controls - Complete Documentation

**Version:** 1.0  
**Last Updated:** December 30, 2025  
**Module:** Phase 19 - SaaS Owner / Super Admin Platform Controls

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Pages](#frontend-pages)
6. [Services](#services)
7. [Middleware](#middleware)
8. [Security](#security)
9. [Configuration](#configuration)

---

## Overview

The Super Admin Platform Controls module provides comprehensive SaaS management capabilities for platform administrators. It enables:

- **Tenant Lifecycle Management** - Create, suspend, reactivate, soft-delete, and restore tenants
- **Module & Feature Flags** - Dynamic enable/disable of modules and features per tenant
- **Billing Overrides** - Manual billing controls including trial extensions, credits, and bypasses
- **Security Controls** - 2FA enforcement, password policies, session management
- **Audit Logging** - Complete action trail for all platform operations
- **Analytics** - Platform health monitoring and metrics

### Key Design Principles

1. **Non-Breaking Changes** - All existing functionality preserved
2. **Default Permissive** - Missing flags default to enabled (backward compatible)
3. **Explicit Overrides** - All overrides require reason and are logged
4. **Resolution Order** - TenantOverride → PlanModule → Default

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Tenants   │  │   Modules   │  │   Billing   │              │
│  │    Page     │  │    Page     │  │    Page     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer (Express)                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Platform Admin Controller                   │    │
│  │  - Tenant Management    - Module/Feature Toggles        │    │
│  │  - Billing Overrides    - Security Settings             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │    Tenant     │  │ ModuleFeature │  │   Billing     │        │
│  │  Management   │  │   Service     │  │   Override    │        │
│  │   Service     │  │               │  │   Service     │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
│  ┌───────────────┐                                               │
│  │   Platform    │                                               │
│  │  ActionLog    │                                               │
│  │   Service     │                                               │
│  └───────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database (PostgreSQL)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Platform   │  │   Tenant    │  │   Billing   │              │
│  │  Modules    │  │  Overrides  │  │  Overrides  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
apps/
├── api/src/
│   ├── modules/admin/
│   │   ├── admin.routes.ts          # API route definitions
│   │   └── platform-admin.controller.ts  # Controller logic
│   ├── services/
│   │   ├── tenant-management.service.ts  # Tenant operations
│   │   ├── module-feature.service.ts     # Module/feature logic
│   │   ├── billing-override.service.ts   # Billing operations
│   │   └── platform-action-log.service.ts # Audit logging
│   ├── middleware/
│   │   ├── module-feature.middleware.ts  # Module/feature checks
│   │   └── subscription.middleware.ts    # Subscription checks
│   └── config/
│       └── module-routes.ts              # Route-to-module mapping
│
└── web/src/app/admin/
    ├── page.tsx                     # Admin dashboard
    ├── tenants/
    │   ├── page.tsx                 # Tenant list
    │   └── [id]/page.tsx            # Tenant detail (5 tabs)
    ├── modules/page.tsx             # Platform modules
    ├── settings/page.tsx            # Platform settings
    ├── analytics/page.tsx           # Platform analytics
    └── action-logs/page.tsx         # Action logs
```

---

## Database Schema

### Core Models

#### PlatformModule
Defines available modules in the platform.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| code | String | Unique identifier (e.g., "members", "ledger") |
| name | String | Display name |
| description | String? | Optional description |
| isCore | Boolean | Core modules cannot be disabled |
| sortOrder | Int | Display order |

#### PlatformFeature
Defines fine-grained features within modules.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| moduleId | Int | Parent module reference |
| code | String | Unique identifier (e.g., "ledger.export") |
| name | String | Display name |
| isCore | Boolean | Core features cannot be disabled |

#### TenantModule
Per-tenant module overrides.

| Field | Type | Description |
|-------|------|-------------|
| associationId | Int | Tenant reference |
| moduleId | Int | Module reference |
| isEnabled | Boolean | Override state |
| overrideType | Enum | MANUAL, TRIAL, PROMOTION, SUPPORT, COMPLIANCE |
| reason | String? | Reason for override |
| expiresAt | DateTime? | Optional expiration |

#### TenantFeature
Per-tenant feature overrides (same structure as TenantModule).

#### BillingOverride
Billing exceptions and overrides.

| Field | Type | Description |
|-------|------|-------------|
| associationId | Int | Tenant reference |
| overrideType | Enum | BYPASS_BILLING, EXTEND_TRIAL, PAUSE_BILLING, etc. |
| value | String? | Override value (e.g., credit amount) |
| reason | String | Required reason |
| startDate | DateTime | When override starts |
| endDate | DateTime? | Optional end date |
| isActive | Boolean | Current status |

#### PlatformActionLog
Audit trail for all platform actions.

| Field | Type | Description |
|-------|------|-------------|
| actorId | Int | User who performed action |
| actorRole | String | Role at time of action |
| actionType | String | Type of action performed |
| targetType | String | What was affected |
| beforeState | Json? | State before change |
| afterState | Json? | State after change |
| reason | String? | Reason for action |

---

## API Endpoints

### Tenant Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/tenants` | List all tenants with filters |
| GET | `/api/admin/tenants/:id/status` | Get tenant status and details |
| POST | `/api/admin/tenants/:id/suspend` | Suspend a tenant |
| POST | `/api/admin/tenants/:id/reactivate` | Reactivate a tenant |
| POST | `/api/admin/tenants/:id/soft-delete` | Soft delete a tenant |
| POST | `/api/admin/tenants/:id/restore` | Restore a soft-deleted tenant |
| POST | `/api/admin/tenants/:id/force-logout` | Force logout all users |
| PATCH | `/api/admin/tenants/:id/security` | Update security settings |

### Module & Feature Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/modules` | List all platform modules |
| GET | `/api/admin/features` | List all platform features |
| GET | `/api/admin/tenants/:id/modules` | Get tenant's modules & features |
| POST | `/api/admin/tenants/:id/modules/override` | Set module override |
| DELETE | `/api/admin/tenants/:id/modules/:code/override` | Remove module override |
| POST | `/api/admin/tenants/:id/features/override` | Set feature override |
| DELETE | `/api/admin/tenants/:id/features/:code/override` | Remove feature override |

### Billing Overrides

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/tenants/:id/billing/history` | Get billing override history |
| POST | `/api/admin/tenants/:id/billing/override` | Create billing override |
| POST | `/api/admin/tenants/:id/billing/extend-trial` | Extend trial period |
| POST | `/api/admin/tenants/:id/billing/apply-credit` | Apply account credit |
| POST | `/api/admin/billing/overrides/:id/revoke` | Revoke an override |

### Action Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/action-logs` | List action logs with filters |
| GET | `/api/admin/action-logs/stats` | Get action log statistics |

---

## Frontend Pages

### 1. Admin Dashboard (`/admin`)
Main dashboard showing platform overview with quick stats and navigation.

### 2. Tenant List (`/admin/tenants`)
- Searchable, filterable list of all tenants
- Quick actions: View, Suspend, Reactivate, Delete
- Filters: Status, Tier, Show Deleted
- Pagination support

### 3. Tenant Detail (`/admin/tenants/[id]`)
Comprehensive tenant management with 5 tabs:

#### Overview Tab
- Tenant details (name, subdomain, tier, status)
- Subscription information
- User and member counts
- Quick action buttons (Suspend/Reactivate, Force Logout)

#### Modules Tab
- List of all platform modules
- Toggle switches to enable/disable
- Configure button opens modal with:
  - Enable/Disable toggle
  - Reason field (required)
  - Expiration date (optional)
- Remove Override button for overridden modules
- Visual indicators for core modules and overrides

#### Features Tab
- Features grouped by parent module
- Same toggle/configure/remove functionality as modules
- Shows override source (tenant_override, plan, default)

#### Billing Tab
- 6 action cards:
  - Extend Trial
  - Apply Credit
  - Bypass Billing
  - Apply Discount
  - Grace Period
  - Pause Billing
- Active overrides section with Revoke button
- Billing override history table

#### Security Tab
- 2FA enforcement toggle
- Password policy level
- Session timeout configuration
- IP restrictions management

### 4. Platform Modules (`/admin/modules`)
Global view of all platform modules and their configurations.

### 5. Platform Settings (`/admin/settings`)
Platform-wide configuration options.

### 6. Action Logs (`/admin/action-logs`)
Searchable audit log with filters by action type, actor, and date range.

---

## Services

### TenantManagementService
Handles all tenant lifecycle operations.

```typescript
// Key methods
static async getTenantStatus(associationId: number)
static async listTenants(options: ListTenantsOptions)
static async suspendTenant(associationId: number, reason: string, actorId: number)
static async reactivateTenant(associationId: number, actorId: number)
static async softDeleteTenant(associationId: number, reason: string, actorId: number)
static async restoreTenant(associationId: number, actorId: number)
static async forceLogoutTenant(associationId: number, reason: string, actorId: number)
static async updateSecuritySettings(associationId: number, settings: SecuritySettings)
```

### ModuleFeatureService
Handles module and feature status resolution.

```typescript
// Key methods
static async isModuleEnabled(associationId: number, moduleCode: string): Promise<boolean>
static async isFeatureEnabled(associationId: number, featureCode: string): Promise<boolean>
static async getEnabledModules(associationId: number): Promise<ModuleStatus[]>
static async getEnabledFeatures(associationId: number): Promise<FeatureStatus[]>
static async setModuleOverride(associationId: number, moduleCode: string, isEnabled: boolean, ...)
static async setFeatureOverride(associationId: number, featureCode: string, isEnabled: boolean, ...)
static async removeModuleOverride(associationId: number, moduleCode: string)
static async removeFeatureOverride(associationId: number, featureCode: string)
```

### BillingOverrideService
Handles billing exceptions and overrides.

```typescript
// Key methods
static async createOverride(data: CreateOverrideData)
static async getActiveOverrides(associationId: number)
static async getOverrideHistory(associationId: number)
static async revokeOverride(overrideId: number, revokedBy: number, reason: string)
static async extendTrial(associationId: number, days: number, reason: string, actorId: number)
static async applyCredit(associationId: number, amount: number, reason: string, actorId: number)
```

### PlatformActionLogService
Handles audit logging for all platform actions.

```typescript
// Key methods
static async log(data: ActionLogData)
static async getActionLogs(filters: ActionLogFilters)
static async getActionLogStats()
```

---

## Middleware

### Module Feature Middleware
Checks if modules/features are enabled before allowing access.

```typescript
// Usage in routes
router.use('/api/reports', requireModule('reports'));
router.use('/api/ai', requireModule('ai'));
```

### Resolution Order
1. **Tenant Override** - Highest priority, checked first
2. **Plan Assignment** - Checked if no tenant override
3. **Default** - Enabled by default (backward compatible)

---

## Security

### Platform Roles

| Role | Permissions |
|------|-------------|
| SUPER_ADMIN | Full platform access |
| SUPPORT_AGENT | View tenants, impersonate users |
| FINANCE_ADMIN | Billing and subscription management |
| COMPLIANCE_ADMIN | Audit and security access |

### Security Settings per Tenant

- **force2FA** - Require 2FA for all users
- **passwordPolicyLevel** - basic, standard, strict
- **sessionTimeoutMinutes** - Auto-logout after inactivity
- **ipRestrictions** - Whitelist of allowed IPs

---

## Configuration

### Environment Variables

```bash
# Feature Flag Mode
FEATURE_FLAG_MODE=shadow  # shadow | enforce

# Platform Logging
LOG_PLATFORM_ACTIONS=true

# Security Defaults
DEFAULT_SESSION_TIMEOUT=480
FORCE_2FA_FOR_ADMINS=false
```

### Module Route Mapping

Located in `apps/api/src/config/module-routes.ts`:

```typescript
export const MODULE_ROUTE_MAP = {
  '/api/reports': 'reports',
  '/api/accounting': 'accounting',
  '/api/welfare': 'welfare',
  '/api/cooperatives': 'cooperatives',
  '/api/voting': 'voting',
  '/api/meetings': 'meetings',
  '/api/sms': 'sms',
  '/api/ai': 'ai',
};
```

---

## Performance Optimizations

### N+1 Query Fix
The `getEnabledModules` and `getEnabledFeatures` methods use batch queries instead of sequential queries:

- **Before**: N+1 queries (40+ seconds for many modules)
- **After**: 3 parallel queries with Map lookups (~3 seconds)

```typescript
// Optimized approach
const [allModules, tenantOverrides, association] = await Promise.all([
  prisma.platformModule.findMany(),
  prisma.tenantModule.findMany({ where: { associationId } }),
  prisma.association.findUnique({ include: { subscriptions: { include: { plan: { include: { planModules: true } } } } } })
]);

// Create O(1) lookup maps
const overrideMap = new Map(tenantOverrides.map(o => [o.module.code, o]));
```

---

**End of Documentation**
