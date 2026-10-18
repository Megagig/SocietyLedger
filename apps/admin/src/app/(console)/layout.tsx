import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/session.server';
import { AdminAppShell } from '@/components/AppShell';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/login');
  return <AdminAppShell>{children}</AdminAppShell>;
}
