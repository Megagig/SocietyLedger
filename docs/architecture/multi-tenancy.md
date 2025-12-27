# Multi-Tenancy Architecture

SocietyLedger uses a **shared database, shared schema** multi-tenancy model with tenant isolation enforced at the application layer.

## 1. Tenant Model

Each tenant is an **Association** — a cooperative society, housing association, or community group that registers on the platform.

```
Association
├── id (PK)
├── name
├── slug (unique, URL-safe)
├── subdomain (unique, routing key)
├── tier (STARTER | PROFESSIONAL | ENTERPRISE)
├── status (ACTIVE | SUSPENDED | CANCELLED | PENDING_VERIFICATION)
├── settings (JSON)
└── subscriptions[]
```

## 2. Subdomain Routing

Tenants access the platform via a subdomain:

```
https://<subdomain>.societyledger.com
```

### Resolution Flow

1. **Next.js Middleware** (`apps/web/middleware.ts`)
   - Extracts subdomain from `Host` header
   - Sets `x-tenant` header on all internal requests

2. **Express Tenant Middleware** (`apps/api/src/middleware/tenant.middleware.ts`)
   - Reads `x-tenant` header (or `X-Subdomain` for direct API calls)
   - Queries `Association` by subdomain
   - Attaches `req.association` for downstream handlers
   - Blocks suspended/cancelled tenants

### Local Development

For local testing, use one of these approaches:

- **Hosts file**: Map `demo.localhost` to `127.0.0.1`
- **Caddy proxy**: Auto-handle `*.localhost` subdomains
- **Header override**: Send `X-Subdomain: demo` directly

See [docs/development/local-subdomains.md](../development/local-subdomains.md) for setup instructions.

## 3. Tenant Isolation

Every business entity includes an `associationId` foreign key:

```prisma
model Member {
  id            Int         @id @default(autoincrement())
  associationId Int
  association   Association @relation(fields: [associationId], references: [id])
  // ...
}
```

### Enforcement Points

| Layer | Mechanism |
|-------|-----------|
| API Middleware | Injects `associationId` filter on all queries |
| JWT Token | Contains `associationId` claim |
| Prisma Queries | All `findMany`/`create` use `associationId` from context |
| Row-Level | Composite indexes ensure efficient filtered queries |

### Isolation Middleware

```typescript
// Adds tenant filter to request
req.tenantFilter = { associationId: req.association.id };

// Controllers use it
const members = await prisma.member.findMany({
  where: { ...req.tenantFilter, ...otherFilters },
});
```

## 4. Data Model Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                          PLATFORM                                │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐               │
│  │   Plan   │───▶│Subscription│◀───│  Association  │              │
│  └──────────┘    └──────────┘    └───────┬───────┘               │
│                                          │                        │
│        ┌─────────────────────────────────┼────────────────┐       │
│        │                                 │                │       │
│        ▼                                 ▼                ▼       │
│   ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐   │
│   │  User   │    │  Member  │    │  Account │    │   Loan    │   │
│   └─────────┘    └──────────┘    └──────────┘    └───────────┘   │
│                                                                   │
│   All entities scoped by associationId                           │
└──────────────────────────────────────────────────────────────────┘
```

## 5. Authentication & Authorization

### JWT Payload

```typescript
interface TokenPayload {
  userId: number;
  email: string;
  associationId: number | null;   // null for platform admins
  role: string;                   // association role
  platformRole: PlatformRole;     // NONE | SUPER_ADMIN | SUPPORT_AGENT
}
```

### Role Hierarchy

1. **Platform Roles** (cross-tenant)
   - `SUPER_ADMIN`: Full platform access, impersonation
   - `SUPPORT_AGENT`: Read-only cross-tenant access

2. **Association Roles** (within tenant)
   - `admin`: Full tenant management
   - `treasurer`: Financial operations
   - `member`: Basic access

### RBAC Middleware

```typescript
// Require platform role
app.use('/api/admin', requirePlatformRole([PlatformRole.SUPER_ADMIN]));

// Require association role
router.post('/transactions', requireAssociationRole(['admin', 'treasurer']));
```

## 6. Association Lifecycle

```
                    ┌──────────────────────┐
                    │                      │
    ┌──────────────▶│  PENDING_VERIFICATION │
    │               │                      │
    │               └──────────┬───────────┘
    │                          │ verify email
    │                          ▼
    │               ┌──────────────────────┐
    │               │                      │
    │ reactivate    │       ACTIVE         │◀────────────┐
    │               │                      │             │
    │               └──────────┬───────────┘             │
    │                          │                         │
    │        ┌─────────────────┴─────────────────┐       │
    │        │ suspend                 cancel    │       │
    │        ▼                                   ▼       │
    │ ┌──────────────┐                 ┌──────────────┐ │
    │ │              │                 │              │ │
    └─│  SUSPENDED   │                 │  CANCELLED   │ │
      │              │                 │              │ │
      └──────────────┘                 └──────────────┘
```

## 7. Billing & Subscriptions

### Plans

| Plan | Features | Price |
|------|----------|-------|
| Starter | 50 members, basic | $29/mo |
| Professional | 500 members, reports | $99/mo |
| Enterprise | Unlimited, API, SLA | $299/mo |

### Subscription Model

```prisma
model Subscription {
  id              Int         @id @default(autoincrement())
  associationId   Int
  planId          Int
  status          SubscriptionStatus
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  trialEndsAt     DateTime?
}
```

## 8. Super Admin Features

### Impersonation

Super admins can impersonate any association for support purposes:

```http
POST /api/admin/impersonate
{
  "associationId": 5
}
```

Returns a scoped JWT token. All actions are audit-logged.

### Dashboard

Platform stats and association management available at `/admin/associations`.

## 9. Security Considerations

1. **Tenant Leakage Prevention**
   - All queries require `associationId` (enforced by middleware)
   - No cross-tenant data in responses
   - Audit logs for admin actions

2. **Subdomain Validation**
   - Only alphanumeric + hyphens allowed
   - Reserved words blocked (api, admin, www, app)
   - Unique constraint at database level

3. **Token Scoping**
   - Tokens are scoped to single association
   - Platform tokens have explicit `platformRole`
   - Short-lived impersonation tokens

## 10. Testing Multi-Tenancy

```typescript
describe('Tenant Isolation', () => {
  it('should not leak data across tenants', async () => {
    // Create member in Tenant A
    const memberA = await createMember({ associationId: 1 });
    
    // Query from Tenant B context
    const result = await prisma.member.findMany({
      where: { associationId: 2 }
    });
    
    expect(result).not.toContainEqual(memberA);
  });
});
```

---

## Quick Reference

| Concept | Location |
|---------|----------|
| Tenant resolution | `apps/api/src/middleware/tenant.middleware.ts` |
| RBAC | `apps/api/src/middleware/rbac.ts` |
| JWT payload | `apps/api/src/lib/auth.ts` |
| Subdomain extraction | `apps/web/src/lib/tenant.ts` |
| Association APIs | `apps/api/src/modules/associations/` |
| Admin APIs | `apps/api/src/modules/admin/` |
