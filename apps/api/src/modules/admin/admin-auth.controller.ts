import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { verifyPassword, generatePlatformToken, verifyToken, TokenPayload } from '../../lib/auth';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export class AdminAuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          platformRole: { not: null },
        },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          platformRole: true,
          role: true,
          associationId: true,
          emailVerified: true,
          totpEnabledAt: true,
          totpSecretEnc: true,
        },
      });

      if (!user || !user.passwordHash) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
      }

      if (!user.emailVerified) {
        res.status(403).json({ success: false, message: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' });
        return;
      }

      // If TOTP is enabled, create a challenge and return requires2fa
      const totpEnabled = !!user.totpEnabledAt && !!user.totpSecretEnc && !user.totpSecretEnc.startsWith('pending:');
      if (totpEnabled) {
        const challenge = await prisma.adminLoginChallenge.create({
          data: {
            userId: user.id,
            expiresAt: new Date(Date.now() + 5 * 60_000), // 5 minutes
          },
        });
        res.json({
          success: true,
          data: { requires2fa: true, challengeId: challenge.id },
        });
        return;
      }

      // If TOTP is configured but not confirmed (pending), return requires2faSetup
      const totpPending = !!user.totpSecretEnc?.startsWith('pending:');
      if (totpPending) {
        const challenge = await prisma.adminLoginChallenge.create({
          data: {
            userId: user.id,
            expiresAt: new Date(Date.now() + 5 * 60_000),
          },
        });
        res.json({
          success: true,
          data: { requires2faSetup: true, challengeId: challenge.id },
        });
        return;
      }

      const payload: TokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        platformRole: user.platformRole!,
        associationId: user.associationId ?? null,
      };

      const token = generatePlatformToken(payload);

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            platformRole: user.platformRole,
          },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
        return;
      }
      console.error('Admin auth login error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      let token: string | undefined;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = req.cookies?.token;
      }

      if (!token) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.platformRole) {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          platformRole: true,
          role: true,
          associationId: true,
          emailVerified: true,
        },
      });

      if (!user || !user.platformRole) {
        res.status(401).json({ success: false, message: 'Platform user not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          platformRole: user.platformRole,
        },
      });
    } catch (error) {
      console.error('Admin auth me error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
