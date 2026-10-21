import type { MeResponseDTO } from '@/types/api/auth';
import type { SessionUser } from '@/stores/session';

/** `stores/session.ts`'s own note: a normalised shape of its own, not `MeResponseDTO`/`LoginUserDTO`
 * directly — each caller maps whichever one it just received into `SessionUser`. This is the
 * `/auth/me` mapper; F2.2's login feature has its own for `LoginResponseDTO`'s differently-shaped
 * `user`. */
export function mapMeUserToSessionUser(user: MeResponseDTO['user']): SessionUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    roles: user.roles,
    requiresOnboarding: user.requiresOnboarding,
    platformRole: user.platformRole,
    member: user.member
      ? {
          id: user.member.id,
          firstName: user.member.firstName,
          lastName: user.member.lastName,
          memberId: user.member.memberId,
        }
      : null,
  };
}
