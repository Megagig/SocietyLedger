/**
 * Member Invites Service
 * 
 * Handles member login activation workflows:
 * - Admin-invited member login (primary flow)
 * - Member self-registration with auto-linking
 * - Passive member support (no login required)
 * 
 * Core Design Principles:
 * - Member ≠ User: Members can exist without users
 * - Login is optional: Financial operations work regardless of login status
 * - Zero breaking changes: Enhances existing auth without replacing it
 */

import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { hashPassword } from '../../lib/auth';
import { sendEmail } from '../../lib/email';
import { hashToken } from '../auth/auth.service';
import { SettingsService } from '../settings/settings.service';
import { assertMemberCapacity } from '../../middleware/subscription.middleware';

const DEFAULT_INVITE_TOKEN_EXPIRY_HOURS = 72; // 3 days — fallback only

/**
 * Generate a secure invite token
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Send member login invite email
 */
export async function sendMemberInviteEmail(
  email: string,
  inviteToken: string,
  memberName: string,
  associationName: string,
  subdomain?: string,
  expiresAt?: Date
): Promise<void> {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const baseDomain = process.env.BASE_DOMAIN || 'societyledger.com';
  let activateUrl: string;
  
  console.log('[Member Invite] Generating activation URL:', {
    subdomain,
    nodeEnv: process.env.NODE_ENV,
    baseUrl,
    baseDomain,
  });
  
  if (subdomain && process.env.NODE_ENV === 'production') {
    activateUrl = `https://${subdomain}.${baseDomain}/auth/activate?token=${inviteToken}`;
  } else if (subdomain) {
    // G72: read the real dev port from FRONTEND_URL instead of hardcoding :3000
    const devPort = new URL(baseUrl).port || '3000';
    activateUrl = `http://${subdomain}.localhost:${devPort}/auth/activate?token=${inviteToken}`;
  } else {
    activateUrl = `${baseUrl}/auth/activate?token=${inviteToken}`;
  }
  
  console.log('[Member Invite] Generated activation URL:', activateUrl);

  // R4.6/G53: Members & Access Settings' inviteExpiryHours was saved but
  // never read — createMemberInvite() now sets the real expiry from it, so
  // display the real expiresAt here instead of the old hardcoded constant.
  const expiryHours = expiresAt
    ? Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
    : DEFAULT_INVITE_TOKEN_EXPIRY_HOURS;

  // A standalone thrift group is a savings group, not an association: it is invited in those words.
  const owner = subdomain ? await prisma.association.findFirst({ where: { subdomain }, select: { kind: true } }) : null;
  const thrift = owner?.kind === 'THRIFT_GROUP';

  await sendEmail({
    to: email,
    subject: thrift ? `You're invited to join ${associationName} on SocietyLedger Thrift` : `You're Invited to Join ${associationName} - SocietyLedger`,
    template: 'member-invite',
    data: {
      memberName,
      associationName,
      activateUrl,
      expiryHours,
      thrift,
    },
  });
}

/**
 * Create a member login invite
 * Admin invites an existing member to activate their login
 */
export async function createMemberInvite(data: {
  memberId: number;
  associationId: number;
  invitedById: number;
  email?: string;
  phone?: string;
  /** An officer role to grant when the invite is accepted (onboarding team step). */
  roleName?: string;
}): Promise<{ invite: any; token: string }> {
  const { memberId, associationId, invitedById, email, phone, roleName } = data;

  // Verify member exists and belongs to association
  const member = await prisma.member.findFirst({
    where: { id: memberId, associationId },
    include: { user: true },
  });

  if (!member) {
    throw new Error('Member not found');
  }

  // Check if member already has a user account
  if (member.userId) {
    throw new Error('Member already has an active login account');
  }

  // Use provided email/phone or fall back to member's stored values
  const inviteEmail = email || member.email;
  const invitePhone = phone || member.phone;

  // Invites go out by email only (SMS invites arrive with the SMS module) — a phone number alone would get nothing.
  if (!inviteEmail) {
    throw new Error('This member has no email address. Add an email to the member to invite them to sign in.');
  }

  // Revoke any existing pending invites for this member
  await prisma.memberInvite.updateMany({
    where: {
      memberId,
      status: 'pending',
    },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
    },
  });

  // Generate invite token
  const inviteToken = generateInviteToken();
  const hashedToken = hashToken(inviteToken);
  const inviteExpiryHours = await SettingsService.getSetting(associationId, 'members_access', 'inviteExpiryHours')
    ?? DEFAULT_INVITE_TOKEN_EXPIRY_HOURS;
  const expiresAt = new Date(Date.now() + inviteExpiryHours * 60 * 60 * 1000);

  // Create invite record
  const invite = await prisma.memberInvite.create({
    data: {
      associationId,
      memberId,
      email: inviteEmail,
      phone: invitePhone,
      roleName: roleName ?? null,
      inviteToken: hashedToken,
      inviteTokenExpiresAt: expiresAt,
      status: 'pending',
      invitedById,
    },
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          memberId: true,
        },
      },
      association: {
        select: {
          name: true,
          subdomain: true,
        },
      },
    },
  });

  // Update member login status
  await prisma.member.update({
    where: { id: memberId },
    data: { loginStatus: 'invited' },
  });

  return { invite, token: inviteToken };
}

