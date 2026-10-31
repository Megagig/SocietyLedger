/**
 * Password re-entry for the three Ajo actions that cannot be quietly undone: approving a payout, reversing a paid payout and closing a
 * default case. It is checked on the server, so a script that skips the screen's dialog is stopped too. The check is the same
 * rate-limited one expenses and accounting use: five wrong passwords lock the person out for the rest of the window.
 */
import type { Response } from 'express';
import { confirmPassword, reauthFailure } from '../../lib/reauth';

/** True when the password in the body is the signed-in person's. Otherwise the reply has been sent and the caller must stop. */
export async function passwordConfirmed(res: Response, userId: number, body: unknown): Promise<boolean> {
  const password = (body as { password?: unknown } | null | undefined)?.password;
  if (typeof password !== 'string' || password.length === 0) {
    res.status(400).json({ success: false, code: 'PASSWORD_REQUIRED', message: 'Enter your password to confirm this.' });
    return false;
  }
  const confirmed = await confirmPassword(userId, password);
  if (confirmed.ok) return true;
  const { status, body: failure } = reauthFailure(confirmed);
  res.status(status).json(failure);
  return false;
}
