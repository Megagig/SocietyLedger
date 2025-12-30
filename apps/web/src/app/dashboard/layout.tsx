import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { DashboardGuard } from '@/components/admin/DashboardGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout>
      <DashboardGuard>{children}</DashboardGuard>
    </AuthenticatedLayout>
  );
}
