import { Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import prisma from '../../lib/prisma';
import { verifyPassword, hashPassword, generatePlatformToken, verifyToken, TokenPayload } from '../../lib/auth';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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

  /**
   * A2.12 — Look up a pending invite by its raw token, for the accept page
   * to display who's inviting and to what role before the user commits.
   */
  async getInvite(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token;
      const tokenHash = createHash('sha256').update(token).digest('hex');

      const invite = await prisma.platformAdminInvite.findUnique({
        where: { tokenHash },
        include: { invitedBy: { select: { email: true } } },
      });

      if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) {
        res.status(404).json({ success: false, message: 'Invite not found or no longer valid' });
        return;
      }

      res.json({
        success: true,
        data: {
          email: invite.email,
          platformRole: invite.platformRole,
          invitedByEmail: invite.invitedBy.email,
        },
      });
    } catch (error) {
      console.error('Get platform admin invite error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * A2.12 — Accept a platform admin invite: set a name/password and
   * create the User account with the invited platformRole.
   */
  async acceptInvite(req: Request, res: Response): Promise<void> {
    try {
      const { token, firstName, lastName, password } = acceptInviteSchema.parse(req.body);
      const tokenHash = createHash('sha256').update(token).digest('hex');

      const invite = await prisma.platformAdminInvite.findUnique({ where: { tokenHash } });
      if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) {
        res.status(404).json({ success: false, message: 'Invite not found or no longer valid' });
        return;
      }

      const existing = await prisma.user.findFirst({
        where: { email: invite.email, platformRole: { not: null } },
      });
      if (existing) {
        res.status(409).json({ success: false, message: 'An account with this email already exists' });
        return;
      }

      const passwordHash = await hashPassword(password);

      await prisma.$transaction([
        prisma.user.create({
          data: {
            email: invite.email,
            passwordHash,
            firstName,
            lastName,
            role: 'admin',
            platformRole: invite.platformRole,
            isActive: true,
            emailVerified: true,
          },
        }),
        prisma.platformAdminInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        }),
      ]);

      res.json({ success: true, message: 'Account created — you can now log in.' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
        return;
      }
      console.error('Accept platform admin invite error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
