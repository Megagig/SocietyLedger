import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { generateSecret, generateSync, verifySync, generateURI } from 'otplib';
import prisma from '../../lib/prisma';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('TOTP_ENCRYPTION_KEY must be set and at least 32 characters');
  }
  return Buffer.from(key.substring(0, 32), 'utf8');
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid ciphertext format');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export function generateTotpUri(email: string, secret: string): string {
  return generateURI({ label: email, issuer: 'SocietyLedger Admin', secret });
}

export function verifyTotpCode(secret: string, token: string): boolean {
  const result = verifySync({ token, secret });
  return typeof result === 'object' ? result.valid : result === true;
}

const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    randomBytes(5).toString('hex').toUpperCase().match(/.{4}/g)!.join('-'),
  );
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
}

export async function saveRecoveryCodes(userId: number, codes: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })),
    }),
  ]);
}
