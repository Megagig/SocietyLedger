import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reconciliationApi } from '@/api/endpoints/reconciliation';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { MatchRequest, StatementUploadPayload } from '@/types/api/reconciliation';
import { reconKeys } from './queries';

/** A statement, a match or a decision moves the suggestions, the lines, the matches and the badges. One refresh covers them. Money
 * recorded on confirming also moves the finance screens, the reports and Home. */
function useRefresh() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return (recordedMoney = false) => {
    void queryClient.invalidateQueries({ queryKey: reconKeys.all(tenant) });
    if (recordedMoney) {
      for (const root of ['finance', 'reports', 'dashboard', 'ledger', 'payment-proofs']) void queryClient.invalidateQueries({ queryKey: [tenant, root] });
    }
  };
}

export function usePreviewStatement() {
  return useMutation({ mutationFn: (payload: StatementUploadPayload) => reconciliationApi.previewStatement(payload) });
}

export function useImportStatement() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (payload: StatementUploadPayload) => reconciliationApi.importStatement(payload), onSuccess: () => refresh() });
}

export function useApplyMatches() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (matches: MatchRequest[]) => reconciliationApi.applyMatches(matches), onSettled: () => refresh() });
}

export function useProposeMatch() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (match: MatchRequest) => reconciliationApi.proposeMatch(match), onSuccess: () => refresh() });
}

export function useDecideMatch() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: 'CONFIRMED' | 'DISPUTED'; notes?: string }) => reconciliationApi.decideMatch(id, status, notes),
    onSettled: (_data, _error, vars) => refresh(vars.status === 'CONFIRMED'),
  });
}