/**
 * Verify invite token and get invite details
 */
export async function verifyInviteToken(token: string): Promise<{
  valid: boolean;
  invite?: any;
  message: string;
}> {
  const hashedToken = hashToken(token);

  const invite = await prisma.memberInvite.findUnique({
    where: { inviteToken: hashedToken },
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          memberId: true,
          userId: true,
        },
      },
      association: {
        select: {
          id: true,
          name: true,
          subdomain: true,
        },
      },
    },
  });

  if (!invite) {
    return { valid: false, message: 'Invalid invite token' };
  }

  if (invite.status !== 'pending') {
    return { valid: false, message: `Invite has already been ${invite.status}` };
  }

  if (new Date() > invite.inviteTokenExpiresAt) {
    // Mark as expired
    await prisma.memberInvite.update({
      where: { id: invite.id },
      data: { status: 'expired' },
    });
    return { valid: false, message: 'Invite has expired. Please request a new invite.' };
  }

  if (invite.member.userId) {
    return { valid: false, message: 'Member already has an active login account' };
  }

  return { valid: true, invite, message: 'Invite is valid' };
}

/**
 * Accept invite and create user account for member
 * This is the final step of the admin-invite flow
 */
export async function acceptMemberInvite(data: {
  token: string;
  password: string;
}): Promise<{ user: any; member: any }> {
  const { token, password } = data;

  // Verify token
  const verification = await verifyInviteToken(token);
  if (!verification.valid || !verification.invite) {
    throw new Error(verification.message);
  }

  const invite = verification.invite;
  const hashedToken = hashToken(token);

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user and link to member in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create user account (auto-approved since admin invited them)
    const user = await tx.user.create({
      data: {
        associationId: invite.associationId,
        email: invite.email?.toLowerCase() || invite.member.email?.toLowerCase(),
        passwordHash,
        role: invite.roleName || 'member', // an officer invited from the setup wizard arrives with their role
        isActive: true, // Auto-active since admin invited
        emailVerified: true, // Auto-verified since admin invited
        userApproval: {
          create: {
            approvalStatus: 'approved', // Auto-approved
            approvalDate: new Date(),
          },
        },
      },
    });

    // The role they were invited with becomes a real role assignment now, not only at their first sign-in.
    if (invite.roleName) {
      const role = await tx.role.findFirst({ where: { associationId: invite.associationId, name: invite.roleName } });
      if (role) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: role.id, associationId: invite.associationId, assignedBy: invite.invitedById, isActive: true },
        });
      }
    }

    // Link user to member
    const member = await tx.member.update({
      where: { id: invite.memberId },
      data: {
        userId: user.id,
        loginStatus: 'active',
        // Update email if it was provided in invite and different from stored
        ...(invite.email && invite.email !== invite.member.email
          ? { email: invite.email }
          : {}),
      },
    });

    // Mark invite as accepted
    await tx.memberInvite.update({
      where: { inviteToken: hashedToken },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });

    return { user, member };
  });

  return result;
}

/**
 * Revoke a pending invite
 */
