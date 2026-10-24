import { useMutation, useQueryClient } from '@tanstack/react-query';

import { welfareManageApi } from '@/api/endpoints/welfareManage';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { BulkContributionPayload, DisbursePayoutPayload, FundPayload, RecordContributionPayload, ReviewPayoutPayload } from '@/types/api/welfareManage';

/**
 * A decision here moves a fund's balance, so besides the welfare lists the member screens (their welfare standing), the members list and
 * the dashboard (which carries the waiting counts) are refreshed too.
 */
function useInvalidateWelfare() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    for (const root of ['welfare', 'members', 'dashboard']) {
      void queryClient.invalidateQueries({ queryKey: [tenant, root] });
    }
  };
}

export function useCreateFund() {
  const invalidate = useInvalidateWelfare();
  return useMutation({ mutationFn: (payload: FundPayload) => welfareManageApi.createFund(payload), onSuccess: invalidate });
}

export function useUpdateFund(id: number) {
  const invalidate = useInvalidateWelfare();
  return useMutation({ mutationFn: (payload: Partial<FundPayload>) => welfareManageApi.updateFund(id, payload), onSuccess: invalidate });
}

export function useDeleteFund() {
  const invalidate = useInvalidateWelfare();
  return useMutation({ mutationFn: (id: number) => welfareManageApi.deleteFund(id), onSuccess: invalidate });
}

export function useRecordContribution() {
  const invalidate = useInvalidateWelfare();
  return useMutation({ mutationFn: (payload: RecordContributionPayload) => welfareManageApi.recordContribution(payload), onSuccess: invalidate });
}

export function useRecordBulk() {
  const invalidate = useInvalidateWelfare();
  return useMutation({ mutationFn: (payload: BulkContributionPayload) => welfareManageApi.recordBulk(payload), onSuccess: invalidate });
}

export function useConfirmContribution() {
  const invalidate = useInvalidateWelfare();
  return useMutation({
    mutationFn: (v: { id: number; status: 'CONFIRMED' | 'REJECTED'; notes?: string }) => welfareManageApi.confirmContribution(v.id, v.status, v.notes),
    onSuccess: invalidate,
  });
}

export function useReviewPayout(id: number) {
  const invalidate = useInvalidateWelfare();
  return useMutation({ mutationFn: (payload: ReviewPayoutPayload) => welfareManageApi.reviewPayout(id, payload), onSuccess: invalidate });
}

export function useDisbursePayout(id: number) {
  const invalidate = useInvalidateWelfare();
  return useMutation({ mutationFn: (payload: DisbursePayoutPayload) => welfareManageApi.disbursePayout(id, payload), onSuccess: invalidate });
}
