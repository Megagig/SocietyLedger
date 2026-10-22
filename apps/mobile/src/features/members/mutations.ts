import { useMutation, useQueryClient } from '@tanstack/react-query';

import { membersManageApi } from '@/api/endpoints/membersManage';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { MemberFormPayload } from '@/types/api/membersManage';
import { approvalKeys, inviteKeys, membersKeys } from './queries';

/** Anything that changes a member also changes the directory, its counts and the invitable list (login status, email). */
function useInvalidateMembers() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    queryClient.invalidateQueries({ queryKey: membersKeys.all(tenant) });
    queryClient.invalidateQueries({ queryKey: inviteKeys.all(tenant) });
  };
}

export function useCreateMember() {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: (payload: MemberFormPayload) => membersManageApi.createMember(payload), onSuccess: invalidate });
}

export function useUpdateMember(id: number) {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: (payload: Partial<MemberFormPayload>) => membersManageApi.updateMember(id, payload), onSuccess: invalidate });
}

/** Disable = status `terminated` (their login stops working). Fails while they have unpaid or overdue charges. */
export function useDisableMember(id: number) {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: () => membersManageApi.disableMember(id), onSuccess: invalidate });
}

/** Re-enable = status back to active, which also restores their login. */
export function useEnableMember(id: number) {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: () => membersManageApi.updateMember(id, { status: 'active' }), onSuccess: invalidate });
}

export function useBulkInvite() {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: (memberIds: number[]) => membersManageApi.bulkInvite(memberIds), onSuccess: invalidate });
}

export function useResendInvite() {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: (inviteId: number) => membersManageApi.resendInvite(inviteId), onSuccess: invalidate });
}

export function useRevokeInvite() {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: (inviteId: number) => membersManageApi.revokeInvite(inviteId), onSuccess: invalidate });
}

/** Approve or reject a self-registration; the directory changes too (an approved member can now sign in). */
export function useDecideApproval() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ userId, status, rejectionReason }: { userId: number; status: 'approved' | 'rejected'; rejectionReason?: string }) =>
      membersManageApi.decideApproval(userId, { status, rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all(tenant) });
      invalidate();
    },
  });
}
