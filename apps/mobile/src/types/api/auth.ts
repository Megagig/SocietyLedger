/** `modules/auth/auth.routes.ts` + `auth.controller.ts` — api-contract.md §1. */
import type { PlatformRole } from './enums';
import type { IsoDateString } from './common';

export type AuthAssociationDTO = {
  id: number;
  name: string;
  subdomain: string;
  isPlatformAssociation?: boolean;
};

/** The `member` shape as returned alongside the login/me user — narrower than MemberSelfDTO (members.ts). */
export type AuthMemberSummaryDTO = {
  id: number;
  firstName: string;
  lastName: string;
  memberId: string;
};

export type LoginUserDTO = {
  id: number;
  email: string;
  role: string;
  member: AuthMemberSummaryDTO | null;
  association: AuthAssociationDTO;
  platformRole: PlatformRole | null;
  requiresOnboarding: boolean;
  permissions: string[];
  roles: string[];
  isPlatformLogin: boolean;
};

/**
 * POST /auth/login — verified against auth.controller.ts (2026-10-19).
 * `refreshToken`/`accessTokenExpiresAt` only present when the request sent `X-Client: mobile` (F0.3).
 * Not the same shape as `/auth/me` — see MeResponseDTO below.
 */
export type LoginResponseDTO = {
  user: LoginUserDTO;
  token: string;
  refreshToken?: string;
  accessTokenExpiresAt?: IsoDateString;
};

export type MeMemberSummaryDTO = {
  id: number;
  firstName: string;
  lastName: string;
  memberId: string;
  email: string;
  phone: string;
};

/** 'pending' | 'approved' | 'rejected' — real values confirmed in auth.controller.ts/member-invites.service.ts; this is a free-form Member-model-style String column, not a Prisma enum, so it isn't in enums.ts. */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type MeUserApprovalDTO = {
  approvalStatus: ApprovalStatus;
} | null;

/**
 * GET /auth/me — verified against auth.controller.ts (2026-10-19).
 * Spreads the raw Prisma user row (includes `userApproval`, `associationId`, `isActive`,
 * `emailVerified`) — deliberately NOT the same shape as LoginResponseDTO's `user`.
 */
export type MeResponseDTO = {
  user: {
    id: number;
    email: string;
    role: string;
    isActive: boolean;
    emailVerified: boolean;
    associationId: number;
    platformRole: PlatformRole | null;
    member: MeMemberSummaryDTO | null;
    userApproval: MeUserApprovalDTO;
    association: AuthAssociationDTO;
    requiresOnboarding: boolean;
    permissions: string[];
    roles: string[];
  };
};

/** POST /auth/register — verified 2026-10-19. */
export type RegisterResponseDTO = {
  user: {
    id: number;
    email: string;
    emailVerified: boolean;
    approvalStatus: ApprovalStatus;
  };
};

/** POST /auth/refresh — verified 2026-10-19 (F0.3). Rotates: presented token invalidated, new one issued in the same family. */
export type RefreshResponseDTO = {
  token: string;
  refreshToken: string;
  accessTokenExpiresAt: IsoDateString;
};

/** GET /auth/sessions — verified 2026-10-19 (F0.3). One entry per active refresh-token family, most-recently-used first. */
export type SessionDTO = {
  familyId: string;
  deviceName: string | null;
  platform: string | null;
  lastUsedAt: IsoDateString;
  createdAt: IsoDateString;
};

export type SessionsResponseDTO = {
  sessions: SessionDTO[];
};
