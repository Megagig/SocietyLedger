# Database-Driven RBAC Migration Guide

This document outlines the migration from hardcoded roles to a database-driven Role-Based Access Control (RBAC) system for SocietyLedger.

## 🎯 Overview

The migration follows a **gradual, non-breaking approach** with three phases:

1. **Phase 1 - Shadow Mode**: New RBAC runs alongside legacy system
2. **Phase 2 - Hybrid Mode**: New RBAC with legacy fallback  
3. **Phase 3 - Enforced Mode**: Complete database-driven system (DATABASE IS SINGLE SOURCE OF TRUTH)

## ✅ Current Status: ENFORCED MODE

The RBAC system is now in **full enforcement mode**:

- Database is the **SINGLE SOURCE OF TRUTH** for all permissions
- Hardcoded role-permission mappings have been removed
- Frontend fetches permissions from API on login/auth check
- All permission checks use the database-driven system

### Key Changes in Enforced Mode

1. **Backend**: `apps/api/src/middleware/rbac.ts` now uses database-only permission resolution
2. **Frontend**: `apps/web/src/hooks/usePermissions.tsx` uses `user.permissions` array from API
3. **Auth**: Login and `/auth/me` endpoints return user permissions from database
4. **Legacy**: Old `ROLE_PERMISSIONS` mappings are deprecated (kept for reference only)

## 🏗️ Architecture

### Database Schema

The RBAC system introduces four new tables:

- `permissions` - Global permission registry
- `roles` - Association-scoped roles (+ platform roles)
- `role_permissions` - Many-to-many junction table
- `user_roles` - Users can have multiple roles per association

### Permission Registry

All permissions are defined in the registry with the exact keys from the requirements:

```typescript
// Examples
"members.view"           // View member profiles
"members.view_own"       // View own profile only  
"members.view_all"       // View all member profiles
"ledger.create"          // Create ledger entries
"payments.approve"       // Approve payments
```

### Multi-Tenant Isolation

- **Platform Roles**: `SUPER_ADMIN`, `SUPPORT_AGENT` (bypass tenant checks)
- **Association Roles**: Scoped to specific associations
- **Permission Resolution**: Tenant-aware with caching

## 🚀 Migration Process

### Prerequisites

1. Ensure database is backed up
2. All existing migrations are applied
3. Application is running stable

### Step 1: Database Migration

```bash
# Create and apply the RBAC schema
cd apps/api
npm run db:migrate

# Or create migration manually
npx prisma migrate dev --name add-rbac-system
```

### Step 2: Seed RBAC System

```bash
# Run the complete migration (includes seeding)
npm run migrate:rbac

# Or just seed (if schema already exists)
npm run seed:rbac

# Dry run to validate
npm run migrate:rbac:dry
```

### Step 3: Configure Environment

```bash
# Copy RBAC configuration
cp .env.rbac.example .env.local

# Set initial mode
RBAC_MODE=shadow
RBAC_LOG_MISMATCHES=true
RBAC_ENFORCE=false
```

### Step 4: Deploy Phase 1 (Shadow Mode)

```bash
# Deploy with shadow mode enabled
RBAC_MODE=shadow npm run start
```

Monitor logs for permission mismatches:

```bash
# Check RBAC health
curl http://localhost:3000/api/health/rbac

# View application logs
tail -f logs/app.log | grep "RBAC Mismatch"
```

### Step 5: Analyze and Fix Mismatches

Review mismatch logs and fix any permission mapping issues:

```typescript
// Example mismatch log
{
  "user": 123,
  "role": "treasurer", 
  "permission": "finance:approve",
  "legacy": true,
  "new": false,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Step 6: Switch to Hybrid Mode

Once mismatch rate is < 1%:

```bash
# Update environment
RBAC_MODE=hybrid
RBAC_ENFORCE=true

# Restart application
npm run start
```

### Step 7: Switch to Enforced Mode (CURRENT)

After successful hybrid mode operation:

```bash
# Final mode - Database is SINGLE SOURCE OF TRUTH
RBAC_MODE=enforced
RBAC_LOG_MISMATCHES=false

# Restart application  
npm run start
```

In enforced mode:
- All permission checks use the database
- Frontend receives permissions from API on login
- No fallback to hardcoded permissions
- Full UI-based role and permission management enabled

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RBAC_MODE` | `enforced` | Migration phase: shadow/hybrid/enforced |
| `RBAC_LOG_MISMATCHES` | `false` | Log permission mismatches (shadow/hybrid only) |
| `RBAC_ENFORCE` | `true` | Enforce permission denials |
| `RBAC_CACHE_TTL` | `300000` | Permission cache TTL (ms) |
| `RBAC_AUDIT_ENABLED` | `true` | Enable audit logging |

### Migration Options

