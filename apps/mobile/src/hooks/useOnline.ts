import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * ui-rules.md §5.11 / code-standards.md §8 — mutations disabled while offline, screens show
 * `OfflineBanner`. Starts `true` (optimistic) — `NetInfo.fetch()` resolves almost immediately on
 * a real device, and assuming online avoids a flash of the offline banner on every cold start.
 */
export function useOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    NetInfo.fetch().then((state) => setIsOnline(state.isConnected !== false));
    const unsubscribe = NetInfo.addEventListener((state) => setIsOnline(state.isConnected !== false));
    return unsubscribe;
  }, []);

  return isOnline;
}
