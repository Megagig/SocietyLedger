import { client } from '../client';
import { unwrap } from '../envelope';
import type { AcceptInviteResponseDTO, SelfRegisterResponseDTO, VerifyInviteResponseDTO } from '@/types/api/memberInvites';

export type SelfRegisterPayload = { email: string; password: string; firstName: string; lastName: string; phone?: string };
export type AcceptInvitePayload = { token: string; password: string };

export const memberInvitesApi = {
  /** GET /member-invites/verify?token= — verified against member-invites.controller.ts verifyToken (2026-10-20). */
  async verifyInvite(token: string): Promise<VerifyInviteResponseDTO> {
    return unwrap<VerifyInviteResponseDTO>(client.get('/member-invites/verify', { params: { token } }));
  },

  /** POST /member-invites/accept — verified against member-invites.controller.ts acceptInvite (2026-10-20). */
  async acceptInvite(payload: AcceptInvitePayload): Promise<AcceptInviteResponseDTO> {
    return unwrap<AcceptInviteResponseDTO>(client.post('/member-invites/accept', payload));
  },

  /** POST /member-invites/self-register — verified against member-invites.controller.ts selfRegister
   * (2026-10-20, F2.1's `SELF_SIGNUP_DISABLED` gate). A5's actual endpoint — not `/auth/register`,
   * which creates a bare `User` with no `Member` at all. */
  async selfRegister(payload: SelfRegisterPayload): Promise<SelfRegisterResponseDTO> {
    return unwrap<SelfRegisterResponseDTO>(client.post('/member-invites/self-register', payload));
  },
};
