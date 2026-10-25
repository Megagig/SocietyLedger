import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cashApi } from '@/api/endpoints/cash';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { CashLodgmentDecisionPayload, CreateCashCollectionPayload, RecordCashReceiptPayload, RecordLodgmentPayload } from '@/types/api/cash';
import { cashKeys } from './queries';

/**
 * Cash changes the collections and lodgments, and — when a receipt is recorded or voided — the member's balances, ledger and
 * the finance, cooperative and welfare figures, so those caches are refreshed too.
 */
function useInvalidateCash() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return (alsoMemberMoney = false) => {
    void queryClient.invalidateQueries({ queryKey: cashKeys.all(tenant) });
    if (alsoMemberMoney) {
      for (const root of ['members', 'memberFinance', 'memberLedger', 'cooperatives', 'welfare', 'dashboard']) {
        void queryClient.invalidateQueries({ queryKey: [tenant, root] });
      }
    }
  };
}

export function useCreateCashCollection() {
  const invalidate = useInvalidateCash();
  return useMutation({ mutationFn: (payload: CreateCashCollectionPayload) => cashApi.createCollection(payload), onSuccess: () => invalidate() });
}

export function useCloseCashCollection(id: number) {
  const invalidate = useInvalidateCash();
  return useMutation({ mutationFn: () => cashApi.closeCollection(id), onSuccess: () => invalidate() });
}

/** Record one member's receipt. Retrying with the same `idempotencyKey` never credits twice. */
export function useRecordCashReceipt(collectionId: number) {
  const invalidate = useInvalidateCash();
  return useMutation({
    mutationFn: (payload: RecordCashReceiptPayload) => cashApi.recordReceipt(collectionId, payload),
    // A partly saved receipt (409) still changed balances, so refresh on failure as well.
    onSettled: () => invalidate(true),
  });
}

export function useVoidCashReceipt() {
  const invalidate = useInvalidateCash();
  return useMutation({ mutationFn: ({ id, reason }: { id: number; reason: string }) => cashApi.voidReceipt(id, reason), onSettled: () => invalidate(true) });
}

export function useRecordLodgment() {
  const invalidate = useInvalidateCash();
  return useMutation({ mutationFn: (payload: RecordLodgmentPayload) => cashApi.recordLodgment(payload), onSuccess: () => invalidate() });
}

/** Verify or reject one lodgment — final. */
export function useDecideLodgment(id: number) {
  const invalidate = useInvalidateCash();
  return useMutation({ mutationFn: (payload: CashLodgmentDecisionPayload) => cashApi.decideLodgment(id, payload), onSuccess: () => invalidate() });
}
