import { Request, Response, NextFunction } from 'express';
import { PlatformRole } from '@prisma/client';
import { RBACService, RBACContext, LegacyPermissionMapper } from '../services/rbac.service';
import { Permission, hasPermission, hasAllPermissions, hasAnyPermission } from '../lib/permissions';

/**
 * Enhanced RBAC Middleware - Database-driven with backward compatibility
 * 
 * Migration Strategy:
 * - Phase 1 (Shadow Mode): Run new checks alongside old ones, log differences
 * - Phase 2 (Hybrid Mode): Use new system but preserve existing behavior
 * - Phase 3 (Full RBAC): Complete database-driven system
 */

// Configuration for migration phases
const RBAC_CONFIG = {
  // Set to 'shadow' for Phase 1, 'hybrid' for Phase 2, 'full' for Phase 3
  mode: process.env.RBAC_MODE || 'shadow',
  
  // Log permission mismatches during shadow mode
  logMismatches: process.env.RBAC_LOG_MISMATCHES === 'true',
  
  // Fail on permission denials (false for shadow mode)
  enforcePermissions: process.env.RBAC_ENFORCE === 'true'
};

/**
 * Enhanced permission middleware with database-driven RBAC
 */
export function requirePermissionEnhanced(permission: Permission | string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Super admins bypass all permission checks
      if (req.user?.platformRole === PlatformRole.SUPER_ADMIN) {
        return next();
      }

      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      const context: RBACContext = {
        userId: req.user.id,
        associationId: req.user.associationId,
        platformRole: req.user.platformRole
      };

      // Phase 1: Shadow Mode - Run both old and new systems
      if (RBAC_CONFIG.mode === 'shadow') {
        const legacyResult = hasPermission(req.user.role, permission as Permission);
        const newResult = await RBACService.hasPermission(context, permission);

        // Log mismatches for analysis
        if (RBAC_CONFIG.logMismatches && legacyResult !== newResult) {
          console.warn(`🔍 RBAC Mismatch: ${permission}`, {
            user: req.user.id,
            role: req.user.role,
            association: req.user.associationId,
            legacy: legacyResult,
            new: newResult,
            timestamp: new Date().toISOString()
          });
        }

        // Audit the permission check
        await RBACService.auditPermissionCheck(context, permission, newResult, {
          route: req.route?.path,
          method: req.method,
          legacyResult,
          mode: 'shadow'
        });

        // In shadow mode, use legacy result but don't fail
        if (!legacyResult && RBAC_CONFIG.enforcePermissions) {
          return res.status(403).json({ 
            success: false, 
            message: 'Permission denied',
            requiredPermission: permission,
            userRole: req.user.role,
            mode: 'shadow'
          });
        }

        return next();
      }

      // Phase 2: Hybrid Mode - Use new system but preserve behavior
      if (RBAC_CONFIG.mode === 'hybrid') {
        // Try new system first
        let hasNewPermission = await RBACService.hasPermission(context, permission);
        
        // Fallback to legacy mapping if not found
        if (!hasNewPermission) {
          hasNewPermission = await LegacyPermissionMapper.checkLegacyPermission(context, permission);
        }

        // Audit the permission check
        await RBACService.auditPermissionCheck(context, permission, hasNewPermission, {
          route: req.route?.path,
          method: req.method,
          mode: 'hybrid'
        });

        if (!hasNewPermission) {
          return res.status(403).json({ 
            success: false, 
            message: 'Permission denied',
            requiredPermission: permission,
            mode: 'hybrid'
          });
        }

        return next();
      }

      // Phase 3: Full RBAC - Complete database-driven system
      if (RBAC_CONFIG.mode === 'full') {
        const hasNewPermission = await RBACService.hasPermission(context, permission);

        // Audit the permission check
        await RBACService.auditPermissionCheck(context, permission, hasNewPermission, {
          route: req.route?.path,
          method: req.method,
          mode: 'full'
        });

        if (!hasNewPermission) {
          return res.status(403).json({ 
            success: false, 
            message: 'Permission denied',
            requiredPermission: permission,
            mode: 'full'
          });
        }

        return next();
      }

      // Default fallback to legacy system
      const role = req.user?.role;
      if (!role || !hasPermission(role, permission as Permission)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Permission denied',
          requiredPermission: permission,
          userRole: role,
          mode: 'legacy'
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      
      // In case of error, fall back to legacy system to avoid breaking functionality
      const role = req.user?.role;
      if (!role || !hasPermission(role, permission as Permission)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Permission denied (fallback)',
          requiredPermission: permission,
          userRole: role 
        });
      }
      
      next();
    }
  };
}

/**
 * Enhanced middleware to require ANY of the specified permissions
 */
