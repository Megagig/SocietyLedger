'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Permission, hasAnyPermission } from '@/lib/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: Permission[];
  requireAuth?: boolean;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({
  children,
  requiredPermissions = [],
  requireAuth = true,
  redirectTo = '/auth/login',
  fallback = <div className="flex items-center justify-center min-h-screen">Loading...</div>,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, _hasHydrated } = useAuthStore();

  useEffect(() => {
    // Wait for Zustand's persist middleware to finish rehydrating from
    // localStorage — on a fresh page load, isAuthenticated/isLoading both
    // sit at their pre-hydration defaults (false) for a brief window, which
    // would otherwise trip the "not authenticated" redirect below even for
    // an already-logged-in session.
    if (!_hasHydrated) return;

    // Wait for auth check to complete
    if (isLoading) return;

    // Redirect if authentication is required but user is not authenticated
    if (requireAuth && !isAuthenticated) {
      router.push(redirectTo);
      return;
    }

    // Check permissions if specified
    if (requiredPermissions.length > 0 && user) {
      const hasAccess = hasAnyPermission(user.permissions, requiredPermissions);
      if (!hasAccess) {
        router.push('/dashboard'); // Redirect to dashboard if no access
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, requireAuth, requiredPermissions, router, redirectTo, _hasHydrated]);

  // Show loading state
  if (!_hasHydrated || isLoading) {
    return <>{fallback}</>;
  }

  // Check authentication
  if (requireAuth && !isAuthenticated) {
    return <>{fallback}</>;
  }

  // Check permissions
  if (requiredPermissions.length > 0 && user) {
    const hasAccess = hasAnyPermission(user.permissions, requiredPermissions);
    if (!hasAccess) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
