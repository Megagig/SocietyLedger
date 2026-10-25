import { useMutation, useQueryClient } from '@tanstack/react-query';

import { bankManageApi } from '@/api/endpoints/bankManage';
import { paymentProofsManageApi } from '@/api/endpoints/paymentProofsManage';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { BankAccountPayload, RecordTransferPayload, UpdateBankAccountPayload, UpdateTransferPayload } from '@/types/api/bankManage';
import type { ProofDecisionPayload } from '@/types/api/paymentProofsManage';
import { bankKeys, proofKeys } from './queries';

/**
 * Verify or reject one proof. A decision changes the queue, the waiting count and — on approval — the member's balance, ledger
 * and the finance figures, so the member and finance caches are refreshed too.
 */
export function useDecideProof(id: number) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: (payload: ProofDecisionPayload) => paymentProofsManageApi.decideProof(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proofKeys.all(tenant) });
      queryClient.invalidateQueries({ queryKey: [tenant, 'members'] });
      queryClient.invalidateQueries({ queryKey: [tenant, 'memberFinance'] });
    },
  });
}

// ---------------------------------------------------------------- bank transfers and bank accounts (F5.5)


/** A change to a transfer changes the lists and the waiting count. */
function useInvalidateBank() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => queryClient.invalidateQueries({ queryKey: bankKeys.all(tenant) });
}

export function useRecordTransfer() {
  const invalidate = useInvalidateBank();
  return useMutation({ mutationFn: (payload: RecordTransferPayload) => bankManageApi.recordTransfer(payload), onSuccess: invalidate });
}

export function useUpdateTransfer(id: number) {
  const invalidate = useInvalidateBank();
  return useMutation({ mutationFn: (payload: UpdateTransferPayload) => bankManageApi.updateTransfer(id, payload), onSuccess: invalidate });
}

/** Verify or reject one transfer — final, and it records no payment. */
export function useDecideTransfer(id: number) {
  const invalidate = useInvalidateBank();
  return useMutation({ mutationFn: (payload: { status: 'VERIFIED' | 'REJECTED'; notes?: string }) => bankManageApi.decideTransfer(id, payload), onSuccess: invalidate });
}

/** Account changes also refresh what members are shown when they pay (their payment-info query). */
function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    queryClient.invalidateQueries({ queryKey: bankKeys.all(tenant) });
    queryClient.invalidateQueries({ queryKey: [tenant, 'memberFinance'] });
  };
}

export function useCreateBankAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({ mutationFn: (payload: BankAccountPayload) => bankManageApi.createAccount(payload), onSuccess: invalidate });
}

export function useUpdateBankAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({ mutationFn: ({ id, payload }: { id: number; payload: UpdateBankAccountPayload }) => bankManageApi.updateAccount(id, payload), onSuccess: invalidate });
}

export function useRemoveBankAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({ mutationFn: (id: number) => bankManageApi.removeAccount(id), onSuccess: invalidate });
}
