import { useMutation, useQueryClient } from '@tanstack/react-query';

import { rbacApi } from '@/api/endpoints/rbac';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { RolePayload, RoleUpdatePayload } from '@/types/api/rbac';
import { rbacKeys } from './queries';

/** A role change moves the role list, the people's role chips and the activity log, so the whole group is read again. */
function useInvalidateRbac() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    void queryClient.invalidateQueries({ queryKey: rbacKeys.all(tenant) });
  };
}

export function useCreateRole() {
  const invalidate = useInvalidateRbac();
  return useMutation({ mutationFn: (payload: RolePayload) => rbacApi.createRole(payload), onSuccess: invalidate });
}

export function useUpdateRole(id: number) {
  const invalidate = useInvalidateRbac();
  return useMutation({ mutationFn: (payload: RoleUpdatePayload) => rbacApi.updateRole(id, payload), onSuccess: invalidate });
}

export function useDeleteRole(id: number) {
  const invalidate = useInvalidateRbac();
  return useMutation({ mutationFn: () => rbacApi.deleteRole(id), onSuccess: invalidate });
}

export function useAssignRole() {
  const invalidate = useInvalidateRbac();
  return useMutation({ mutationFn: (payload: { userId: number; roleId: number }) => rbacApi.assignRole(payload), onSettled: invalidate });
}

export function useRemoveRole() {
  const invalidate = useInvalidateRbac();
  return useMutation({ mutationFn: (payload: { userId: number; roleId: number }) => rbacApi.removeRole(payload), onSettled: invalidate });
}