```bash
# Available migration flags
npm run migrate:rbac --dry-run     # Validate only
npm run migrate:rbac --skip-seed   # Skip seeding
npm run migrate:rbac --force       # Force migration
```

## 📊 Monitoring

### Health Endpoint

```bash
GET /api/health/rbac
```

Returns:
- Permission check statistics
- Mismatch analytics  
- Database health
- Recommendations

### Analytics Dashboard

The system provides detailed analytics:

```typescript
{
  "mismatchRate": 0.5,
  "topMismatchedPermissions": [
    { "permission": "finance:approve", "count": 15 }
  ],
  "usersMostAffected": [
    { "userId": 123, "mismatchCount": 8 }
  ]
}
```

## 🛠️ Usage Examples

### Middleware Usage

```typescript
// Legacy middleware (still works)
import { requirePermission } from '../middleware/rbac';
router.get('/members', requirePermission(PERMISSIONS.MEMBER_VIEW));

// Enhanced middleware (recommended)
import { requirePermissionEnhanced } from '../middleware/rbac-enhanced';
router.get('/members', requirePermissionEnhanced('members.view'));
```

### Service Usage

```typescript
import { RBACService } from '../services/rbac.service';

// Check permission
const context = { userId, associationId, platformRole };
const canView = await RBACService.hasPermission(context, 'members.view');

// Check ownership
const canEdit = await RBACService.checkPermissionWithOwnership(
  context, 
  'members.edit_own', 
  resourceUserId
);
```

### Frontend Integration

```typescript
// Frontend permission checking (database-driven)
import { usePermissions, Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';

// Hook usage
const { can, canAny, canAll, permissions } = usePermissions();
if (can(PERMISSIONS.MEMBER_CREATE)) {
  // User has permission from database
}

// Component usage
<Can permission={PERMISSIONS.MEMBER_CREATE}>
  <button>Add Member</button>
</Can>

// Permissions are fetched from API on login and stored in user object
// user.permissions = ['members.view', 'members.create', ...]
```

## 🔍 Troubleshooting

### Common Issues

**High Mismatch Rate**
- Review permission mappings in `rbac-seed.ts`
- Check role assignments for affected users
- Validate association-specific role configurations

**Performance Issues**
- Increase `RBAC_CACHE_TTL`
- Monitor database query performance
- Consider Redis caching for high-traffic deployments

**Migration Failures**
- Check database connectivity
- Ensure sufficient permissions
- Review migration logs for specific errors

### Debug Mode

```bash
# Enable debug logging
RBAC_DEBUG=true npm run start

# Skip caching for testing
RBAC_SKIP_CACHE=true npm run start
```

### Manual Fixes

```sql
-- Fix missing role assignments
INSERT INTO user_roles (user_id, role_id, association_id)
SELECT u.id, r.id, u.association_id
FROM users u
JOIN roles r ON r.name = u.role AND r.association_id = u.association_id
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = u.id AND ur.association_id = u.association_id
);

-- Update permission mappings
UPDATE role_permissions SET permission_id = (
  SELECT id FROM permissions WHERE key = 'members.view_all'
) WHERE permission_id = (
  SELECT id FROM permissions WHERE key = 'members.view'
) AND role_id IN (
  SELECT id FROM roles WHERE name = 'admin'
);
```

## 🔒 Security Considerations

### Permission Validation

- All permissions ending with `_own` enforce ownership
- All permissions ending with `_all` grant unrestricted access
- `SUPER_ADMIN` bypasses all permission checks
- Tenant isolation is maintained throughout

### Audit Trail

Every permission check is logged:

```sql
SELECT * FROM audit_logs 
WHERE action IN ('PERMISSION_GRANTED', 'PERMISSION_DENIED')
ORDER BY created_at DESC;
```

### Cache Security

- Permission cache includes tenant context
- Cache keys are user+association specific
- Cache is cleared on role changes

## 📈 Performance

### Optimization Tips

1. **Enable Caching**: Set appropriate `RBAC_CACHE_TTL`
2. **Database Indexes**: Ensure proper indexing on RBAC tables
3. **Batch Operations**: Use batch permission checks where possible
4. **Monitor Queries**: Watch for N+1 query patterns

### Benchmarks

Expected performance (per permission check):
- **Cached**: < 1ms
- **Database**: < 10ms  
- **Complex roles**: < 50ms

## 🎉 Success Criteria

The migration is successful when:

- ✅ Mismatch rate < 1% in shadow mode
- ✅ No functionality regressions in hybrid mode
- ✅ All tests pass in full RBAC mode
- ✅ Performance meets benchmarks
- ✅ Audit logs show expected permission patterns

## 📞 Support

For issues or questions:

1. Check the troubleshooting section
2. Review migration logs and health endpoint
3. Consult the team lead or system architect
4. Create detailed issue reports with logs and context

---

**Remember**: This migration preserves all existing functionality while adding powerful new capabilities. Take it step by step and monitor closely at each phase.