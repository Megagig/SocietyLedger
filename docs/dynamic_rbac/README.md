# Database-Driven RBAC System

## Overview

SocietyLedger implements a fully database-driven Role-Based Access Control (RBAC) system. The database is the **single source of truth** for all permissions, roles, and user assignments.

## Architecture

### Database Schema

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   permissions   │     │   role_permissions   │     │      roles      │
├─────────────────┤     ├──────────────────────┤     ├─────────────────┤
│ id              │     │ role_id (FK)         │     │ id              │
│ name            │◄────│ permission_id (FK)   │────►│ name            │
│ description     │     │ created_at           │     │ description     │
│ category        │     └──────────────────────┘     │ association_id  │
│ created_at      │                                  │ is_system       │
└─────────────────┘                                  │ created_at      │
                                                     └─────────────────┘
                                                            │
                                                            ▼
                       ┌──────────────────────┐     ┌─────────────────┐
                       │     user_roles       │     │      users      │
                       ├──────────────────────┤     ├─────────────────┤
                       │ user_id (FK)         │────►│ id              │
                       │ role_id (FK)         │     │ email           │
                       │ association_id       │     │ platform_role   │
                       │ assigned_by          │     │ association_id  │
                       │ created_at           │     └─────────────────┘
                       └──────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| RBACService | `apps/api/src/services/rbac.service.ts` | Core permission resolution |
| RBAC Middleware | `apps/api/src/middleware/rbac-enhanced.ts` | Route protection |
| Permission Registry | `apps/api/src/lib/permissions.ts` | Permission constants |
| RBAC Seed | `apps/api/prisma/seeds/rbac-seed.ts` | Default roles/permissions |
| Frontend Hook | `apps/web/src/hooks/usePermissions.tsx` | UI permission checks |

## Permission Categories

| Category | Prefix | Description |
|----------|--------|-------------|
| Members | `member.*` | Member management |
| Finance | `finance.*` | Financial operations |
| Reports | `report.*` | Report generation |
| Settings | `settings.*` | System configuration |
| Audit | `audit.*` | Audit log access |
| Governance | `meeting.*`, `election.*`, `poll.*` | Governance features |
| Welfare | `welfare.*` | Welfare management |
| Cooperative | `cooperative.*` | Cooperative features |
| Communication | `sms.*` | SMS/notifications |
| AI | `ai.*` | AI features |

## Default Roles

### System Roles (is_system = true)

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| `admin` | Full association access | All permissions |
| `treasurer` | Financial management | finance.*, report.financial |
| `secretary` | Member & meeting management | member.*, meeting.* |
| `member` | Basic member access | member.view_own, finance.view_own |

### Platform Roles

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Platform-wide access, bypasses all checks |
| `SUPPORT_AGENT` | Limited platform support access |

## API Endpoints

### RBAC Management

```
GET    /api/rbac/roles                    # List all roles
POST   /api/rbac/roles                    # Create role
GET    /api/rbac/roles/:id                # Get role details
PATCH  /api/rbac/roles/:id                # Update role
DELETE /api/rbac/roles/:id                # Delete role

GET    /api/rbac/permissions              # List all permissions
GET    /api/rbac/permissions/categories   # List permission categories

POST   /api/rbac/roles/:id/permissions    # Assign permissions to role
DELETE /api/rbac/roles/:id/permissions    # Remove permissions from role

GET    /api/rbac/users/:id/roles          # Get user's roles
POST   /api/rbac/users/:id/roles          # Assign role to user
DELETE /api/rbac/users/:id/roles/:roleId  # Remove role from user
```

### Auth Endpoints (Permission Delivery)

```
POST   /api/auth/login                    # Returns user.permissions[]
GET    /api/auth/me                       # Returns user.permissions[]
```

## Backend Usage

### Middleware Usage

```typescript
import { requirePermission, requireAnyPermission, requireAllPermissions } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';

// Single permission
router.get('/members', requirePermission(PERMISSIONS.MEMBER_VIEW), controller.list);

// Any of multiple permissions
router.get('/finance', requireAnyPermission([
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.FINANCE_VIEW_OWN
]), controller.list);

// All permissions required
router.post('/finance/approve', requireAllPermissions([
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.FINANCE_APPROVE
]), controller.approve);
```

### Service Usage

```typescript
import { RBACService } from '../services/rbac.service';

// Check permission programmatically
const context = { userId: 1, associationId: 1, platformRole: null };
const hasAccess = await RBACService.hasPermission(context, 'finance.view');

// Get all user permissions
const { permissions, roles } = await RBACService.resolveUserPermissions(context);
```

## Frontend Usage

### usePermissions Hook

```tsx
import { usePermissions, Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';

function MyComponent() {
  const { hasPermission, hasAnyPermission, isLoading } = usePermissions();

  // Programmatic check
  if (hasPermission(PERMISSIONS.FINANCE_VIEW)) {
    // Show finance data
  }

  // Declarative check with Can component
  return (
    <Can permission={PERMISSIONS.MEMBER_CREATE} fallback={<AccessDenied />}>
      <CreateMemberButton />
    </Can>
  );
}
```

### Sidebar Navigation

```tsx
// Sidebar.tsx
const checkPermission = (permission: string | string[]): boolean => {
  if (user?.platformRole === 'SUPER_ADMIN') return true;
  
  const userPermissions = user?.permissions || [];
  
  if (Array.isArray(permission)) {
    return permission.some(p => hasPermission(userPermissions, p));
  }
  
  return hasPermission(userPermissions, permission);
};
```

## Caching Strategy

The RBAC system uses a multi-level caching strategy:

1. **Request-level**: Permissions attached to `req.user.permissions`
2. **Service-level**: LRU cache with 5-minute TTL
3. **Database**: Indexed queries for fast lookups

### Cache Invalidation

Cache is automatically invalidated when:
- User roles are modified
- Role permissions are modified
- User logs out

```typescript
// Manual cache invalidation
await RBACService.invalidateUserCache(userId, associationId);
```

## Audit Logging

All permission checks can be audited:

```typescript
// Enable in environment
RBAC_AUDIT_ENABLED=true
RBAC_LOG_CHECKS=true
```

Audit logs capture:
- User ID
- Permission checked
- Result (granted/denied)
- Route and method
- Timestamp

## Migration from Hardcoded RBAC

If migrating from a hardcoded system:

1. Run the RBAC seed: `npx prisma db seed`
2. Verify roles created: Check `roles` table
3. Verify permissions: Check `permissions` table
4. Assign roles to existing users via UI or script
5. Test permission checks

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| 403 Permission Denied | Check user has required role with permission |
| Permissions not loading | Verify `/api/auth/me` returns permissions array |
| Cache stale | Call `RBACService.invalidateUserCache()` |
| New permission not working | Run RBAC seed to add new permissions |

### Debug Mode

Enable debug logging:

```bash
RBAC_LOG_CHECKS=true
```

This logs all permission checks to console:
```
🔐 Permission check: finance.view for user 1 = true
```

## Security Considerations

1. **Super Admin Bypass**: SUPER_ADMIN role bypasses all permission checks
2. **Association Isolation**: Permissions are scoped to associations
3. **Audit Trail**: All permission changes are logged
4. **No Client Trust**: Never trust client-side permission checks alone
