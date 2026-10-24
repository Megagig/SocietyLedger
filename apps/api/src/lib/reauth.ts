import prisma from './prisma';
import { verifyPassword } from './auth';
import { countAttempt, peekAttempts } from '../middleware/rate-limit.middleware';

/** Five wrong passwords in 15 minutes lock the officer out of anything that asks for their password, for the rest of that window. */
export const REAUTH_WINDOW_MS = 15 * 60 * 1000;
export const REAUTH_MAX_WRONG = 5;

export type ReauthResult = { ok: true } | { ok: false; reason: 'wrong' } | { ok: false; reason: 'locked'; retryAfterSeconds: number };

const keyFor = (userId: number) => `ratelimit:reauth:${userId}`;

/**
 * Checks the password of the person asking, before something that cannot be undone (posting to the books, voiding a charge).
 *
 * Only wrong passwords count. A correct one is never held against anybody, but a stolen session cannot try passwords one after
 * another: after the fifth wrong one the person is locked out until the window has passed, even if the next is right.
 */
export async function confirmPassword(userId: number, password: string): Promise<ReauthResult> {
  const key = keyFor(userId);
  // Local development switches rate limiting off, as the rest of the app does, so repeated test runs don't lock anyone out
  const limited = process.env.NODE_ENV !== 'development';

  if (limited && (await peekAttempts(key, REAUTH_WINDOW_MS)) >= REAUTH_MAX_WRONG) {
    const retryAfterSeconds = Math.ceil((REAUTH_WINDOW_MS - (Date.now() % REAUTH_WINDOW_MS)) / 1000);
    return { ok: false, reason: 'locked', retryAfterSeconds };
  }

  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (actor?.passwordHash && (await verifyPassword(password, actor.passwordHash))) return { ok: true };

  if (limited) await countAttempt(key, REAUTH_WINDOW_MS, REAUTH_MAX_WRONG);
  return { ok: false, reason: 'wrong' };
}

/** The response to send for a failed confirmation. */
export function reauthFailure(result: Exclude<ReauthResult, { ok: true }>): { status: 403 | 429; body: { success: false; code: string; message: string } } {
  if (result.reason === 'locked') {
    const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
    return {
      status: 429,
      body: { success: false, code: 'REAUTH_LOCKED', message: `Too many wrong passwords. Try again in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.` },
    };
  }
  return { status: 403, body: { success: false, code: 'REAUTH_FAILED', message: 'That password is not correct.' } };
}
