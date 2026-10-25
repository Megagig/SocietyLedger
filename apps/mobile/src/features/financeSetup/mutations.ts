import { useMutation, useQueryClient } from '@tanstack/react-query';

import { financeSetupApi } from '@/api/endpoints/financeSetup';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { AssignMembersPayload, CategoryPayload, CreateCampaignPayload, UpdateCampaignPayload } from '@/types/api/financeSetup';

/**
 * Categories feed every charge form, and assigning or removing a levy member creates or voids a charge, so besides the setup lists
 * the overview, members, ledgers, dashboard and cash caches are refreshed.
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

export function useCreateCategory() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: CategoryPayload) => financeSetupApi.createCategory(payload), onSuccess: invalidate });
}

export function useUpdateCategory(id: number) {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: Partial<CategoryPayload>) => financeSetupApi.updateCategory(id, payload), onSuccess: invalidate });
}

export function useCreateCampaign() {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: CreateCampaignPayload) => financeSetupApi.createCampaign(payload), onSuccess: invalidate });
}

export function useUpdateCampaign(id: number) {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: UpdateCampaignPayload) => financeSetupApi.updateCampaign(id, payload), onSuccess: invalidate });
}

export function useAssignMembers(id: number) {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (payload: AssignMembersPayload) => financeSetupApi.assignMembers(id, payload), onSuccess: invalidate });
}

export function useRemoveAssignment(campaignId: number) {
  const invalidate = useInvalidateFinance();
  return useMutation({ mutationFn: (assignmentId: number) => financeSetupApi.removeAssignment(campaignId, assignmentId), onSuccess: invalidate });
}
