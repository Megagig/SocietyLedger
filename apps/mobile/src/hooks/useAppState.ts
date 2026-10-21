import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Reactive wrapper over RN's core `AppState` (architecture.md's hooks list) — used for the
 * app-lock timer (architecture.md §7.5) and query refetch-on-foreground (F1.7).
 */
export function useAppState(): AppStateStatus {
  // RN's generated types loosely type `currentState` as a plain `string | null | undefined`
  // (not narrowed to `AppStateStatus`) — cast at this one boundary.
  const [appState, setAppState] = useState<AppStateStatus>((AppState.currentState as AppStateStatus) ?? 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  return appState;
}
