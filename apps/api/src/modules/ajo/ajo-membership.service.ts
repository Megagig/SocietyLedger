/**
 * Ajo memberships: adding a person to a group, the group's approval of them, and the moment they become ACTIVE (T2.1).
 *
 * Approval is one condition, not the whole story. A membership is ACTIVE only when every requirement is met; `unmetRequirements` is the one
 * place that lists them. T2 knows approval and (when the group asks for it) phone confirmation. Rule acceptance and guarantor consent are
 * added to that list in T3, and nothing that calls this changes. Activation checks the tenant's contributor limit inside the same
 * transaction, behind a lock (see ajo-capacity.ts).
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { normalizePhone } from '../sms/sms-rules';
import { AjoContributorLimitError, assertContributorCapacity } from './ajo-capacity';
import { auditAjo, notifyUser } from './ajo-support';
import { ensureVerificationRequested } from './ajo-verification.service';

type Tx = Prisma.TransactionClient;

export type Requirement = 'APPROVAL' | 'PHONE_CONFIRMATION';

export interface RequirementFacts {
  approvedAt: Date | null;
  requirePhoneConfirm: boolean;
  phoneConfirmedNumber: string | null;
  /** The member's phone as it is on file now. */
  memberPhone: string | null;
}

/**
 * Pure: what is still missing before a membership can be ACTIVE. A phone confirmation only counts for the number it was made on; if the
 * person's number has changed since, they must confirm the new one.
 */
export function unmetRequirements(facts: RequirementFacts): Requirement[] {
  const unmet: Requirement[] = [];
  if (!facts.approvedAt) unmet.push('APPROVAL');
  if (facts.requirePhoneConfirm) {
    const current = normalizePhone(facts.memberPhone);
    if (!current || facts.phoneConfirmedNumber !== current) unmet.push('PHONE_CONFIRMATION');
  }
  return unmet;
}

export const REQUIREMENT_TEXT: Record<Requirement, string> = {
  APPROVAL: 'waiting for an officer to approve them',
  PHONE_CONFIRMATION: 'waiting for them to confirm their phone number',
};

export interface ActivationOutcome {
  status: 'PENDING' | 'ACTIVE';
  activated: boolean;
  unmet: Requirement[];
  /** Set when everything else is met but the tenant's Ajo plan has no room for another contributor. */
  blockedByLimit: { code: 'AJO_CONTRIBUTOR_LIMIT'; limit: number; count: number; message: string } | null;
}

/**
 * Move a PENDING membership to ACTIVE if every requirement is met and the plan has room. Runs in the caller's transaction. Safe to call
 * again: an ACTIVE membership stays as it is. Running out of room is reported, not thrown, so the approval that led here still stands and
 * the officer can try again after moving to a bigger tier.
 */
export async function tryActivate(tx: Tx, input: { associationId: number; membershipId: number; actorUserId: number }): Promise<ActivationOutcome> {
  const membership = await tx.ajoMembership.findFirst({
    where: { id: input.membershipId, associationId: input.associationId },
    include: { group: { select: { requirePhoneConfirm: true } }, member: { select: { id: true, phone: true } } },
  });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  if (membership.status === 'ACTIVE') return { status: 'ACTIVE', activated: false, unmet: [], blockedByLimit: null };
  if (membership.status !== 'PENDING') {
    throw new RuleError(`A ${membership.status.toLowerCase()} membership cannot be activated here.`, 409, 'INVALID_MEMBERSHIP_STATE');
  }

  const unmet = unmetRequirements({
    approvedAt: membership.approvedAt,
    requirePhoneConfirm: membership.group.requirePhoneConfirm,
    phoneConfirmedNumber: membership.phoneConfirmedNumber,
    memberPhone: membership.member.phone,
  });
  if (unmet.length) return { status: 'PENDING', activated: false, unmet, blockedByLimit: null };

  try {
    await assertContributorCapacity(tx, input.associationId, membership.memberId);
  } catch (error) {
    if (error instanceof AjoContributorLimitError) {
      return { status: 'PENDING', activated: false, unmet: [], blockedByLimit: { code: error.code, limit: error.limit, count: error.currentCount, message: error.message } };
    }
    throw error;
  }

  // The status guard makes a second activation at the same moment a no-op rather than a duplicate audit entry.
  const updated = await tx.ajoMembership.updateMany({ where: { id: membership.id, status: 'PENDING' }, data: { status: 'ACTIVE', joinedAt: new Date() } });
  if (updated.count === 1) {
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_MEMBERSHIP_ACTIVATED', tableName: 'ajo_memberships', recordId: membership.id, oldValues: { status: 'PENDING' }, newValues: { status: 'ACTIVE' } });
  }
  return { status: 'ACTIVE', activated: updated.count === 1, unmet: [], blockedByLimit: null };
}

/** Tell a newly active contributor. Best-effort, after the transaction has committed. */
export async function notifyActivated(associationId: number, membershipId: number): Promise<void> {
  const row = await prisma.ajoMembership.findFirst({ where: { id: membershipId, associationId }, select: { group: { select: { name: true } }, member: { select: { userId: true } } } });
  if (!row?.member.userId) return;
  await notifyUser(associationId, row.member.userId, { pushType: 'ajo.membership_approved', entityId: membershipId, title: 'You are in', message: `You can now contribute to ${row.group.name}.` });
}

