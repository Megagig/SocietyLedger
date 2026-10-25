import { useMutation, useQueryClient } from '@tanstack/react-query';

import { coopManageApi } from '@/api/endpoints/coopManage';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { DisbursePayload, LoanProductPayload, OpenAccountPayload, RecordLoanRepaymentPayload, RecordSavingsPayload, ReviewApplicationPayload } from '@/types/api/coopManage';

/**
 * A decision here moves money or balances, so besides the cooperative lists the member screens (their savings and loans), the members
 * list and the dashboard (which carries the waiting counts) are refreshed too.
 */
function useInvalidateCoop() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    for (const root of ['cooperatives', 'members', 'memberFinance', 'dashboard']) {
      void queryClient.invalidateQueries({ queryKey: [tenant, root] });
    }
  };
}

export function useOpenAccount() {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (payload: OpenAccountPayload) => coopManageApi.openAccount(payload), onSuccess: invalidate });
}

export function useRecordSavings() {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (payload: RecordSavingsPayload) => coopManageApi.recordSavings(payload), onSuccess: invalidate });
}

export function useApproveDeposit() {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (id: number) => coopManageApi.approveDeposit(id), onSuccess: invalidate });
}

export function useRejectDeposit() {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (v: { id: number; reason: string }) => coopManageApi.rejectDeposit(v.id, v.reason), onSuccess: invalidate });
}

export function useApproveRepayment() {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (id: number) => coopManageApi.approveRepayment(id), onSuccess: invalidate });
}

export function useRejectRepayment() {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (v: { id: number; reason: string }) => coopManageApi.rejectRepayment(v.id, v.reason), onSuccess: invalidate });
}

export function useCreateProduct() {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (payload: LoanProductPayload) => coopManageApi.createProduct(payload), onSuccess: invalidate });
}

export function useUpdateProduct(id: number) {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (payload: Partial<LoanProductPayload>) => coopManageApi.updateProduct(id, payload), onSuccess: invalidate });
}

export function useReviewApplication(id: number) {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (payload: ReviewApplicationPayload) => coopManageApi.reviewApplication(id, payload), onSuccess: invalidate });
}

export function useDisburseLoan(id: number) {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (payload: DisbursePayload) => coopManageApi.disburse(id, payload), onSuccess: invalidate });
}

export function useRecordRepayment() {
  const invalidate = useInvalidateCoop();
  return useMutation({ mutationFn: (payload: RecordLoanRepaymentPayload) => coopManageApi.recordRepayment(payload), onSuccess: invalidate });
}
