import { DashboardGuard } from '@/components/admin/DashboardGuard';

export default function MemberDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardGuard>{children}</DashboardGuard>;
}
