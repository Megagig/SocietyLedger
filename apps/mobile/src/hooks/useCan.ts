import { useMemo } from 'react';

import { can, canAny, type PermissionAlias } from '@/lib/permissions';
import { useSessionStore } from '@/stores/session';

// A stable fallback reference — `state.user?.permissions ?? []` would otherwise allocate a new
// array every call when `user` is null, breaking useSyncExternalStore's referential-stability
// requirement and causing "Maximum update depth exceeded" (found while writing this hook's own test).
const EMPTY_PERMISSIONS: string[] = [];

/**
 * architecture.md §7.4 — "the only way to components check permissions" (never
 * `user.role === '…'`, code-standards.md/architecture rule #8). A single alias checks `can()`;
 * an array checks `canAny()` (any-of, matching every "Perm" column in project-overview.md §6
 * being written as a list).
 */
export function useCan(alias: PermissionAlias | PermissionAlias[]): boolean {
  // F1.7 expanded the store to the real session shape (`user.permissions`, not a bare top-level
  // `permissions`) — only this internal selector changed; useCan's own signature is unchanged.
  const permissions = useSessionStore((state) => state.user?.permissions ?? EMPTY_PERMISSIONS);

  return useMemo(() => {
    return Array.isArray(alias) ? canAny(permissions, alias) : can(permissions, alias);
  }, [permissions, alias]);
}
