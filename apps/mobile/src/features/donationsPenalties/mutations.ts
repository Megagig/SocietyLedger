import { useMutation, useQueryClient } from '@tanstack/react-query';

import { donationsPenaltiesApi } from '@/api/endpoints/donationsPenalties';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { AllocationPayload, PenaltyRulePayload, RecordDonationPayload, WaivePayload } from '@/types/api/donationsPenalties';

/**
 * A donation, a late fee or a waiver changes what a member owes or has given, so besides the donation and penalty lists the overview,
 * members, ledgers, dashboard and cash caches are refreshed.
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

export function useRecordDonation() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: RecordDonationPayload) => donationsPenaltiesApi.recordDonation(payload), onSuccess: invalidate });
}

export function useCreateAllocation() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: AllocationPayload) => donationsPenaltiesApi.createAllocation(payload), onSuccess: invalidate });
}

export function useUpdateAllocation(id: number) {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: Partial<AllocationPayload>) => donationsPenaltiesApi.updateAllocation(id, payload), onSuccess: invalidate });
}

export function useCreateRule() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: PenaltyRulePayload) => donationsPenaltiesApi.createRule(payload), onSuccess: invalidate });
}

export function useUpdateRule(id: number) {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: Partial<PenaltyRulePayload>) => donationsPenaltiesApi.updateRule(id, payload), onSuccess: invalidate });
}

export function useDeleteRule() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (id: number) => donationsPenaltiesApi.deleteRule(id), onSuccess: invalidate });
}

export function useApplyLateFees() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: () => donationsPenaltiesApi.applyLateFees(), onSuccess: invalidate });
}

export function useWaivePenalty(transactionId: number) {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: WaivePayload) => donationsPenaltiesApi.waivePenalty(transactionId, payload), onSuccess: invalidate });
}
