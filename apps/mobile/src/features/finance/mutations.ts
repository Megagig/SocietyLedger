import { useMutation, useQueryClient } from '@tanstack/react-query';

import { financeManageApi } from '@/api/endpoints/financeManage';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { BulkChargePayload, CreateChargePayload, EditChargePayload, RecordPaymentPayload, VoidReplacePayload } from '@/types/api/financeManage';

/**
 * A change to a charge or a payment moves the overview, the lists and — because balances and ledgers follow — the member's own
 * money screens, the member lists, the cash payables and the dashboard, so those caches are refreshed too.
 */
function useInvalidateFinance() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    for (const root of ['finance', 'members', 'memberFinance', 'memberLedger', 'dashboard', 'cash']) {
      void queryClient.invalidateQueries({ queryKey: [tenant, root] });
    }
  };
}

export function useCreateCharge() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: CreateChargePayload) => financeManageApi.createCharge(payload), onSuccess: invalidate });
}

export function useCreateBulkCharges() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: BulkChargePayload) => financeManageApi.createBulk(payload), onSuccess: invalidate });
}

export function useEditCharge(id: number) {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: EditChargePayload) => financeManageApi.editCharge(id, payload), onSuccess: invalidate });
}

export function useVoidAndReplace(id: number) {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: VoidReplacePayload) => financeManageApi.voidAndReplace(id, payload), onSuccess: invalidate });
}

export function useDeleteCharge() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (id: number) => financeManageApi.deleteCharge(id), onSuccess: invalidate });
}

export function useUndoDeleteCharge() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (auditLogId: number) => financeManageApi.undoDelete(auditLogId), onSuccess: invalidate });
}

export function useRecordPayment() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: RecordPaymentPayload) => financeManageApi.recordPayment(payload), onSuccess: invalidate });
}
