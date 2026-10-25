import { useQuery } from '@tanstack/react-query';

import { aiApi } from '@/api/endpoints/ai';
import { useCan } from '@/hooks/useCan';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import { AI_MODULE, AI_VIEW_ACCESS } from './labels';

export const aiKeys = {
  all: (tenant: string) => [tenant, 'ai'] as const,
  credits: (tenant: string) => [...aiKeys.all(tenant), 'credits'] as const,
};

/** Whether this officer may use the assistant at all: the finance permission, and the module on for the plan. */
export function useAiAccess(): boolean {
  const permitted = useCan(AI_VIEW_ACCESS);
  const off = useModuleDisabled(AI_MODULE);
  return permitted && !off;
}

/** What is left today and in credits, the price, and the last purchases. */
export function useAiCredits() {
  const tenant = useTenantKey();
  const enabled = useAiAccess();
  return useQuery({ queryKey: aiKeys.credits(tenant), queryFn: () => aiApi.getCredits(), enabled });
}
