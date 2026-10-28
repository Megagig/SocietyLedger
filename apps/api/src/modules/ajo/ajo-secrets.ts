/**
 * Secrets for the Ajo add-on (T2): payout account numbers encrypted at rest, masking, and keyed hashes of phone codes.
 *
 * It reuses the platform's one at-rest secret (TOTP_ENCRYPTION_KEY) instead of adding a second one, but never uses it directly: each
 * purpose gets its own key derived with HKDF, so the two-factor secrets and the Ajo data stay cryptographically separate. A ciphertext is
 * also bound to what owns it (the "context", for example the member id), so copying one row's ciphertext onto another fails to decrypt.
 *
 * A full account number is only ever produced by `decryptAccountNumber`. Everything else works from the masked form.
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SALT = 'societyledger-ajo-v1';

export type AjoKeyPurpose = 'payout-account' | 'phone-code' | 'group-account';

function rootKey(): Buffer {
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error('TOTP_ENCRYPTION_KEY must be set and at least 32 characters');
  return Buffer.from(key, 'utf8');
}

function keyFor(purpose: AjoKeyPurpose): Buffer {
  return Buffer.from(hkdfSync('sha256', rootKey(), SALT, `ajo:${purpose}`, 32));
}

/** Encrypt a value for the owner named by `context`. The result is `iv:tag:data` in hex. */
export function encryptFor(purpose: AjoKeyPurpose, context: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFor(purpose), iv);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${data.toString('hex')}`;
}

/** Decrypt a value for its owner. Throws if the ciphertext was altered or belongs to a different owner. */
export function decryptFor(purpose: AjoKeyPurpose, context: string, ciphertext: string): string {
  const [iv, tag, data] = ciphertext.split(':');
  if (!iv || !tag || !data) throw new Error('Invalid ciphertext format');
  const decipher = createDecipheriv(ALGORITHM, keyFor(purpose), Buffer.from(iv, 'hex'));
  decipher.setAAD(Buffer.from(context, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Payout account numbers
// ---------------------------------------------------------------------------------------------------------------------------------

/** Nigerian bank account numbers (NUBAN) are exactly ten digits. */
export const ACCOUNT_NUMBER_PATTERN = /^[0-9]{10}$/;

/** Strip spaces and dashes people type, then check it is a ten-digit number. Returns null when it is not. */
export function normaliseAccountNumber(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s-]/g, '');
  return ACCOUNT_NUMBER_PATTERN.test(digits) ? digits : null;
}

export function lastFour(accountNumber: string): string {
  return accountNumber.slice(-4);
}

/** "••••1234": the only form of an account number that lists, logs, snapshots and error reports may carry. */
export function maskAccount(last4: string | null | undefined): string {
  return last4 && /^[0-9]{4}$/.test(last4) ? `••••${last4}` : '••••';
}

const accountContext = (memberId: number) => `member:${memberId}`;

export function encryptAccountNumber(memberId: number, accountNumber: string): string {
  return encryptFor('payout-account', accountContext(memberId), accountNumber);
}

/** The one place a full account number is produced. Callers must be the person entering it or an officer with `ajo.manage`. */
export function decryptAccountNumber(memberId: number, ciphertext: string): string {
  return decryptFor('payout-account', accountContext(memberId), ciphertext);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// A group's own bank account (T3.1)
// ---------------------------------------------------------------------------------------------------------------------------------

const groupContext = (groupId: number) => `group:${groupId}`;

export function encryptGroupAccountNumber(groupId: number, accountNumber: string): string {
  return encryptFor('group-account', groupContext(groupId), accountNumber);
}

/** Contributors need the full number to pay into the group's account, so the group's own members and officers may be shown it. Nobody else. */
export function decryptGroupAccountNumber(groupId: number, ciphertext: string): string {
  return decryptFor('group-account', groupContext(groupId), ciphertext);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Phone confirmation codes
// ---------------------------------------------------------------------------------------------------------------------------------

/** A keyed hash of a code, tied to the membership, so a stolen database row cannot be used to guess codes offline. */
export function hashPhoneCode(membershipId: number, code: string): string {
  return createHmac('sha256', keyFor('phone-code')).update(`${membershipId}:${code}`).digest('hex');
}

/** A random six-digit code, with leading zeros kept. */
export function generatePhoneCode(): string {
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
}
