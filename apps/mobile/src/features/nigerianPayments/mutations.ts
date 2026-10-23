import { useMutation, useQueryClient } from '@tanstack/react-query';

import { paymentProofsManageApi } from '@/api/endpoints/paymentProofsManage';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { ProofDecisionPayload } from '@/types/api/paymentProofsManage';
import { proofKeys } from './queries';

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
