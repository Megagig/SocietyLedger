/** `modules/member-invites/member-invites.routes.ts` — verified against member-invites.controller.ts (2026-10-20). */
import type { IsoDateString } from './common';

/** GET /member-invites/verify?token= — public, no tenant context needed (no `tenantMiddleware`
 * on this route). `association` is a narrower shape than `CheckSubdomainResponseDTO` — just
 * enough to resolve the full tenant via `associationsApi.checkSubdomain(association.subdomain)`. */
export type VerifyInviteResponseDTO = {
  member: {
    id: number;
    firstName: string;
    lastName: string;
    email: string | null;
    memberId: string;
    userId: number | null;
  };
  association: {
    id: number;
    name: string;
    subdomain: string;
  };
  email: string | null;
};

/** POST /member-invites/accept — public, no tenant context needed. `token`/`refreshToken`/
 * `accessTokenExpiresAt` only present for `X-Client: mobile` (F0.3) — always true here, since
 * `client.ts` always sends that header. Deliberately thin (no `permissions`/`roles`/
 * `requiresOnboarding`) — the caller stores the tokens then re-bootstraps via `/auth/me`
 * (`features/session/useBootstrap.ts`) rather than this screen building its own session mapper. */
export type AcceptInviteResponseDTO = {
  user: { id: number; email: string };
  member: { id: number; firstName: string; lastName: string; memberId: string };
  token?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: IsoDateString;
};

/** POST /member-invites/self-register — public (tenant-scoped, `tenantMiddleware` applies).
 * `isNewMember: false` when the email/phone matched an existing roster `Member` (linked instead
 * of created) — same `userApproval: pending` either way (member-invites.service.ts). */
export type SelfRegisterResponseDTO = {
  user: { id: number; email: string; emailVerified: boolean };
  member: { id: number; memberId: string; firstName: string; lastName: string };
  isNewMember: boolean;
};
