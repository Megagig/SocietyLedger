import { client } from '../client';
import { unwrap } from '../envelope';
import type { CheckSubdomainResponseDTO, SignupPayload, SignupResponseDTO } from '@/types/api/associations';

export const associationsApi = {
  /** POST /associations/signup — public (no tenant yet). 409 SUBDOMAIN_TAKEN / SUBDOMAIN_RESERVED, 403 SIGNUPS_CLOSED. */
  async signup(payload: SignupPayload): Promise<SignupResponseDTO> {
    return unwrap<SignupResponseDTO>(client.post('/associations/signup', payload));
  },

  /** GET /associations/check-subdomain?subdomain= — verified against associations.controller.ts checkSubdomain (2026-10-20). */
  async checkSubdomain(subdomain: string): Promise<CheckSubdomainResponseDTO> {
    return unwrap<CheckSubdomainResponseDTO>(client.get('/associations/check-subdomain', { params: { subdomain } }));
  },
};
