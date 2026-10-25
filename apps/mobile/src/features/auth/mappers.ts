import type { LoginUserDTO } from '@/types/api/auth';
import type { SessionUser } from '@/stores/session';

/** `stores/session.ts`'s own note — the `/auth/login` counterpart to `features/session/mappers.ts`'s
 * `mapMeUserToSessionUser`. `LoginUserDTO` and `MeResponseDTO['user']` are deliberately different
 * shapes (login vs. `/me`), so each gets its own mapper rather than sharing one. */
export function mapLoginUserToSessionUser(user: LoginUserDTO): SessionUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    roles: user.roles,
    requiresOnboarding: user.requiresOnboarding,
    subscriptionAccess: user.subscriptionAccess ?? null,
    platformRole: user.platformRole,
    member: user.member
      ? { id: user.member.id, firstName: user.member.firstName, lastName: user.member.lastName, memberId: user.member.memberId }
      : null,
  };
}
