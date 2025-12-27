import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';

export const metadata = {
  title: 'Super Admin | SocietyLedger',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
