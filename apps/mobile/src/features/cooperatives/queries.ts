import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cooperativesApi } from '@/api/endpoints/cooperatives';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import { COOPERATIVE_SAVINGS_VIEW_ACCESS } from '@/lib/permissions';
import type { SubmitSavingsDepositPayload } from '@/types/api/cooperatives';

export const cooperativesKeys = {
  all: (tenant: string) => [tenant, 'cooperatives'] as const,
  profile: (tenant: string) => [...cooperativesKeys.all(tenant), 'profile'] as const,
  transactions: (tenant: string, accountId?: number) => [...cooperativesKeys.all(tenant), 'savings-transactions', accountId ?? 'all'] as const,
  deposits: (tenant: string, accountId?: number) => [...cooperativesKeys.all(tenant), 'savings-deposits', accountId ?? 'all'] as const,
};

/** Every "my savings" query needs the permission, the module, and a member profile (the endpoints are keyed on it). */
function useSavingsEnabled(): boolean {
  const access = useModuleAccess(COOPERATIVE_SAVINGS_VIEW_ACCESS, 'cooperatives');
  const memberId = useMemberId();
  return access && memberId !== undefined;
}

/** GET /cooperatives/my-profile — accounts with total / held / available. */
export function useCooperativeProfile() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: cooperativesKeys.profile(tenant),
    queryFn: cooperativesApi.getMyProfile,
    enabled: useSavingsEnabled(),
  });
}

export function useSavingsTransactions(accountId?: number) {
  const tenant = useTenantKey();
  const enabled = useSavingsEnabled();
  return useInfiniteQuery({
    queryKey: cooperativesKeys.transactions(tenant, accountId),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => cooperativesApi.listSavingsTransactions({ page: pageParam, limit: 20, savingsAccountId: accountId }),
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useSavingsDeposits(accountId?: number) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: cooperativesKeys.deposits(tenant, accountId),
    queryFn: () => cooperativesApi.listSavingsDeposits({ limit: 50, savingsAccountId: accountId }),
    enabled: useSavingsEnabled(),
  });
}

/** Creates a PENDING deposit request — refreshes the deposits list only; the balance doesn't change until an officer approves. */
export function useSubmitSavingsDeposit() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: (payload: SubmitSavingsDepositPayload) => cooperativesApi.submitSavingsDeposit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...cooperativesKeys.all(tenant), 'savings-deposits'] });
    },
  });
}
