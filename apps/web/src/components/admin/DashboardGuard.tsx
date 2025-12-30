'use client';

import { useAuthStore } from '@/store/authStore';
import { useSuperAdminContext } from '@/hooks/useSuperAdminContext';
import { SuperAdminDashboardGuard } from './SuperAdminDashboardGuard';

interface DashboardGuardProps {
  children: React.ReactNode;
}

/**
 * Client-side guard for dashboard routes.
 * Checks if Super Admin has selected an association context.
 * If not, shows the association selector.
 */
export function DashboardGuard({ children }: DashboardGuardProps) {
  const { user } = useAuthStore();
  const { selectedAssociation } = useSuperAdminContext();

  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN';
  const hasContext = !!user?.associationId || !!selectedAssociation;

  // For Super Admins without association context, show the selector
  if (isSuperAdmin && !hasContext) {
    return <SuperAdminDashboardGuard>{null}</SuperAdminDashboardGuard>;
  }

  // For regular users or Super Admins with context, render children
  return <>{children}</>;
}

export default DashboardGuard;