// ---------------------------------------------------------------------------------------------------------------------------------

const CLOSED_GROUP = ['COMPLETED', 'CANCELLED'] as const;

/** Add an existing member to a group, pending. The group and the member must both belong to the association. */
export async function addMember(input: { associationId: number; groupId: number; memberId: number; actorUserId: number }) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId }, select: { id: true, status: true, maxParticipants: true } });
    // Another association's group is reported as missing, never as forbidden.
    if (!group) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
    if ((CLOSED_GROUP as readonly string[]).includes(group.status)) throw new RuleError('This group is closed, so no one can be added.', 409, 'GROUP_CLOSED');

    const member = await tx.member.findFirst({ where: { id: input.memberId, associationId: input.associationId }, select: { id: true, status: true } });
    if (!member) throw new RuleError('That member was not found.', 404, 'MEMBER_NOT_FOUND');
    if (member.status !== 'active') throw new RuleError('Only an active member can be added to a group.', 409, 'MEMBER_NOT_ACTIVE');

    const taken = await tx.ajoMembership.count({ where: { groupId: group.id, status: { not: 'LEFT' } } });
    if (taken >= group.maxParticipants) throw new RuleError(`This group is full (${group.maxParticipants} participants).`, 409, 'GROUP_FULL');

    try {
      const membership = await tx.ajoMembership.create({ data: { associationId: input.associationId, groupId: group.id, memberId: member.id } });
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_MEMBER_ADDED', tableName: 'ajo_memberships', recordId: membership.id, newValues: { groupId: group.id, memberId: member.id, status: 'PENDING' } });
      return membership;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new RuleError('This member is already in the group.', 409, 'ALREADY_IN_GROUP');
      }
      throw error;
    }
  });
}

export interface ApproveResult extends ActivationOutcome {
  membershipId: number;
  approvedAt: Date | null;
  /** True when this membership had already been approved: nothing was recorded twice. */
  replayed: boolean;
}

/**
 * The group's approval (step one). Records who approved and when, puts the person in SocietyLedger's verification queue, and activates the
 * membership if nothing else is missing. Asking again is safe: the approval is not recorded twice, and activation is tried again, which is
 * how an officer completes a membership that was held up by the plan's contributor limit. Nobody can approve their own membership.
 */
export async function approveMembership(input: { associationId: number; membershipId: number; actorUserId: number }): Promise<ApproveResult> {
  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.ajoMembership.findFirst({
      where: { id: input.membershipId, associationId: input.associationId },
      include: { member: { select: { userId: true } } },
    });
    if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
    if (membership.status !== 'PENDING' && membership.status !== 'ACTIVE') {
      throw new RuleError(`A ${membership.status.toLowerCase()} membership cannot be approved.`, 409, 'INVALID_MEMBERSHIP_STATE');
    }
    if (membership.member.userId === input.actorUserId) {
      throw new RuleError('You cannot approve your own membership. Ask another officer.', 403, 'SELF_APPROVAL');
    }

    const replayed = membership.approvedAt !== null;
    let approvedAt = membership.approvedAt;
    if (!replayed) {
      approvedAt = new Date();
      await tx.ajoMembership.update({ where: { id: membership.id }, data: { approvedBy: input.actorUserId, approvedAt } });
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_MEMBERSHIP_APPROVED', tableName: 'ajo_memberships', recordId: membership.id, oldValues: { approved: false }, newValues: { approved: true, approvedBy: input.actorUserId } });
      await ensureVerificationRequested(tx, { associationId: input.associationId, memberId: membership.memberId });
    }

    const outcome = await tryActivate(tx, { associationId: input.associationId, membershipId: membership.id, actorUserId: input.actorUserId });
    return { ...outcome, membershipId: membership.id, approvedAt, replayed };
  });

  if (result.activated) await notifyActivated(input.associationId, input.membershipId);
  return result;
}

/**
 * The guard for contributing and for being scheduled. An unapproved person (or one still missing a requirement) cannot be given a schedule
 * or record a contribution. T4 calls this before it writes either.
 */
export async function assertCanContribute(db: Tx | typeof prisma, input: { associationId: number; membershipId: number }): Promise<void> {
  const membership = await db.ajoMembership.findFirst({
    where: { id: input.membershipId, associationId: input.associationId },
    include: { group: { select: { status: true, requirePhoneConfirm: true } }, member: { select: { phone: true } } },
  });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  if ((CLOSED_GROUP as readonly string[]).includes(membership.group.status)) throw new RuleError('This group is closed.', 409, 'GROUP_CLOSED');
  if (membership.status === 'ACTIVE') return;

  if (membership.status === 'PENDING') {
    const unmet = unmetRequirements({
      approvedAt: membership.approvedAt,
      requirePhoneConfirm: membership.group.requirePhoneConfirm,
      phoneConfirmedNumber: membership.phoneConfirmedNumber,
      memberPhone: membership.member.phone,
    });
    const why = unmet.length ? unmet.map((u) => REQUIREMENT_TEXT[u]).join(' and ') : 'waiting for room on the group plan';
    throw new RuleError(`This person cannot take part yet: ${why}.`, 403, 'MEMBERSHIP_NOT_ACTIVE');
  }
  throw new RuleError(`This person's membership is ${membership.status.toLowerCase()}, so they cannot take part.`, 403, 'MEMBERSHIP_NOT_ACTIVE');
}
