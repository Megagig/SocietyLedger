import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAjoNav } from '../useAjoNav';

/**
 * A standalone thrift group has no association home to show, so its Home and Money screens send the person straight into Ajo: the
 * circle list for an officer, today's collection for a collector who is nothing else, and "My thrift" for everyone else. Renders
 * nothing, and does nothing for an ordinary association.
 */
export function ThriftHomeRedirect() {
  const router = useRouter();
  const nav = useAjoNav();

  useEffect(() => {
    if (!nav.thriftOnly) return;
    router.replace((nav.staff ? '/(app)/(tabs)/manage/thrift' : nav.collect && !nav.member ? '/(app)/(tabs)/manage/thrift/today' : '/(app)/(tabs)/money/thrift') as never);
  }, [nav.thriftOnly, nav.staff, nav.collect, nav.member, router]);

  return null;
}
