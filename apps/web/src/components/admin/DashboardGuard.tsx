'use client';

interface DashboardGuardProps {
  children: React.ReactNode;
}

export function DashboardGuard({ children }: DashboardGuardProps) {
  return <>{children}</>;
}

export default DashboardGuard;
