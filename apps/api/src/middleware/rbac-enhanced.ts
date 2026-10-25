import { Request, Response, NextFunction } from 'express';
import { PlatformRole } from '@prisma/client';
import { RBACService, RBACContext } from '../services/rbac.service';

/**
 * Database-Driven RBAC Middleware
 * 
 * This middleware enforces permissions from the database.
 * The database is the single source of truth for all permissions.
 */

// Configuration
const RBAC_CONFIG = {
  // Log permission checks for debugging
  logChecks: process.env.RBAC_LOG_CHECKS === 'true',
  
  // Audit all permission checks to database
  auditEnabled: process.env.RBAC_AUDIT_ENABLED !== 'false'
};

/**
 * Create RBAC context from request
 */
function createRBACContext(req: Request): RBACContext {
  return {
    userId: req.user!.id,
    associationId: req.user?.associationId ?? null,
    platformRole: req.user?.platformRole ?? null
  };
}

/**
 * Middleware to require a specific permission (database-driven)
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check authentication
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      // Super admins bypass all permission checks
      if (req.user.platformRole === PlatformRole.SUPER_ADMIN) {
        return next();
      }

      const context = createRBACContext(req);
      const hasPermission = await RBACService.hasPermission(context, permission);

      if (RBAC_CONFIG.logChecks) {
        console.log(`🔐 Permission check: ${permission} for user ${req.user.id} = ${hasPermission}`);
      }

      // Audit the permission check
      if (RBAC_CONFIG.auditEnabled) {
        await RBACService.auditPermissionCheck(context, permission, hasPermission, {
          route: req.route?.path || req.path,
          method: req.method
        }).catch(err => console.error('Audit log error:', err));
      }

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied',
          requiredPermission: permission,
          code: 'INSUFFICIENT_PERMISSIONS', // F0.5 — same NoPermission state as the other RBAC checks below
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Authorization check failed' 
      });
    }
  };
}

/**
 * Middleware to require ANY of the specified permissions
 */
export function requireAnyPermission(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check authentication
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      // Super admins bypass all permission checks
      if (req.user.platformRole === PlatformRole.SUPER_ADMIN) {
        return next();
      }

      const context = createRBACContext(req);
      const hasPermission = await RBACService.hasAnyPermission(context, permissions);

      if (RBAC_CONFIG.logChecks) {
        console.log(`🔐 Permission check (ANY): ${permissions.join(', ')} for user ${req.user.id} = ${hasPermission}`);
      }

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied',
          requiredPermissions: permissions,
          code: 'INSUFFICIENT_PERMISSIONS', // F0.5
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
}

/**
 * Middleware to require ALL of the specified permissions
 */
export function requireAllPermissions(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check authentication
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      // Super admins bypass all permission checks
      if (req.user.platformRole === PlatformRole.SUPER_ADMIN) {
        return next();
      }

      const context = createRBACContext(req);
      const hasPermission = await RBACService.hasAllPermissions(context, permissions);

      if (RBAC_CONFIG.logChecks) {
        console.log(`🔐 Permission check (ALL): ${permissions.join(', ')} for user ${req.user.id} = ${hasPermission}`);
      }

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          requiredPermissions: permissions,
          code: 'INSUFFICIENT_PERMISSIONS', // F0.5
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Authorization check failed' 
      });
    }
  };
}

/**
 * Middleware to check ownership with _own permission support
 */
export function requireOwnership(
  getUserIdFromRequest: (req: Request) => number | undefined,
  permission?: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check authentication
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      // Super admins bypass ownership checks
      if (req.user.platformRole === PlatformRole.SUPER_ADMIN) {
        return next();
      }

      const context = createRBACContext(req);
      
      // Check if user has _all permission (bypasses ownership)
      if (permission) {
        const allPermission = permission.replace('_own', '_all');
        const hasAllAccess = await RBACService.hasPermission(context, allPermission);
        if (hasAllAccess) {
          return next();
        }
      }

      const resourceUserId = getUserIdFromRequest(req);
      if (!resourceUserId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Resource owner could not be determined' 
        });
      }

      // Check ownership
      if (resourceUserId !== req.user.id) {
        // If permission specified, check _own variant
        if (permission) {
          const ownPermission = permission.endsWith('_own') ? permission : `${permission}_own`;
          const hasOwnPermission = await RBACService.hasPermission(context, ownPermission);
          
          if (!hasOwnPermission) {
            return res.status(403).json({ 
              success: false, 
              message: 'You can only access your own resources',
              requiredPermission: ownPermission
            });
          }
        }
        
        return res.status(403).json({ 
          success: false, 
          message: 'You can only access your own resources' 
        });
      }

      next();
    } catch (error) {
      console.error('Ownership middleware error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Authorization check failed' 
      });
    }
  };
}

/**
 * Middleware to require specific association role
 * Checks if user has a role with the given name in the current association
 */
export function requireAssociationRole(roleNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check authentication
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      // Super admins bypass role checks
      if (req.user.platformRole === PlatformRole.SUPER_ADMIN) {
        return next();
      }

      const context = createRBACContext(req);
      const userPermissions = await RBACService.resolveUserPermissions(context);
      
      // Check if user has any of the required roles
      const hasRole = roleNames.some(roleName => userPermissions.roles.includes(roleName));

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          requiredRoles: roleNames,
          code: 'INSUFFICIENT_PERMISSIONS', // F0.5
        });
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Authorization check failed' 
      });
    }
  };
}

/**
 * Middleware to require platform role (SUPER_ADMIN, SUPPORT_AGENT)
 */
export function requirePlatformRole(roles: PlatformRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const platformRole = req.user.platformRole;
    if (!platformRole || !roles.includes(platformRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Platform access denied',
        requiredRole: roles 
      });
    }
    
    next();
  };
}

/**
 * Middleware to require SUPER_ADMIN platform role
 * Convenience wrapper for requirePlatformRole([PlatformRole.SUPER_ADMIN])
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  if (req.user.platformRole !== PlatformRole.SUPER_ADMIN) {
    return res.status(403).json({ 
      success: false, 
      message: 'Super admin access required' 
    });
  }
  
  next();
}

/**
 * Middleware to attach user permissions to request context
 */
export function attachPermissions() {
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

// Re-export for backward compatibility during migration
export {
  requirePermission as requirePermissionEnhanced,
  requireAnyPermission as requireAnyPermissionEnhanced,
  requireAllPermissions as requireAllPermissionsEnhanced,
  requireOwnership as requireOwnershipEnhanced,
  attachPermissions as attachPermissionsMiddleware
};