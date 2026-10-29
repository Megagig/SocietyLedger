import { client } from '../client';
import { unwrap } from '../envelope';
import type { CheckSubdomainResponseDTO, SignupPayload, SignupResponseDTO } from '@/types/api/associations';

export const associationsApi = {
  /** POST /associations/signup — public (no tenant yet). 409 SUBDOMAIN_TAKEN / SUBDOMAIN_RESERVED, 403 SIGNUPS_CLOSED. */
  async signup(payload: SignupPayload): Promise<SignupResponseDTO> {
    return unwrap<SignupResponseDTO>(client.post('/associations/signup', payload));
  },

  /** POST /associations/thrift-signup — public. A standalone thrift group (Ajo only). 403 THRIFT_SIGNUP_CLOSED until platform staff open it; otherwise the same errors as signup. */
  async thriftSignup(payload: SignupPayload): Promise<SignupResponseDTO> {
    return unwrap<SignupResponseDTO>(client.post('/associations/thrift-signup', payload));
  },

  /** GET /associations/check-subdomain?subdomain= — verified against associations.controller.ts checkSubdomain (2026-10-20). */
  async checkSubdomain(subdomain: string): Promise<CheckSubdomainResponseDTO> {
    return unwrap<CheckSubdomainResponseDTO>(client.get('/associations/check-subdomain', { params: { subdomain } }));
  },
};
