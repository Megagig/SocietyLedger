import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ledgerManageApi } from '@/api/endpoints/ledgerManage';
import { useTenantKey } from '@/hooks/useTenantKey';
import { ledgerKeys } from './queries';

/** Rebuild one member's ledger from their charges and payments, then refresh what shows it. */
export function useResyncLedger(memberId: number) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: (force: boolean) => ledgerManageApi.resync(memberId, force),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ledgerKeys.all(tenant) });
      void queryClient.invalidateQueries({ queryKey: [tenant, 'memberLedger'] });
    },
  });
}
