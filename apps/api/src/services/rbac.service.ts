import { PrismaClient, PlatformRole } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

export interface UserPermissions {
  permissions: Set<string>;
  roles: string[];
  isSuper: boolean;
}

export interface RBACContext {
  userId: number;
  associationId: number | null;
  platformRole: PlatformRole | null;
}

/**
 * RBAC Service - Database-driven permission resolution
 * 
 * This service implements the gradual migration strategy:
 * - Phase 1: Shadow mode - runs alongside hardcoded checks
 * - Phase 2: Hybrid mode - replaces hardcoded checks
 * - Phase 3: Full RBAC - complete database-driven system
 */
export class RBACService {
  private static permissionCache = new Map<string, UserPermissions>();
  private static cacheExpiry = new Map<string, number>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Resolve user permissions from database
   */
  static async resolveUserPermissions(context: RBACContext): Promise<UserPermissions> {
    const { userId, associationId, platformRole } = context;
    
    // Cache key includes association for multi-tenant isolation
    const cacheKey = `${userId}:${associationId}:${platformRole}`;
    
    // Check cache first
    if (this.permissionCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0;
      if (Date.now() < expiry) {
        return this.permissionCache.get(cacheKey)!;
      }
    }

    // Super admins have all permissions
    if (platformRole === PlatformRole.SUPER_ADMIN) {
      const allPermissions = await prisma.permission.findMany({
        where: { isActive: true },
        select: { key: true }
      });
      
      const result: UserPermissions = {
        permissions: new Set(allPermissions.map(p => p.key)),
        roles: ['super_admin'],
        isSuper: true
      };
      
      this.setCachedPermissions(cacheKey, result);
      return result;
    }

    // Resolve association-scoped permissions
    if (!associationId) {
      return {
        permissions: new Set(),
        roles: [],
        isSuper: false
      };
    }

    // Get user roles for this association
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        associationId,
        isActive: true
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: {
                  where: { isActive: true }
                }
              }
            }
          }
        }
      }
    });

    // Collect all permissions from all roles
    const permissions = new Set<string>();
    const roles: string[] = [];

    for (const userRole of userRoles) {
      roles.push(userRole.role.name);
      
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    const result: UserPermissions = {
      permissions,
      roles,
      isSuper: false
    };

    this.setCachedPermissions(cacheKey, result);
    return result;
  }

  /**
   * Check if user has specific permission
   */
  static async hasPermission(context: RBACContext, permissionKey: string): Promise<boolean> {
    const userPermissions = await this.resolveUserPermissions(context);
    return userPermissions.permissions.has(permissionKey);
  }

  /**
   * Check if user has any of the specified permissions
   */
  static async hasAnyPermission(context: RBACContext, permissionKeys: string[]): Promise<boolean> {
    const userPermissions = await this.resolveUserPermissions(context);
    return permissionKeys.some(key => userPermissions.permissions.has(key));
  }

  /**
   * Check if user has all of the specified permissions
   */
  static async hasAllPermissions(context: RBACContext, permissionKeys: string[]): Promise<boolean> {
    const userPermissions = await this.resolveUserPermissions(context);
    return permissionKeys.every(key => userPermissions.permissions.has(key));
  }

  /**
   * Check ownership for _own permissions
   */
  static checkOwnership(context: RBACContext, resourceUserId: number): boolean {
    return context.userId === resourceUserId;
  }

  /**
   * Enhanced permission check with ownership validation
   */
  static async checkPermissionWithOwnership(
    context: RBACContext, 
    permissionKey: string, 
    resourceUserId?: number
  ): Promise<boolean> {
    // Super admins bypass all checks
    if (context.platformRole === PlatformRole.SUPER_ADMIN) {
      return true;
    }

    const userPermissions = await this.resolveUserPermissions(context);

    // Check for _own permission variant
    if (permissionKey.endsWith('_own') && resourceUserId !== undefined) {
      if (userPermissions.permissions.has(permissionKey)) {
        return this.checkOwnership(context, resourceUserId);
      }
    }

    // Check for _all permission variant (grants unrestricted access)
    const allPermission = permissionKey.replace('_own', '_all');
    if (userPermissions.permissions.has(allPermission)) {
      return true;
    }

    // Check exact permission
    return userPermissions.permissions.has(permissionKey);
  }

  /**
   * Attach permissions to request context
   */
  static async attachPermissionsToRequest(req: Request): Promise<void> {
    if (!req.user) return;

    const context: RBACContext = {
      userId: req.user.id,
      associationId: req.user.associationId,
      platformRole: req.user.platformRole
    };

    const userPermissions = await this.resolveUserPermissions(context);
    
    // Attach to request for easy access
    (req as any).permissions = userPermissions.permissions;
    (req as any).userRoles = userPermissions.roles;
    (req as any).isSuper = userPermissions.isSuper;
  }

  /**
   * Clear permission cache for user (call on role changes)
   */
  static clearUserCache(userId: number, associationId?: number): void {
    const pattern = associationId ? `${userId}:${associationId}:` : `${userId}:`;
    
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(pattern)) {
        this.permissionCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  /**
   * Clear all permission cache
   */
  static clearAllCache(): void {
    this.permissionCache.clear();
    this.cacheExpiry.clear();
  }

  private static setCachedPermissions(key: string, permissions: UserPermissions): void {
    this.permissionCache.set(key, permissions);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  /**
   * Audit permission check (for discovery and compliance)
   */
  static async auditPermissionCheck(
    context: RBACContext,
    permissionKey: string,
    granted: boolean,
    resourceInfo?: any
  ): Promise<void> {
    // Log permission attempts for audit and discovery
    try {
      await prisma.auditLog.create({
        data: {
          associationId: context.associationId,
          userId: context.userId,
          action: granted ? 'PERMISSION_GRANTED' : 'PERMISSION_DENIED',
          tableName: 'permissions',
          recordId: null,
          oldValues: null,
          newValues: {
            permissionKey,
            granted,
            resourceInfo,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      // Don't fail the request if audit logging fails
      console.error('Failed to log permission audit:', error);
    }
  }
}

/**
 * Legacy compatibility layer - maps old hardcoded permissions to new system
 * This ensures backward compatibility during migration
 */
export class LegacyPermissionMapper {
  private static readonly LEGACY_MAPPING: Record<string, string[]> = {
    // Map old permission constants to new permission keys
    'member:view': ['members.view', 'members.view_all'],
    'member:create': ['members.create'],
    'member:edit': ['members.edit', 'members.edit_all'],
    'member:delete': ['members.disable'],
    'finance:view': ['ledger.view', 'ledger.view_all'],
    'finance:create': ['ledger.create'],
    'finance:edit': ['ledger.edit'],
    'transaction:view': ['ledger.view', 'ledger.view_all'],
    'transaction:create': ['ledger.create'],
    'payment:view': ['payments.view', 'payments.view_all'],
    'payment:create': ['payments.manual_create'],
    'report:view': ['reports.generate'],
    'report:financial': ['reports.financial_summary'],
    'settings:view': ['settings.view'],
    'settings:edit': ['settings.edit'],
    'user:view': ['members.view', 'members.view_all'],
    'user:create': ['members.create'],
    'user:edit': ['members.edit', 'members.edit_all'],
    'audit:view': ['audit.view']
  };

  /**
   * Map legacy permission to new permission keys
   */
  static mapLegacyPermission(legacyPermission: string): string[] {
    return this.LEGACY_MAPPING[legacyPermission] || [legacyPermission];
  }

  /**
   * Check legacy permission using new system
   */
  static async checkLegacyPermission(
    context: RBACContext,
    legacyPermission: string
  ): Promise<boolean> {
    const newPermissions = this.mapLegacyPermission(legacyPermission);
    return await RBACService.hasAnyPermission(context, newPermissions);
  }
}