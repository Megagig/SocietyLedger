import { client } from '../client';
import { unwrap } from '../envelope';
import type { LoginResponseDTO, MeResponseDTO, SessionsResponseDTO } from '@/types/api/auth';

export type LoginPayload = { email: string; password: string };
export type VerifyEmailPayload = { email: string; code: string };
export type ResendVerificationPayload = { email: string };
export type ForgotPasswordPayload = { email: string };
export type ResetPasswordPayload = { token: string; password: string };
export type LogoutPayload = { refreshToken?: string };
export type ChangePasswordPayload = { currentPassword: string; newPassword: string };

export const authApi = {
  /** GET /auth/me — verified against auth.controller.ts (2026-10-19, types/api/auth.ts). */
  async getMe(): Promise<MeResponseDTO> {
    return unwrap<MeResponseDTO>(client.get('/auth/me'));
  },

  /** POST /auth/login — verified against auth.controller.ts login (2026-10-20). `client.ts` already
   * sends `X-Client: mobile` on every request, so `refreshToken`/`accessTokenExpiresAt` are always
   * present here (never the web-only 7-day-token-only shape). */
  async login(payload: LoginPayload): Promise<LoginResponseDTO> {
    return unwrap<LoginResponseDTO>(client.post('/auth/login', payload));
  },

  /** POST /auth/verify-email — verified against auth.controller.ts verifyEmail (2026-10-20). No
   * `data` on success, just `{success, message}` — nothing for the caller to read back. */
  async verifyEmail(payload: VerifyEmailPayload): Promise<void> {
    await unwrap<undefined>(client.post('/auth/verify-email', payload));
  },

  /** POST /auth/resend-verification — verified against auth.controller.ts resendVerificationCode
   * (2026-10-20). Always `200 {success:true}`, even for an unknown email (no account enumeration). */
  async resendVerification(payload: ResendVerificationPayload): Promise<void> {
    await unwrap<undefined>(client.post('/auth/resend-verification', payload));
  },

  /** POST /auth/forgot-password — verified against auth.controller.ts forgotPassword (2026-10-20).
   * Always `200 {success:true}`, even for an unknown email (no account enumeration). */
  async forgotPassword(payload: ForgotPasswordPayload): Promise<void> {
    await unwrap<undefined>(client.post('/auth/forgot-password', payload));
  },

  /** POST /auth/reset-password — verified against auth.controller.ts resetPassword (2026-10-20).
   * `associationId` scoping is optional server-side (auth.service.ts's `resetPassword`) — works
   * without a resolved tenant, though the screen resolves one anyway for a smoother post-reset
   * Login. */
  async resetPassword(payload: ResetPasswordPayload): Promise<void> {
    await unwrap<undefined>(client.post('/auth/reset-password', payload));
  },

  /** POST /auth/logout — verified against auth.controller.ts logout (2026-10-20). Public (no auth
   * middleware) and best-effort server-side — `features/session/mutations.ts`'s `useLogout()`
   * wipes local state regardless of whether this call succeeds. */
  async logout(payload: LogoutPayload): Promise<void> {
    await unwrap<undefined>(client.post('/auth/logout', payload));
  },

  /** GET /auth/sessions — verified against auth.ts types (2026-10-19). Lists active refresh-token
   * families; no X-Tenant needed (auth namespace). */
  async getSessions(): Promise<SessionsResponseDTO> {
    return unwrap<SessionsResponseDTO>(client.get('/auth/sessions'));
  },

  /** DELETE /auth/sessions/:familyId — revoke one session by its family id. */
  async revokeSession(familyId: string): Promise<void> {
    await unwrap<undefined>(client.delete(`/auth/sessions/${familyId}`));
  },

  /** POST /auth/change-password — requires current password for re-auth. */
  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await unwrap<undefined>(client.post('/auth/change-password', payload));
  },
};
