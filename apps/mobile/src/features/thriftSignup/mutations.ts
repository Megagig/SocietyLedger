import { useMutation } from '@tanstack/react-query';

import { associationsApi } from '@/api/endpoints/associations';
import type { SignupPayload, SignupResponseDTO } from '@/types/api/associations';
import type { TenantSummary } from '@/stores/tenant';

export type CreatedThriftGroup = { signup: SignupResponseDTO; tenant: TenantSummary | null };

/**
 * Creates the standalone thrift group, then looks it up by its address so the phone can adopt it as the current tenant (the next
 * screens, verify-email and sign-in, send `X-Tenant` with it). The lookup is a safety net: if it fails the group still exists.
 */
export function useCreateThriftGroup() {
  return useMutation({
    mutationFn: async (payload: SignupPayload): Promise<CreatedThriftGroup> => {
      const signup = await associationsApi.thriftSignup(payload);
      const tenant = await associationsApi.checkSubdomain(signup.association.subdomain).catch(() => null);
      return { signup, tenant };
    },
  });
}
