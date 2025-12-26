import { Request, Response, NextFunction } from 'express';
import { PlatformRole } from '@prisma/client';
import { Permission, hasPermission, hasAllPermissions, hasAnyPermission } from '../lib/permissions';

/**
 * Middleware to require specific platform role (SUPER_ADMIN, SUPPORT_AGENT)
 */
export function requirePlatformRole(roles: PlatformRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const platformRole = req.user?.platformRole as PlatformRole | undefined;
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
 * Middleware to require specific association role
 * Super admins bypass this check
 */
export function requireAssociationRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Super admins bypass association role checks
    if (req.user?.platformRole === PlatformRole.SUPER_ADMIN) {
      return next();
    }
    
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Association access denied',
        requiredRoles: roles,
        userRole: role 
      });
    }
    next();
  };
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Super admins have all permissions
    if (req.user?.platformRole === PlatformRole.SUPER_ADMIN) {
      return next();
    }
    
    const role = req.user?.role;
    if (!role || !hasPermission(role, permission)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Permission denied',
        requiredPermission: permission,
        userRole: role 
      });
    }
    next();
  };
}

/**
 * Middleware to require ANY of the specified permissions
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Super admins have all permissions
    if (req.user?.platformRole === PlatformRole.SUPER_ADMIN) {
      return next();
    }
    
    const role = req.user?.role;
    if (!role || !hasAnyPermission(role, permissions)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Permission denied',
        requiredPermissions: permissions,
        userRole: role 
      });
    }
    next();
  };
}

/**
 * Middleware to require ALL of the specified permissions
 */
export function requireAllPermissions(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Super admins have all permissions
    if (req.user?.platformRole === PlatformRole.SUPER_ADMIN) {
      return next();
    }
    
    const role = req.user?.role;
    if (!role || !hasAllPermissions(role, permissions)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions',
        requiredPermissions: permissions,
        userRole: role 
      });
    }
    next();
  };
}

/**
 * Middleware to check if user owns the resource
 * Admins and super admins can access any resource
 */
export function requireOwnership(getUserIdFromRequest: (req: Request) => number | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Super admins and admins bypass ownership checks
    if (req.user?.platformRole === PlatformRole.SUPER_ADMIN || req.user?.role === 'admin') {
      return next();
    }
    
    const resourceUserId = getUserIdFromRequest(req);
    if (!resourceUserId || resourceUserId !== req.user?.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only access your own resources' 
      });
    }
    next();
  };
}
