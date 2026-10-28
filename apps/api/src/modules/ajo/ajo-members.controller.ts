/**
 * HTTP layer for Ajo approval, phone code, payout account and the person's verification status (T2). Thin on purpose: every rule lives in
 * the services. A person may act on their own record (`me`); officers with `ajo.manage` may act on anyone's in their association.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { RBACService } from '../../services/rbac.service';
import { PERMISSIONS } from '../../lib/permissions';
import { RuleError } from '../finance/rule-error';
import { approveMembership } from './ajo-membership.service';
import { getPayoutAccount, revealAccountNumber, setPayoutAccount } from './ajo-payout-account.service';
import { confirmPhoneCode, requestPhoneCode } from './ajo-phone-code.service';
import { latestVerification, resubmitVerification } from './ajo-verification.service';

const id = z.coerce.number().int().positive();

export function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof RuleError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: error.issues[0]?.message ?? 'Please check what you entered.', errors: error.issues });
  // The message of an unexpected error is not shown to the caller and never logged with a body: a request can carry an account number.
  console.error(`[ajo] ${fallback}:`, error instanceof Error ? error.name : 'unknown error');
  return res.status(500).json({ success: false, message: fallback });
}

export function actor(req: Request): { userId: number; associationId: number } {
  const userId = req.user?.id;
  const associationId = req.user?.associationId;
  if (!userId || !associationId) throw new RuleError('Association ID is required.', 400, 'ASSOCIATION_REQUIRED');
  return { userId, associationId };
}

export async function hasAjoPermission(req: Request, permission: string): Promise<boolean> {
  const { userId, associationId } = actor(req);
  return RBACService.hasPermission({ userId, associationId, platformRole: req.user?.platformRole ?? null }, permission);
}

export const canManage = (req: Request): Promise<boolean> => hasAjoPermission(req, PERMISSIONS.AJO_MANAGE);

/** The member row for the signed-in user. */
async function ownMemberId(req: Request): Promise<number> {
  const { userId, associationId } = actor(req);
  const member = await prisma.member.findFirst({ where: { associationId, userId }, select: { id: true } });
  if (!member) throw new RuleError('Your login is not linked to a member record.', 404, 'MEMBER_NOT_FOUND');
  return member.id;
}

/**
 * `me` means the signed-in person's own member. Any other id is allowed only for an officer with `ajo.manage`, and a person asking for
 * their own id by number is treated as themselves. Anyone else is refused.
 */
async function targetMember(req: Request): Promise<{ memberId: number; own: boolean }> {
  const raw = req.params.memberId;
  const mine = await ownMemberId(req).catch(() => null);
  if (raw === 'me') {
    if (mine === null) throw new RuleError('Your login is not linked to a member record.', 404, 'MEMBER_NOT_FOUND');
    return { memberId: mine, own: true };
  }
  const memberId = id.parse(raw);
  if (memberId === mine) return { memberId, own: true };
  if (!(await canManage(req))) throw new RuleError('You do not have permission to do that for another member.', 403, 'FORBIDDEN');
  return { memberId, own: false };
}

const accountSchema = z.object({
  bankName: z.string().trim().min(2).max(80),
  accountNumber: z.string().trim().min(1).max(40),
  accountName: z.string().trim().min(2).max(120),
});
const codeSchema = z.object({ code: z.string().trim().min(1).max(12) });

export const ajoMembersController = {
  /** POST /memberships/:id/approve: the group's approval (ajo.manage). */
  async approve(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const result = await approveMembership({ associationId, membershipId: id.parse(req.params.id), actorUserId: userId });
      const message = result.activated
        ? 'Approved. They can now take part.'
        : result.blockedByLimit
          ? `Approved, but ${result.blockedByLimit.message} Approve again once the plan has room.`
          : 'Approved. They are not active yet: they still need to confirm their phone.';
      return res.json({ success: true, message, data: result });
    } catch (error) {
      return fail(res, error, 'Could not approve this member.');
    }
  },

  /** POST /memberships/:id/phone-code: text the member a code (the member, or an officer helping them). */
  async sendPhoneCode(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertSelfOrManager(req, membershipId);
      const sent = await requestPhoneCode({ associationId, membershipId });
      return res.json({ success: true, message: `A code was sent to ${sent.sentTo}.`, data: sent });
    } catch (error) {
      return fail(res, error, 'Could not send the code.');
    }
  },

  /** POST /memberships/:id/phone-code/confirm */
  async confirmCode(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertSelfOrManager(req, membershipId);
      const { code } = codeSchema.parse(req.body);
      const done = await confirmPhoneCode({ associationId, membershipId, code, actorUserId: userId });
      return res.json({ success: true, message: done.activation.activated ? 'Phone confirmed. You are in.' : 'Phone confirmed.', data: done });
    } catch (error) {
      return fail(res, error, 'Could not confirm the code.');
    }
  },

  /** GET /members/:memberId/payout-account (masked) */
  async getAccount(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const { memberId } = await targetMember(req);
      return res.json({ success: true, data: await getPayoutAccount({ associationId, memberId }) });
    } catch (error) {
      return fail(res, error, 'Could not load the payout account.');
    }
  },

  /** PUT /members/:memberId/payout-account */
  async setAccount(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const { memberId } = await targetMember(req);
      const body = accountSchema.parse(req.body);
      const result = await setPayoutAccount({ associationId, memberId, actorUserId: userId, ...body });
      return res.json({ success: true, message: result.replayed ? 'Nothing changed.' : 'Payout account saved.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not save the payout account.');
    }
  },

  /** POST /members/:memberId/payout-account/reveal: the full number, audited. */
  async reveal(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const { memberId } = await targetMember(req);
      const accountNumber = await revealAccountNumber({ associationId, memberId, actorUserId: userId });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: { accountNumber } });
    } catch (error) {
      return fail(res, error, 'Could not show the account number.');
    }
  },

  /** GET /members/:memberId/verification: where SocietyLedger's check stands, and why if it was rejected. */
  async verificationStatus(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const { memberId } = await targetMember(req);
      const latest = await latestVerification(prisma, associationId, memberId);
      return res.json({
        success: true,
        data: latest ? { status: latest.status, rejectionReason: latest.rejectionReason, reviewedAt: latest.reviewedAt } : { status: 'NOT_REQUESTED', rejectionReason: null, reviewedAt: null },
      });
    } catch (error) {
      return fail(res, error, 'Could not load the verification status.');
    }
  },

  /** POST /members/:memberId/verification/resubmit (ajo.manage): after a rejection has been fixed. */
  async resubmit(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const result = await resubmitVerification({ associationId, memberId: id.parse(req.params.memberId), actorUserId: userId });
      return res.json({ success: true, message: result.replayed ? 'Already waiting for SocietyLedger to check.' : 'Sent to SocietyLedger to check again.', data: { status: result.row.status } });
    } catch (error) {
      return fail(res, error, 'Could not send this for verification.');
    }
  },
};

/** The member themselves, or an officer with ajo.manage, may act on a membership's phone confirmation. */
export async function assertSelfOrManager(req: Request, membershipId: number): Promise<void> {
  const { userId, associationId } = actor(req);
  const membership = await prisma.ajoMembership.findFirst({ where: { id: membershipId, associationId }, select: { member: { select: { userId: true } } } });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  if (membership.member.userId === userId) return;
  if (!(await canManage(req))) throw new RuleError('You do not have permission to do that for another member.', 403, 'FORBIDDEN');
}
