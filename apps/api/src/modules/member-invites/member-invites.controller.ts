/**
 * Member Invites Controller
 * 
 * Handles HTTP requests for member login activation:
 * - Admin invite endpoints (protected)
 * - Member activation endpoints (public with token)
 * - Self-registration endpoint (public with tenant)
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth.middleware';
import { TenantRequest } from '../../middleware/tenant.middleware';
import { generateToken, mobileAccessTokenExpiresAt } from '../../lib/auth';
import { issueRefreshToken } from '../../services/refresh-token.service';
import {
  createMemberInvite,
  verifyInviteToken,
  acceptMemberInvite,
  revokeInvite,
  resendInvite,
  getMemberInviteHistory,
  getPendingInvites,
  memberSelfRegister,
  getInvitableMembers,
  sendMemberInviteEmail,
} from './member-invites.service';
import {
  generateVerificationCode,
  hashToken,
  sendVerificationEmail,
} from '../auth/auth.service';
import { SettingsService } from '../settings/settings.service';
import prisma from '../../lib/prisma';
import { notifyApprovalPending } from '../../services/approval-notifications';

// Validation schemas
const inviteMemberSchema = z.object({
  memberId: z.number().int().positive('Member ID is required'),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().optional(),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
});

const selfRegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().optional(),
});

const bulkInviteSchema = z.object({
  memberIds: z.array(z.number().int().positive()).min(1, 'At least one member ID is required'),
});

export const memberInviteController = {
  /**
   * Admin: Invite a member to activate login
   * POST /api/member-invites/invite
   */
  async inviteMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        res.status(400).json({
          success: false,
          message: 'Association context required',
        });
        return;
      }

      const { memberId, email, phone } = inviteMemberSchema.parse(req.body);

      const { invite, token } = await createMemberInvite({
        memberId,
        associationId,
        invitedById: userId,
        email,
        phone,
      });

      // Send invite email. The invite itself is already saved, so a delivery failure doesn't fail the request —
      // but it is reported (`emailSent`) so the officer can resend instead of assuming the member got it.
      let emailSent = false;
      if (invite.email) {
        try {
          await sendMemberInviteEmail(
            invite.email,
            token,
            `${invite.member.firstName} ${invite.member.lastName}`,
            invite.association.name,
            invite.association.subdomain,
            invite.inviteTokenExpiresAt
          );
          emailSent = true;
        } catch (emailError) {
          console.error('Failed to send invite email:', emailError);
        }
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'member_invites',
          recordId: invite.id,
          newValues: {
            memberId: invite.memberId,
            email: invite.email,
            status: invite.status,
          },
        },
      });

      res.status(201).json({
        success: true,
        message: emailSent ? 'Invite sent successfully' : 'Invite created, but the email could not be sent. Try resending it.',
        data: {
          emailSent,
          invite: {
            id: invite.id,
            memberId: invite.memberId,
            email: invite.email,
            status: invite.status,
            expiresAt: invite.inviteTokenExpiresAt,
            member: invite.member,
          },
        },
      });
    } catch (error: any) {
      console.error('Invite member error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to send invite',
      });
    }
  },

  /**
   * Admin: Bulk invite members
   * POST /api/member-invites/bulk-invite
   */
  async bulkInvite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        res.status(400).json({
          success: false,
          message: 'Association context required',
        });
        return;
      }

      const { memberIds } = bulkInviteSchema.parse(req.body);

      const results: { memberId: number; success: boolean; emailSent?: boolean; message: string }[] = [];

      for (const memberId of memberIds) {
        try {
          const { invite, token } = await createMemberInvite({
            memberId,
            associationId,
            invitedById: userId,
          });

          // Send invite email
          let emailSent = false;
          if (invite.email) {
            try {
              await sendMemberInviteEmail(
                invite.email,
                token,
                `${invite.member.firstName} ${invite.member.lastName}`,
                invite.association.name,
                invite.association.subdomain,
                invite.inviteTokenExpiresAt
              );
              emailSent = true;
            } catch (emailError) {
              console.error(`Failed to send invite email for member ${memberId}:`, emailError);
            }
          }

          results.push({
            memberId,
            success: true,
            emailSent,
            message: emailSent ? 'Invite sent' : 'Invite created, but the email could not be sent. Try resending it.',
          });
        } catch (error: any) {
          results.push({ memberId, success: false, message: error.message });
        }
      }

      const successCount = results.filter((r) => r.success).length;

      res.status(200).json({
        success: true,
        message: `${successCount} of ${memberIds.length} invites sent successfully`,
        data: { results },
      });
    } catch (error: any) {
      console.error('Bulk invite error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Failed to process bulk invites',
      });
    }
  },

  /**
   * Public: Verify invite token
   * GET /api/member-invites/verify?token=xxx
   */
  async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = verifyTokenSchema.parse(req.query);

      const result = await verifyInviteToken(token);

      if (!result.valid) {
        res.status(400).json({
          success: false,
          message: result.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Invite is valid',
        data: {
          member: result.invite.member,
          association: result.invite.association,
          email: result.invite.email,
        },
      });
    } catch (error: any) {
      console.error('Verify token error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Failed to verify invite',
      });
    }
  },

  /**
   * Public: Accept invite and create account
   * POST /api/member-invites/accept
   */
  async acceptInvite(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = acceptInviteSchema.parse(req.body);

      const { user, member } = await acceptMemberInvite({ token, password });

      // F0.3: a mobile client gets signed in immediately (access + refresh
      // token), matching login's behavior — web's response is byte-for-byte
      // unchanged (it never sends this header, and still just gets the
      // "you can now log in" message below with no token at all).
      const isMobileClient = req.headers['x-client'] === 'mobile';
      let mobileAuth: { token: string; refreshToken: string; accessTokenExpiresAt: string } | undefined;
      if (isMobileClient) {
        const accessToken = generateToken(
          { id: user.id, email: user.email, role: user.role, associationId: user.associationId ?? undefined },
          { isMobile: true }
        );
        const issued = await issueRefreshToken({ userId: user.id, associationId: user.associationId });
        mobileAuth = {
          token: accessToken,
          refreshToken: issued.token,
          accessTokenExpiresAt: mobileAccessTokenExpiresAt().toISOString(),
        };
      }

      res.status(200).json({
        success: true,
        message: 'Account activated successfully. You can now log in.',
        data: {
          user: {
            id: user.id,
            email: user.email,
          },
          member: {
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            memberId: member.memberId,
          },
          ...mobileAuth,
        },
      });
    } catch (error: any) {
      console.error('Accept invite error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to activate account',
      });
    }
  },

  /**
   * Admin: Revoke a pending invite
   * DELETE /api/member-invites/:id
   */
  async revokeInvite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const inviteId = parseInt(req.params.id);

      if (!associationId || !userId) {
        res.status(400).json({
          success: false,
          message: 'Association context required',
        });
        return;
      }

      if (isNaN(inviteId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid invite ID',
        });
        return;
      }

      await revokeInvite(inviteId, associationId);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'member_invites',
          recordId: inviteId,
          newValues: { status: 'revoked' },
        },
      });

      res.status(200).json({
        success: true,
        message: 'Invite revoked successfully',
      });
    } catch (error: any) {
      console.error('Revoke invite error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to revoke invite',
      });
    }
  },

  /**
   * Admin: Resend invite
   * POST /api/member-invites/:id/resend
   */
  async resendInvite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const inviteId = parseInt(req.params.id);

      if (!associationId || !userId) {
        res.status(400).json({
          success: false,
          message: 'Association context required',
        });
        return;
      }

      if (isNaN(inviteId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid invite ID',
        });
        return;
      }

      const { invite, token } = await resendInvite(inviteId, associationId, userId);

      // Send invite email
      let emailSent = false;
      if (invite.email) {
        try {
          await sendMemberInviteEmail(
            invite.email,
            token,
            `${invite.member.firstName} ${invite.member.lastName}`,
            invite.association.name,
            invite.association.subdomain,
            invite.inviteTokenExpiresAt
          );
          emailSent = true;
        } catch (emailError) {
          console.error('Failed to send invite email:', emailError);
        }
      }

      res.status(200).json({
        success: true,
        message: emailSent ? 'Invite resent successfully' : 'Invite renewed, but the email could not be sent. Try again shortly.',
        data: {
          emailSent,
          invite: {
            id: invite.id,
            email: invite.email,
            status: invite.status,
            expiresAt: invite.inviteTokenExpiresAt,
          },
        },
      });
    } catch (error: any) {
      console.error('Resend invite error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to resend invite',
      });
    }
  },

  /**
   * Admin: Get pending invites
   * GET /api/member-invites/pending
   */
  async getPendingInvites(req: AuthRequest, res: Response): Promise<void> {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        res.status(400).json({
          success: false,
          message: 'Association context required',
        });
        return;
      }

      const invites = await getPendingInvites(associationId);

      res.status(200).json({
        success: true,
        data: { invites },
      });
    } catch (error: any) {
      console.error('Get pending invites error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending invites',
      });
    }
  },

  /**
   * Admin: Get invite history for a member
   * GET /api/member-invites/member/:memberId/history
   */
  async getMemberInviteHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId);

      if (!associationId) {
        res.status(400).json({
          success: false,
          message: 'Association context required',
        });
        return;
      }

      if (isNaN(memberId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid member ID',
        });
        return;
      }

      const history = await getMemberInviteHistory(memberId, associationId);

      res.status(200).json({
        success: true,
        data: { history },
      });
    } catch (error: any) {
      console.error('Get invite history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invite history',
      });
    }
  },

  /**
   * Admin: Get members eligible for invite
   * GET /api/member-invites/invitable
   */
  async getInvitableMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        res.status(400).json({
          success: false,
          message: 'Association context required',
        });
        return;
      }

      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 500);

      const { members, total } = await getInvitableMembers(associationId, {
        search,
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: {
          members,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error: any) {
      console.error('Get invitable members error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invitable members',
      });
    }
  },

  /**
   * Public: Member self-registration
   * POST /api/member-invites/self-register
   */
  async selfRegister(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, tenant } = req as TenantRequest;

      if (!tenantId) {
        res.status(400).json({
          success: false,
          message: 'Missing tenant context. Please access via your association subdomain.',
        });
        return;
      }

      // Mobile Phase 2 (F2.3) finding: this endpoint produces a real Member (unlike
      // `/auth/register`, which only creates a bare User) but never checked the association's
      // own self-registration toggle — same gate as `/auth/register` (G52), applied here too so
      // both self-signup entry points respect it consistently.
      const selfSignupEnabled = await SettingsService.getSetting(tenantId, 'members_access', 'selfSignupEnabled');
      if (!selfSignupEnabled) {
        res.status(403).json({
          success: false,
          code: 'SELF_SIGNUP_DISABLED',
          message: 'Self-registration is not enabled for this association. Please contact an administrator for an invite.',
        });
        return;
      }

      const { email, password, firstName, lastName, phone } = selfRegisterSchema.parse(req.body);

      const { user, member, isNewMember } = await memberSelfRegister({
        email,
        password,
        firstName,
        lastName,
        phone,
        associationId: tenantId,
      });

      // Approvers get a push so the new member isn't left waiting (fire-and-forget).
      void notifyApprovalPending(tenantId, { userId: user.id, name: `${firstName} ${lastName}`.trim() });

      // Generate and send verification code
      const verificationCode = generateVerificationCode();
      const hashedCode = hashToken(verificationCode);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationCode: hashedCode,
          verificationExpiresAt: expiresAt,
        },
      });

      // Send verification email
      try {
        await sendVerificationEmail(email, verificationCode, tenant?.name);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      res.status(201).json({
        success: true,
        message: isNewMember
          ? 'Registration successful. Please check your email for a verification code.'
          : 'Account linked to existing membership. Please check your email for a verification code.',
        data: {
          user: {
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
          },
          member: {
            id: member.id,
            memberId: member.memberId,
            firstName: member.firstName,
            lastName: member.lastName,
          },
          isNewMember,
        },
      });
    } catch (error: any) {
      console.error('Self-register error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Registration failed',
      });
    }
  },
};
