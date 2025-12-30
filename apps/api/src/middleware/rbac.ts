/**
 * RBAC Middleware - Database-Driven
 * 
 * This file re-exports the database-driven RBAC middleware.
 * All permission checks are now resolved from the database.
 * 
 * The database is the SINGLE SOURCE OF TRUTH for all permissions.
 */

// Re-export all middleware from the enhanced (database-driven) version
export {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireOwnership,
  requireAssociationRole,
  requirePlatformRole,
  requireSuperAdmin,
  attachPermissions
} from './rbac-enhanced';

// Legacy type alias for backward compatibility
import { Permission as LegacyPermission } from '../lib/permissions';
export type Permission = LegacyPermission | string;