'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAjoNav } from '@/lib/ajo/useAjoNav';

/**
 * A standalone thrift group has no association home to show, so its dashboard home sends the person straight into Ajo: the group list for
 * an officer, "My thrift" for everyone else. Renders nothing, and does nothing for an ordinary association.
 */
export function ThriftHomeRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const nav = useAjoNav();
  const atHome = pathname === '/dashboard' || pathname === '/dashboard/member';

  useEffect(() => {
    if (!atHome || !nav.thriftOnly) return;
    router.replace(nav.staff ? '/dashboard/ajo' : nav.collect && !nav.member ? '/dashboard/ajo/collect' : '/dashboard/my-thrift');
  }, [atHome, nav.thriftOnly, nav.staff, nav.collect, nav.member, router]);

  return null;
}
