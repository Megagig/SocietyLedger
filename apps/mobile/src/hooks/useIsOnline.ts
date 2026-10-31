import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const isOnline = () => onlineManager.isOnline();

/** Is the phone online right now? Follows NetInfo, which `providers/QueryProvider.tsx` wires into TanStack's online manager. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