export function requireAnyPermissionEnhanced(permissions: (Permission | string)[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Super admins bypass all permission checks
      if (req.user?.platformRole === PlatformRole.SUPER_ADMIN) {
        return next();
      }

      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      const context: RBACContext = {
        userId: req.user.id,
        associationId: req.user.associationId,
        platformRole: req.user.platformRole
      };

      // Handle different modes
      if (RBAC_CONFIG.mode === 'shadow') {
        const legacyResult = hasAnyPermission(req.user.role, permissions as Permission[]);
        const newResult = await RBACService.hasAnyPermission(context, permissions);

        if (RBAC_CONFIG.logMismatches && legacyResult !== newResult) {
          console.warn(`🔍 RBAC Mismatch (ANY): ${permissions.join(', ')}`, {
            user: req.user.id,
            role: req.user.role,
            legacy: legacyResult,
            new: newResult
          });
        }

        if (!legacyResult && RBAC_CONFIG.enforcePermissions) {
          return res.status(403).json({ 
            success: false, 
            message: 'Permission denied',
            requiredPermissions: permissions,
            userRole: req.user.role 
          });
        }

        return next();
      }

      if (RBAC_CONFIG.mode === 'hybrid' || RBAC_CONFIG.mode === 'full') {
        const hasNewPermission = await RBACService.hasAnyPermission(context, permissions);

        if (!hasNewPermission) {
          return res.status(403).json({ 
            success: false, 
            message: 'Permission denied',
            requiredPermissions: permissions,
            mode: RBAC_CONFIG.mode
          });
        }

        return next();
      }

      // Legacy fallback
      const role = req.user?.role;
      if (!role || !hasAnyPermission(role, permissions as Permission[])) {
        return res.status(403).json({ 
          success: false, 
          message: 'Permission denied',
          requiredPermissions: permissions,
          userRole: role 
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      
      // Fallback to legacy
      const role = req.user?.role;
      if (!role || !hasAnyPermission(role, permissions as Permission[])) {
        return res.status(403).json({ 
          success: false, 
          message: 'Permission denied (fallback)',
          requiredPermissions: permissions,
          userRole: role 
        });
      }
      
      next();
    }
  };
}

/**
 * Enhanced middleware to require ALL of the specified permissions
 */
export function requireAllPermissionsEnhanced(permissions: (Permission | string)[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Super admins bypass all permission checks
      if (req.user?.platformRole === PlatformRole.SUPER_ADMIN) {
        return next();
      }

      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      const context: RBACContext = {
        userId: req.user.id,
        associationId: req.user.associationId,
        platformRole: req.user.platformRole
      };

      // Handle different modes
      if (RBAC_CONFIG.mode === 'shadow') {
        const legacyResult = hasAllPermissions(req.user.role, permissions as Permission[]);
        const newResult = await RBACService.hasAllPermissions(context, permissions);

        if (RBAC_CONFIG.logMismatches && legacyResult !== newResult) {
          console.warn(`🔍 RBAC Mismatch (ALL): ${permissions.join(', ')}`, {
            user: req.user.id,
            role: req.user.role,
            legacy: legacyResult,
            new: newResult
          });
        }

        if (!legacyResult && RBAC_CONFIG.enforcePermissions) {
          return res.status(403).json({ 
            success: false, 
            message: 'Insufficient permissions',
            requiredPermissions: permissions,
            userRole: req.user.role 
          });
        }

        return next();
      }

      if (RBAC_CONFIG.mode === 'hybrid' || RBAC_CONFIG.mode === 'full') {
        const hasNewPermission = await RBACService.hasAllPermissions(context, permissions);

        if (!hasNewPermission) {
          return res.status(403).json({ 
            success: false, 
            message: 'Insufficient permissions',
            requiredPermissions: permissions,
            mode: RBAC_CONFIG.mode
          });
        }

        return next();
      }

      // Legacy fallback
      const role = req.user?.role;
      if (!role || !hasAllPermissions(role, permissions as Permission[])) {
        return res.status(403).json({ 
          success: false, 
          message: 'Insufficient permissions',
          requiredPermissions: permissions,
          userRole: role 
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      
      // Fallback to legacy
      const role = req.user?.role;
      if (!role || !hasAllPermissions(role, permissions as Permission[])) {
        return res.status(403).json({ 
          success: false, 
          message: 'Insufficient permissions (fallback)',
          requiredPermissions: permissions,
          userRole: role 
        });
      }
      
      next();
    }
  };
}

/**
 * Enhanced ownership middleware with _own permission support
 */
export function requireOwnershipEnhanced(
  getUserIdFromRequest: (req: Request) => number | undefined,
  permission?: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Super admins and admins bypass ownership checks
      if (req.user?.platformRole === PlatformRole.SUPER_ADMIN || req.user?.role === 'admin') {
        return next();
      }

      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      const resourceUserId = getUserIdFromRequest(req);
      if (!resourceUserId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Resource owner could not be determined' 
        });
      }

      const context: RBACContext = {
        userId: req.user.id,
        associationId: req.user.associationId,
        platformRole: req.user.platformRole
      };

      // If permission is specified, check _own variant
      if (permission) {
        const ownPermission = permission.endsWith('_own') ? permission : `${permission}_own`;
        const hasOwnershipPermission = await RBACService.checkPermissionWithOwnership(
          context, 
          ownPermission, 
          resourceUserId
        );

        if (!hasOwnershipPermission) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only access your own resources',
            requiredPermission: ownPermission
          });
        }
      } else {
        // Basic ownership check
        if (resourceUserId !== req.user.id) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only access your own resources' 
          });
        }
      }

      next();
    } catch (error) {
      console.error('Ownership middleware error:', error);
      
      // Fallback to basic ownership check
      const resourceUserId = getUserIdFromRequest(req);
      if (!resourceUserId || resourceUserId !== req.user?.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only access your own resources (fallback)' 
        });
      }
      
      next();
    }
  };
}

/**
 * Middleware to attach permissions to request context
 */
export function attachPermissionsMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user) {
        await RBACService.attachPermissionsToRequest(req);
      }
      next();
    } catch (error) {
      console.error('Error attaching permissions:', error);
      next(); // Don't fail the request
    }
  };
}

/**
 * Utility to check if RBAC is in shadow mode
 */
export function isRBACInShadowMode(): boolean {
  return RBAC_CONFIG.mode === 'shadow';
}

/**
 * Utility to switch RBAC mode (for testing/gradual rollout)
 */
export function setRBACMode(mode: 'shadow' | 'hybrid' | 'full'): void {
  RBAC_CONFIG.mode = mode;
  console.log(`🔐 RBAC mode switched to: ${mode}`);
}