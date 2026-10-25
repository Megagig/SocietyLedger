import { client } from '../client';
import { unwrap } from '../envelope';
import type { MemberSelfDTO } from '@/types/api/members';

export type UpdateProfilePayload = {
  firstName?: string;
  lastName?: string;
  phone?: string;
};

/** `/members/me` — no `X-Tenant` needed (api-contract.md §3 / §4). */
export const membersApi = {
  /** GET /members/me — full self-service member row (types/api/members.ts). */
  async getProfile(): Promise<MemberSelfDTO> {
    return unwrap<MemberSelfDTO>(client.get('/members/me'));
  },

  /** PATCH /members/me — updates firstName, lastName, phone. Returns updated row. */
  async updateProfile(payload: UpdateProfilePayload): Promise<MemberSelfDTO> {
    return unwrap<MemberSelfDTO>(client.patch('/members/me', payload));
  },
};
