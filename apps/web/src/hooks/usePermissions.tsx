'use client';

import { useAuthStore } from '@/store/authStore';
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/permissions';

interface CanProps {
  permission?: Permission;
  anyPermissions?: Permission[];
  allPermissions?: Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditional rendering based on user permissions
 * 
 * Permissions are fetched from the database via the API and stored in the user object.
 * The database is the SINGLE SOURCE OF TRUTH for permissions.
 * 
 * Usage:
 * <Can permission={PERMISSIONS.MEMBER_CREATE}>
 *   <button>Add Member</button>
 * </Can>
 */
export function Can({ 
  permission, 
  anyPermissions, 
  allPermissions, 
  children, 
  fallback = null 
}: CanProps) {
  const { user } = useAuthStore();

  if (!user) return <>{fallback}</>;

  // Get permissions array from user (fetched from API/database)
  const userPermissions = user.permissions || [];

  // Super admins have all permissions
  if (user.platformRole === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  let hasAccess = true;

  // Check single permission
  if (permission) {
    hasAccess = hasPermission(userPermissions, permission);
  }

  // Check if user has ANY of the permissions
  if (anyPermissions && anyPermissions.length > 0) {
    hasAccess = hasAnyPermission(userPermissions, anyPermissions);
  }

  // Check if user has ALL of the permissions
  if (allPermissions && allPermissions.length > 0) {
    hasAccess = hasAllPermissions(userPermissions, allPermissions);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Hook to check permissions
 * 
 * Permissions are fetched from the database via the API and stored in the user object.
 * The database is the SINGLE SOURCE OF TRUTH for permissions.
 * 
 * Usage:
 * const { can, canAny, canAll } = usePermissions();
 * if (can(PERMISSIONS.MEMBER_CREATE)) { ... }
 */
export function usePermissions() {
  const { user } = useAuthStore();

  // Get permissions array from user (fetched from API/database)
  const userPermissions = user?.permissions || [];

  const can = (permission: Permission): boolean => {
    if (!user) return false;
    // Super admins have all permissions
    if (user.platformRole === 'SUPER_ADMIN') return true;
    return hasPermission(userPermissions, permission);
  };

  const canAny = (permissions: Permission[]): boolean => {
    if (!user) return false;
    // Super admins have all permissions
    if (user.platformRole === 'SUPER_ADMIN') return true;
    return hasAnyPermission(userPermissions, permissions);
  };

  const canAll = (permissions: Permission[]): boolean => {
    if (!user) return false;
    // Super admins have all permissions
    if (user.platformRole === 'SUPER_ADMIN') return true;
    return hasAllPermissions(userPermissions, permissions);
  };

  const isAdmin = (): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.platformRole === 'SUPER_ADMIN';
  };

  const isSuperAdmin = (): boolean => {
    if (!user) return false;
    return user.platformRole === 'SUPER_ADMIN';
  };

  return {
    can,
    canAny,
    canAll,
    isAdmin,
    isSuperAdmin,
    user,
    permissions: userPermissions,
    roles: user?.roles || [],
  };
}
