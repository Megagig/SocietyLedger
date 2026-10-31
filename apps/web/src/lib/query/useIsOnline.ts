import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const isOnline = () => onlineManager.isOnline();

/** Is the browser online right now? Follows the browser's online/offline events through TanStack's online manager. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
