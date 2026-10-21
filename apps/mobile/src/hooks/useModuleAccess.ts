import { useCan } from '@/hooks/useCan';
import type { PermissionAlias } from '@/lib/permissions';
import { useModulesStore } from '@/stores/modules';

/** True once the API has answered `MODULE_DISABLED` for this module this session (architecture.md §5/§6.3). */
export function useModuleDisabled(moduleCode: string): boolean {
  return useModulesStore((state) => state.disabled.has(moduleCode));
}

/**
 * Permission AND module entitlement — what a list/detail query's `enabled` should use, so a
 * module the tenant's plan doesn't include is requested at most once instead of 403-looping.
 */
export function useModuleAccess(alias: PermissionAlias | PermissionAlias[], moduleCode: string): boolean {
  const permitted = useCan(alias);
  const disabled = useModuleDisabled(moduleCode);
  return permitted && !disabled;
}
