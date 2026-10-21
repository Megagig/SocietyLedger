import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { welfareApi } from '@/api/endpoints/welfare';
import type { CreatePayoutRequestPayload } from '@/types/api/welfare';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { WELFARE_VIEW_ACCESS } from '@/lib/permissions';
import { useTenantKey } from '@/hooks/useTenantKey';
import { useSessionStore } from '@/stores/session';

export const welfareKeys = {
  all: (tenant: string) => [tenant, 'welfare'] as const,
  profile: (tenant: string) => [...welfareKeys.all(tenant), 'profile'] as const,
  funds: (tenant: string) => [...welfareKeys.all(tenant), 'funds'] as const,
};

export function useWelfareProfile() {
  const tenant = useTenantKey();
  const canView = useModuleAccess(WELFARE_VIEW_ACCESS, 'welfare');
  const memberId = useSessionStore((s) => s.user?.member?.id);

  return useQuery({
    queryKey: welfareKeys.profile(tenant),
    queryFn: welfareApi.getMyProfile,
    // /welfare/my-profile is keyed on the caller's member record — 400s for an account without one.
    enabled: canView && memberId !== undefined,
  });
}

export function useWelfareFunds() {
  const tenant = useTenantKey();
  const canView = useModuleAccess(WELFARE_VIEW_ACCESS, 'welfare');

  return useQuery({
    queryKey: welfareKeys.funds(tenant),
    queryFn: () => welfareApi.listFunds('ACTIVE'),
    enabled: canView,
  });
}

export type WelfareListFilters = { fundId?: number; status?: string; payoutType?: string };

/** The caller's own contributions — always scoped by the session's member id (the API doesn't scope them itself). */
export function useMyContributions(filters: WelfareListFilters) {
  const tenant = useTenantKey();
  const canView = useModuleAccess(WELFARE_VIEW_ACCESS, 'welfare');
  const memberId = useSessionStore((s) => s.user?.member?.id);

  return useInfiniteQuery({
    queryKey: [...welfareKeys.all(tenant), 'contributions', memberId, filters] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      welfareApi.listContributions({ page: pageParam, limit: 20, memberId, fundId: filters.fundId, status: filters.status }),
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled: canView && memberId !== undefined,
  });
}

/** The caller's own payout requests — same member-id scoping as `useMyContributions`. */
export function useMyPayoutRequests(filters: WelfareListFilters) {
  const tenant = useTenantKey();
  const canView = useModuleAccess(WELFARE_VIEW_ACCESS, 'welfare');
  const memberId = useSessionStore((s) => s.user?.member?.id);

  return useInfiniteQuery({
    queryKey: [...welfareKeys.all(tenant), 'payouts', memberId, filters] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      welfareApi.listPayoutRequests({
        page: pageParam,
        limit: 20,
        memberId,
        fundId: filters.fundId,
        status: filters.status,
        payoutType: filters.payoutType,
      }),
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled: canView && memberId !== undefined,
  });
}

export function useCreatePayoutRequest() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (payload: CreatePayoutRequestPayload) => welfareApi.createPayoutRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: welfareKeys.all(tenant) });
    },
  });
}
