import { client } from '../client';
import { unwrap } from '../envelope';
import type { CheckSubdomainResponseDTO } from '@/types/api/associations';

export const associationsApi = {
  /** GET /associations/check-subdomain?subdomain= — verified against associations.controller.ts checkSubdomain (2026-10-20). */
  async checkSubdomain(subdomain: string): Promise<CheckSubdomainResponseDTO> {
    return unwrap<CheckSubdomainResponseDTO>(client.get('/associations/check-subdomain', { params: { subdomain } }));
  },
};
