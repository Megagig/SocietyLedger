import { useMutation } from '@tanstack/react-query';

import { associationsApi } from '@/api/endpoints/associations';
import type { SignupPayload, SignupResponseDTO } from '@/types/api/associations';
import type { TenantSummary } from '@/stores/tenant';

/** `tenant` is null only when the association was created but looking it up straight afterwards failed. */
export type CreatedAssociation = { signup: SignupResponseDTO; tenant: TenantSummary | null };

/**
 * A13 — creates the association, then looks it up by its address so the phone can adopt it as the current tenant (the next screens,
 * verify-email and sign-in, send `X-Tenant` with it). The lookup is a safety net: if it fails the association still exists, so the
 * signup is not reported as failed; the caller sends the person to the association-code screen instead.
 */
export function useCreateAssociation() {
  return useMutation({
    mutationFn: async (payload: SignupPayload): Promise<CreatedAssociation> => {
      const signup = await associationsApi.signup(payload);
      const tenant = await associationsApi.checkSubdomain(signup.association.subdomain).catch(() => null);
      return { signup, tenant };
    },
  });
}
