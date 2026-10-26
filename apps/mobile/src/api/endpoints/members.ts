import { client } from '../client';
import { unwrap } from '../envelope';
import type { MemberSelfDTO, MemberPhotoDTO, PhotoFile } from '@/types/api/members';

export type UpdateProfilePayload = {
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export function photoForm(file: PhotoFile): FormData {
  const form = new FormData();
  form.append('photo', { uri: file.uri, name: file.name, type: file.type } as never);
  return form;
}

/** `/members/me` — no `X-Tenant` needed (api-contract.md §3 / §4). */
export const membersApi = {
  /** GET /members/me — full self-service member row (types/api/members.ts). */
  async getProfile(): Promise<MemberSelfDTO> {
    return unwrap<MemberSelfDTO>(client.get('/members/me'));
  },

  /** PUT /members/me/photo (multipart) — sets or replaces the signed-in member's profile photo. */
  async setMyPhoto(file: PhotoFile): Promise<MemberPhotoDTO> {
    return unwrap<MemberPhotoDTO>(client.put('/members/me/photo', photoForm(file), { headers: { 'Content-Type': 'multipart/form-data' } }));
  },

  /** DELETE /members/me/photo — back to initials. */
  async removeMyPhoto(): Promise<MemberPhotoDTO> {
    return unwrap<MemberPhotoDTO>(client.delete('/members/me/photo'));
  },

  /** PATCH /members/me — updates firstName, lastName, phone. Returns updated row. */
  async updateProfile(payload: UpdateProfilePayload): Promise<MemberSelfDTO> {
    return unwrap<MemberSelfDTO>(client.patch('/members/me', payload));
  },
};
