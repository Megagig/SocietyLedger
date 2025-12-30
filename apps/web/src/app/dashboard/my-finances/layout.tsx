'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function MyFinancesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // Redirect Super Admins away from member-specific pages
    // Super Admins don't have member records in associations
    if (user?.platformRole === 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // Don't render content for Super Admins
  if (user?.platformRole === 'SUPER_ADMIN') {
    return null;
  }

  return <>{children}</>;
}
