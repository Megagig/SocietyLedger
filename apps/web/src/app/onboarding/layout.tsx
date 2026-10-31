'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';

/**
 * Keeps each kind of account in its own setup. A standalone thrift group that opens any association onboarding address is sent to
 * its own, and an association that opens the thrift one is sent back. Nothing is shown differently for anyone else.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    api.get(API_ROUTES.ONBOARDING.STATUS).then((res) => {
      if (cancelled) return;
      const flow = res.data?.data?.flow as 'ASSOCIATION' | 'THRIFT' | undefined;
      const onThriftPages = pathname.startsWith('/onboarding/thrift');
      if (flow === 'THRIFT' && !onThriftPages) router.replace('/onboarding/thrift');
      if (flow === 'ASSOCIATION' && onThriftPages) router.replace('/onboarding');
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [pathname, isAuthenticated, router]);

  return <>{children}</>;
}
