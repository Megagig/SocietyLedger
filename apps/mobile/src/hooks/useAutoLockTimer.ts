import { useEffect, useRef } from 'react';

import { useAppLockStore } from '@/stores/appLock';
import { usePrefsStore } from '@/stores/prefs';
import { useAppState } from './useAppState';

/**
 * architecture.md §7.5 — "Lock on cold start and after `autoLockMinutes` in background." Cold
 * start is free (`stores/appLock.ts`'s `isLocked` already starts `true` on every new JS process)
 * — this hook covers the second half: timing how long the app spent backgrounded and re-locking
 * if it exceeds the configured timeout. Mounted only in `(app)/_layout.tsx`, so it's only ever
 * running while the user is actually authenticated.
 */
export function useAutoLockTimer(): void {
  const appState = useAppState();
  const biometricsEnabled = usePrefsStore((state) => state.biometricsEnabled);
  const autoLockMinutes = usePrefsStore((state) => state.autoLockMinutes);
  const lock = useAppLockStore((state) => state.lock);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!biometricsEnabled) return;

    if (appState === 'active') {
      if (backgroundedAt.current !== null) {
        const elapsedMs = Date.now() - backgroundedAt.current;
        if (elapsedMs >= autoLockMinutes * 60_000) lock();
        backgroundedAt.current = null;
      }
      return;
    }

    backgroundedAt.current ??= Date.now();
  }, [appState, biometricsEnabled, autoLockMinutes, lock]);
}
