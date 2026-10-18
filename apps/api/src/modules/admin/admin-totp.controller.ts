import { Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import prisma from '../../lib/prisma';
import { verifyPassword, generatePlatformToken, verifyToken, TokenPayload } from '../../lib/auth';
import {
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  saveRecoveryCodes,
} from './totp.service';

function getTokenFromRequest(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
  return req.cookies?.token;
}

export class AdminTotpController {
  /** Step 1: Generate a new TOTP secret and return the QR URI */
  async setup(req: Request, res: Response): Promise<void> {
    try {
      const token = getTokenFromRequest(req);
      if (!token) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }

      const decoded = verifyToken(token);
      if (!decoded?.platformRole) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

      const secret = generateTotpSecret();
      const uri = generateTotpUri(decoded.email, secret);

      // Store pending secret in AdminLoginChallenge as a temporary holder
      await prisma.adminLoginChallenge.deleteMany({ where: { userId: decoded.id } });
      await prisma.adminLoginChallenge.create({
        data: {
          userId: decoded.id,
          expiresAt: new Date(Date.now() + 10 * 60_000), // 10 min to confirm
          // Store encrypted secret in id field is not ideal — use a separate approach:
          // Store raw secret temporarily on the user row (not yet encrypted/committed)
        },
      });

      // Store pending secret temporarily on the user
      await prisma.user.update({
        where: { id: decoded.id },
        data: { totpSecretEnc: `pending:${encryptSecret(secret)}` },
      });

      res.json({ success: true, data: { uri, secret } });
    } catch (error) {
      console.error('TOTP setup error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /** Step 2: Confirm TOTP setup by verifying the first code */
  async confirm(req: Request, res: Response): Promise<void> {
    try {
      const token = getTokenFromRequest(req);
      if (!token) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }

      const decoded = verifyToken(token);
      if (!decoded?.platformRole) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

      const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { totpSecretEnc: true },
      });

      if (!user?.totpSecretEnc?.startsWith('pending:')) {
        res.status(400).json({ success: false, message: 'No pending TOTP setup found. Start setup first.' });
        return;
      }

      const encryptedSecret = user.totpSecretEnc.substring(8);
      const secret = decryptSecret(encryptedSecret);

      if (!verifyTotpCode(secret, code)) {
        res.status(400).json({ success: false, message: 'Invalid TOTP code' });
        return;
      }

      const recoveryCodes = generateRecoveryCodes();
      await saveRecoveryCodes(decoded.id, recoveryCodes);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: decoded.id },
          data: { totpSecretEnc: encryptedSecret, totpEnabledAt: new Date() },
        }),
        prisma.adminLoginChallenge.deleteMany({ where: { userId: decoded.id } }),
      ]);

      res.json({ success: true, data: { recoveryCodes } });
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors }); return; }
      console.error('TOTP confirm error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /** Verify a TOTP code against the current session (called by login flow) */
  async verify(req: Request, res: Response): Promise<void> {
    try {
      const { challengeId, code } = z.object({
        challengeId: z.number().int(),
        code: z.string().length(6),
      }).parse(req.body);

      const challenge = await prisma.adminLoginChallenge.findUnique({
        where: { id: challengeId },
        include: {
          user: { select: { id: true, email: true, role: true, platformRole: true, associationId: true, totpSecretEnc: true } },
        },
      });

      if (!challenge || challenge.usedAt || challenge.expiresAt < new Date()) {
        res.status(401).json({ success: false, message: 'Invalid or expired challenge' });
        return;
      }

      if (!challenge.user.totpSecretEnc || challenge.user.totpSecretEnc.startsWith('pending:')) {
        res.status(400).json({ success: false, message: 'TOTP not configured' });
        return;
      }

      const secret = decryptSecret(challenge.user.totpSecretEnc);
      if (!verifyTotpCode(secret, code)) {
        res.status(400).json({ success: false, message: 'Invalid TOTP code' });
        return;
      }

      await prisma.adminLoginChallenge.update({ where: { id: challengeId }, data: { usedAt: new Date() } });

      const payload: TokenPayload = {
        id: challenge.user.id,
        email: challenge.user.email,
        role: challenge.user.role,
        platformRole: challenge.user.platformRole!,
        associationId: challenge.user.associationId ?? null,
      };
      const token = generatePlatformToken(payload);

      res.json({ success: true, data: { token, user: { id: challenge.user.id, email: challenge.user.email, platformRole: challenge.user.platformRole } } });
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors }); return; }
      console.error('TOTP verify error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /** Use a recovery code instead of TOTP */
  async recovery(req: Request, res: Response): Promise<void> {
    try {
      const { challengeId, code } = z.object({
        challengeId: z.number().int(),
        code: z.string().min(1),
      }).parse(req.body);

      const challenge = await prisma.adminLoginChallenge.findUnique({
        where: { id: challengeId },
        include: {
          user: { select: { id: true, email: true, role: true, platformRole: true, associationId: true } },
        },
      });

      if (!challenge || challenge.usedAt || challenge.expiresAt < new Date()) {
        res.status(401).json({ success: false, message: 'Invalid or expired challenge' });
        return;
      }

      const codeHash = hashRecoveryCode(code);
      const recoveryCode = await prisma.recoveryCode.findFirst({
        where: { userId: challenge.userId, codeHash, usedAt: null },
      });

      if (!recoveryCode) {
        res.status(400).json({ success: false, message: 'Invalid or already-used recovery code' });
        return;
      }

      await prisma.$transaction([
        prisma.recoveryCode.update({ where: { id: recoveryCode.id }, data: { usedAt: new Date() } }),
        prisma.adminLoginChallenge.update({ where: { id: challengeId }, data: { usedAt: new Date() } }),
      ]);

      const payload: TokenPayload = {
        id: challenge.user.id,
        email: challenge.user.email,
        role: challenge.user.role,
        platformRole: challenge.user.platformRole!,
        associationId: challenge.user.associationId ?? null,
      };
      const token = generatePlatformToken(payload);

      res.json({ success: true, data: { token, user: { id: challenge.user.id, email: challenge.user.email } } });
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors }); return; }
      console.error('TOTP recovery error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /** Regenerate recovery codes (requires current TOTP code) */
  async regenerateRecovery(req: Request, res: Response): Promise<void> {
    try {
      const token = getTokenFromRequest(req);
      if (!token) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }

      const decoded = verifyToken(token);
      if (!decoded?.platformRole) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

      const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { totpSecretEnc: true },
      });

      if (!user?.totpSecretEnc || user.totpSecretEnc.startsWith('pending:')) {
        res.status(400).json({ success: false, message: 'TOTP not enabled' });
        return;
      }

      const secret = decryptSecret(user.totpSecretEnc);
      if (!verifyTotpCode(secret, code)) {
        res.status(400).json({ success: false, message: 'Invalid TOTP code' });
        return;
      }

      const recoveryCodes = generateRecoveryCodes();
      await saveRecoveryCodes(decoded.id, recoveryCodes);

      res.json({ success: true, data: { recoveryCodes } });
    } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors }); return; }
      console.error('Regenerate recovery error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
