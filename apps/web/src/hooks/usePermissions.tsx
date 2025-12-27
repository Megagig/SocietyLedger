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

  let hasAccess = true;

  // Check single permission
  if (permission) {
    hasAccess = hasPermission(user.role, permission);
  }

  // Check if user has ANY of the permissions
  if (anyPermissions && anyPermissions.length > 0) {
    hasAccess = hasAnyPermission(user.role, anyPermissions);
  }

  // Check if user has ALL of the permissions
  if (allPermissions && allPermissions.length > 0) {
    hasAccess = hasAllPermissions(user.role, allPermissions);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Hook to check permissions
 * Usage:
 * const { can, canAny, canAll } = usePermissions();
 * if (can(PERMISSIONS.MEMBER_CREATE)) { ... }
 */
export function usePermissions() {
  const { user } = useAuthStore();

  const can = (permission: Permission): boolean => {
    if (!user) return false;
    return hasPermission(user.role, permission);
  };

  const canAny = (permissions: Permission[]): boolean => {
    if (!user) return false;
    return hasAnyPermission(user.role, permissions);
  };

  const canAll = (permissions: Permission[]): boolean => {
    if (!user) return false;
    return hasAllPermissions(user.role, permissions);
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
  };
}
