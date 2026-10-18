import { cookies } from 'next/headers';
import { cache } from 'react';

const SESSION_COOKIE = 'sl_admin_session';
const CHALLENGE_COOKIE = 'sl_admin_challenge';

const COOKIE_OPTS_SECURE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  // No Domain attribute — host-only cookie per §16.10 rule 2
};

export function setSessionCookie(token: string): void {
  cookies().set(SESSION_COOKIE, token, {
    ...COOKIE_OPTS_SECURE,
    maxAge: 8 * 60 * 60, // 8h — matches PLATFORM_TOKEN_EXPIRY
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE);
}

export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

export function setChallengeCookie(challengeId: number): void {
  cookies().set(CHALLENGE_COOKIE, String(challengeId), {
    ...COOKIE_OPTS_SECURE,
    maxAge: 5 * 60, // 5 minutes
  });
}

export function getChallengeCookieId(): number | null {
  const val = cookies().get(CHALLENGE_COOKIE)?.value;
  if (!val) return null;
  const id = Number(val);
  return Number.isNaN(id) ? null : id;
}

export function clearChallengeCookie(): void {
  cookies().delete(CHALLENGE_COOKIE);
}

export const getAdminSession = cache(async () => {
  const token = getSessionToken();
  return token ? { token } : null;
});