export async function revokeInvite(
  inviteId: number,
  associationId: number
): Promise<void> {
  const invite = await prisma.memberInvite.findFirst({
    where: { id: inviteId, associationId, status: 'pending' },
  });

  if (!invite) {
    throw new Error('Invite not found or already processed');
  }

  await prisma.$transaction([
    prisma.memberInvite.update({
      where: { id: inviteId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    }),
    prisma.member.update({
      where: { id: invite.memberId },
      data: { loginStatus: 'no_login' },
    }),
  ]);
}

/**
 * Resend invite to member
 */
export async function resendInvite(
  inviteId: number,
  associationId: number,
  invitedById: number
): Promise<{ invite: any; token: string }> {
  const existingInvite = await prisma.memberInvite.findFirst({
    where: { id: inviteId, associationId },
    include: { member: true },
  });

  if (!existingInvite) {
    throw new Error('Invite not found');
  }

  if (existingInvite.status === 'accepted') {
    throw new Error('Invite has already been accepted');
  }

  // Create new invite (this will revoke the old one)
  return createMemberInvite({
    memberId: existingInvite.memberId,
    associationId,
    invitedById,
    email: existingInvite.email || undefined,
    phone: existingInvite.phone || undefined,
  });
}

/**
 * Get invite history for a member
 */
export async function getMemberInviteHistory(
  memberId: number,
  associationId: number
): Promise<any[]> {
  return prisma.memberInvite.findMany({
    where: { memberId, associationId },
    orderBy: { createdAt: 'desc' },
    include: {
      invitedBy: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Get all pending invites for an association
 */
export async function getPendingInvites(associationId: number): Promise<any[]> {
  return prisma.memberInvite.findMany({
    where: { associationId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          memberId: true,
        },
      },
      invitedBy: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Member Self-Registration with Auto-Linking
 * 
 * When a member self-registers:
 * 1. Check if a matching member exists (by email/phone)
 * 2. If exists and has no user, link them
 * 3. If not exists, create both member and user
 */
export async function memberSelfRegister(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  associationId: number;
}): Promise<{ user: any; member: any; isNewMember: boolean }> {
  const { email, password, firstName, lastName, phone, associationId } = data;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), associationId },
  });

  if (existingUser) {
    throw new Error('An account with this email already exists');
  }

  // Check if a member with this email/phone exists
  const existingMember = await prisma.member.findFirst({
    where: {
      associationId,
      OR: [
        { email: email.toLowerCase() },
        ...(phone ? [{ phone }] : []),
      ],
    },
  });

  const passwordHash = await hashPassword(password);

  if (existingMember) {
    // Member exists - link user to existing member
    if (existingMember.userId) {
      throw new Error('This member already has an active login account');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          associationId,
          email: email.toLowerCase(),
          passwordHash,
          role: 'member',
          isActive: false, // Requires email verification
          emailVerified: false,
          userApproval: {
            create: {
              approvalStatus: 'pending', // Requires admin approval
            },
          },
        },
      });

      // Link to existing member
      const member = await tx.member.update({
        where: { id: existingMember.id },
        data: {
          userId: user.id,
          loginStatus: 'active',
        },
      });

      return { user, member };
    });

    return { ...result, isNewMember: false };
  } else {
    // No existing member - create both member and user (a new member counts against the plan's limit)
    await assertMemberCapacity(associationId);
    const memberCount = await prisma.member.count({ where: { associationId } });
    const memberIdPrefix = (await SettingsService.getSetting(associationId, 'members_access', 'memberIdPrefix')) || 'MEM';
    const memberId = `${memberIdPrefix}${String(memberCount + 1).padStart(4, '0')}`;

    const result = await prisma.$transaction(async (tx) => {
      // Create user first
      const user = await tx.user.create({
        data: {
          associationId,
          email: email.toLowerCase(),
          passwordHash,
          role: 'member',
          isActive: false, // Requires email verification
          emailVerified: false,
          userApproval: {
            create: {
              approvalStatus: 'pending', // Requires admin approval
            },
          },
        },
      });

      // Create member linked to user
      const member = await tx.member.create({
        data: {
          associationId,
          userId: user.id,
          memberId,
          firstName,
          lastName,
          email: email.toLowerCase(),
          phone,
          status: 'active',
          loginStatus: 'active',
          joinDate: new Date(),
        },
      });

      return { user, member };
    });

    return { ...result, isNewMember: true };
  }
}

/**
 * Get members eligible for login invite
 * Returns members who don't have a user account yet
 */
export async function getInvitableMembers(
  associationId: number,
  options?: {
    search?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ members: any[]; total: number }> {
  const { search, page = 1, limit = 20 } = options || {};
  const skip = (page - 1) * limit;

  const where: any = {
    associationId,
    userId: null, // No user account
    loginStatus: { in: ['no_login', 'invited'] },
    status: { in: ['active', 'inactive'] }, // Not terminated/exited
    email: { not: null }, // Invites go out by email only
  };

  if (search) {
    where.AND = [
      {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { memberId: { contains: search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      skip,
      take: limit,
      orderBy: { firstName: 'asc' },
      include: {
        invites: {
          where: { status: 'pending' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.member.count({ where }),
  ]);

  return { members, total };
}
