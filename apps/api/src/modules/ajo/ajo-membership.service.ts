/**
 * Ajo memberships: adding a person to a group, the group's approval of them, and the moment they become ACTIVE (T2.1, T3.3).
 *
 * Approval is one condition, not the whole story. A membership is ACTIVE only when every requirement is met; `unmetRequirements` is the one
 * place that lists them: the group's approval, the phone confirmation (if the group asks for it), acceptance of the group's rules, and the
 * guarantor's recorded consent (if the rules require one). Activation checks the tenant's contributor limit inside the same transaction,
 * behind a lock (see ajo-capacity.ts).
 *
 * Who can still join depends on the group: DRAFT takes nobody; OPEN takes anyone; an ACTIVE collector-thrift group takes late joiners
 * (unless the admin switched that off); an ACTIVE rotating pot is frozen, because its order and round dates are fixed.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { normalizePhone } from '../sms/sms-rules';
import { AjoContributorLimitError, assertContributorCapacity } from './ajo-capacity';
import { currentRuleVersion } from './ajo-rules.service';
import { syncMembershipSchedule } from './ajo-schedule.service';
import { auditAjo, notifyUser } from './ajo-support';
import { ensureVerificationRequested } from './ajo-verification.service';

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export type Requirement = 'APPROVAL' | 'PHONE_CONFIRMATION' | 'RULE_ACCEPTANCE' | 'GUARANTOR_CONSENT';

export interface RequirementFacts {
  approvedAt: Date | null;
  requirePhoneConfirm: boolean;
  phoneConfirmedNumber: string | null;
  /** The member's phone as it is on file now. */
  memberPhone: string | null;
  /** The newest rule version that has taken effect, and the newest one this person accepted. Left out (or null) for a group with no rules. */
  currentRuleVersion?: number | null;
  acceptedRuleVersion?: number | null;
  /** The guarantor policy of the current rules, and when the guarantor's consent was recorded. */
  guarantorPolicy?: string | null;
  guarantorConsentAt?: Date | null;
}

/**
 * Pure: what is still missing before a membership can be ACTIVE. A phone confirmation only counts for the number it was made on; if the
 * person's number has changed since, they must confirm the new one. Accepting a NEWER rule version than the current one also counts.
 */
export function unmetRequirements(facts: RequirementFacts): Requirement[] {
  const unmet: Requirement[] = [];
  if (!facts.approvedAt) unmet.push('APPROVAL');
  if (facts.requirePhoneConfirm) {
    const current = normalizePhone(facts.memberPhone);
    if (!current || facts.phoneConfirmedNumber !== current) unmet.push('PHONE_CONFIRMATION');
  }
  if (facts.currentRuleVersion != null && (facts.acceptedRuleVersion == null || facts.acceptedRuleVersion < facts.currentRuleVersion)) unmet.push('RULE_ACCEPTANCE');
  if (facts.guarantorPolicy === 'REQUIRED' && !facts.guarantorConsentAt) unmet.push('GUARANTOR_CONSENT');
  return unmet;
}

export const REQUIREMENT_TEXT: Record<Requirement, string> = {
  APPROVAL: 'waiting for an officer to approve them',
  PHONE_CONFIRMATION: 'waiting for them to confirm their phone number',
  RULE_ACCEPTANCE: "waiting for them to accept the group's rules",
  GUARANTOR_CONSENT: "waiting for their guarantor's consent to be recorded",
};

/** Read everything `unmetRequirements` needs for one membership. The one loader every caller uses, so no caller can forget a requirement. */
export async function loadRequirementFacts(db: Db, membershipId: number, now: Date = new Date()): Promise<RequirementFacts & { groupId: number }> {
  const m = await db.ajoMembership.findUniqueOrThrow({
    where: { id: membershipId },
    include: {
      group: { select: { requirePhoneConfirm: true } },
      member: { select: { phone: true } },
      guarantorAgreement: { select: { acceptedAt: true } },
      acceptances: { select: { ruleVersion: { select: { version: true } } } },
    },
  });
  const current = await currentRuleVersion(db, m.groupId, now);
  return {
    groupId: m.groupId,
    approvedAt: m.approvedAt,
    requirePhoneConfirm: m.group.requirePhoneConfirm,
    phoneConfirmedNumber: m.phoneConfirmedNumber,
    memberPhone: m.member.phone,
    currentRuleVersion: current?.version ?? null,
    acceptedRuleVersion: m.acceptances.reduce<number | null>((best, a) => (best === null || a.ruleVersion.version > best ? a.ruleVersion.version : best), null),
    guarantorPolicy: current?.guarantorPolicy ?? null,
    guarantorConsentAt: m.guarantorAgreement?.acceptedAt ?? null,
  };
}

export interface ActivationOutcome {
  status: 'PENDING' | 'ACTIVE';
  activated: boolean;
  unmet: Requirement[];
  /** Set when everything else is met but the tenant's Ajo plan has no room for another contributor. */
  blockedByLimit: { code: 'AJO_CONTRIBUTOR_LIMIT'; limit: number; count: number; message: string } | null;
}

/** A group that has started no longer takes everyone: a rotating pot is frozen, and a thrift group may have switched late joining off. */
export function assertGroupTakesJoiners(group: { status: string; model: string; allowLateJoin: boolean }): void {
  if (group.status === 'DRAFT') throw new RuleError('This group is not open yet, so no one can be added.', 409, 'GROUP_NOT_OPEN');
  if (group.status === 'COMPLETED' || group.status === 'CANCELLED') throw new RuleError('This group is closed, so no one can be added.', 409, 'GROUP_CLOSED');
  if (group.status === 'ACTIVE') {
    if (group.model === 'ROTATING_POT') throw new RuleError('This rotating pot has started and its order is fixed, so no one can join it now.', 409, 'ROSTER_FROZEN');
    if (!group.allowLateJoin) throw new RuleError('This group has started and is not taking late joiners.', 409, 'LATE_JOIN_CLOSED');
  }
}

/**
 * Move a PENDING membership to ACTIVE if every requirement is met and the plan has room. Runs in the caller's transaction. Safe to call
 * again: an ACTIVE membership stays as it is. Running out of room is reported, not thrown, so the approval that led here still stands and
 * the officer can try again after moving to a bigger tier. In a group that has already started, the person's schedule is created now.
 */
export async function tryActivate(tx: Tx, input: { associationId: number; membershipId: number; actorUserId: number; now?: Date }): Promise<ActivationOutcome> {
  const now = input.now ?? new Date();
  const membership = await tx.ajoMembership.findFirst({
    where: { id: input.membershipId, associationId: input.associationId },
    include: { group: { select: { id: true, status: true, model: true, allowLateJoin: true } } },
  });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  if (membership.status === 'ACTIVE') return { status: 'ACTIVE', activated: false, unmet: [], blockedByLimit: null };
  if (membership.status !== 'PENDING') {
    throw new RuleError(`A ${membership.status.toLowerCase()} membership cannot be activated here.`, 409, 'INVALID_MEMBERSHIP_STATE');
  }

  const unmet = unmetRequirements(await loadRequirementFacts(tx, membership.id, now));
  if (unmet.length) return { status: 'PENDING', activated: false, unmet, blockedByLimit: null };
  assertGroupTakesJoiners(membership.group);

  try {
    await assertContributorCapacity(tx, input.associationId, membership.memberId);
  } catch (error) {
    if (error instanceof AjoContributorLimitError) {
      return { status: 'PENDING', activated: false, unmet: [], blockedByLimit: { code: error.code, limit: error.limit, count: error.currentCount, message: error.message } };
    }
    throw error;
  }

  // The status guard makes a second activation at the same moment a no-op rather than a duplicate audit entry.
  const updated = await tx.ajoMembership.updateMany({ where: { id: membership.id, status: 'PENDING' }, data: { status: 'ACTIVE', joinedAt: now } });
  if (updated.count === 1) {
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_MEMBERSHIP_ACTIVATED', tableName: 'ajo_memberships', recordId: membership.id, oldValues: { status: 'PENDING' }, newValues: { status: 'ACTIVE' } });
    if (membership.group.status === 'ACTIVE') await syncMembershipSchedule(tx, { groupId: membership.group.id, membershipId: membership.id, now });
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

/** Seats taken in a group: everyone who has not left. A pending person holds a seat. */
export const seatsTaken = (db: Db, groupId: number) => db.ajoMembership.count({ where: { groupId, status: { not: 'LEFT' } } });

/**
 * Add an existing member to a group, pending. The group and the member must both belong to the association. `shares` matters only in a
 * rotating pot (default 1, up to the group's limit). A seat is a place in this group; the plan's contributor limit is a separate check
 * that happens at activation.
 */
export async function addMember(input: { associationId: number; groupId: number; memberId: number; actorUserId: number; shares?: number }) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId }, select: { id: true, status: true, model: true, allowLateJoin: true, maxParticipants: true, maxSharesPerMember: true } });
    // Another association's group is reported as missing, never as forbidden.
    if (!group) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
    assertGroupTakesJoiners(group);

    const shares = input.shares ?? 1;
    assertShares(group, shares);

    const member = await tx.member.findFirst({ where: { id: input.memberId, associationId: input.associationId }, select: { id: true, status: true } });
    if (!member) throw new RuleError('That member was not found.', 404, 'MEMBER_NOT_FOUND');
    if (member.status !== 'active') throw new RuleError('Only an active member can be added to a group.', 409, 'MEMBER_NOT_ACTIVE');

    // Seats are counted behind a lock on the group, so two officers adding the last two people at once cannot both fit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ajo-seats:' + group.id}))`;
    const taken = await seatsTaken(tx, group.id);
    if (taken >= group.maxParticipants) throw new RuleError(`This group is full (${group.maxParticipants} participants).`, 409, 'GROUP_FULL');

    try {
      // A person who left can be added again: their old row comes back as a fresh pending one.
      const left = await tx.ajoMembership.findUnique({ where: { groupId_memberId: { groupId: group.id, memberId: member.id } } });
      if (left && left.status !== 'LEFT') throw new RuleError('This member is already in the group.', 409, 'ALREADY_IN_GROUP');
      const membership = left
        ? await tx.ajoMembership.update({ where: { id: left.id }, data: { status: 'PENDING', leftAt: null, joinedAt: null, approvedAt: null, approvedBy: null, shares, phoneConfirmedAt: null, phoneConfirmedNumber: null, guarantorAgreementId: null } })
        : await tx.ajoMembership.create({ data: { associationId: input.associationId, groupId: group.id, memberId: member.id, shares } });
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_MEMBER_ADDED', tableName: 'ajo_memberships', recordId: membership.id, newValues: { groupId: group.id, memberId: member.id, status: 'PENDING', shares, rejoined: left !== null } });
      return membership;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new RuleError('This member is already in the group.', 409, 'ALREADY_IN_GROUP');
      }
      throw error;
    }
  });
}

function assertShares(group: { model: string; maxSharesPerMember: number }, shares: number): void {
  if (!Number.isInteger(shares) || shares < 1) throw new RuleError('Shares must be a whole number of at least 1.', 400, 'INVALID_SHARES');
  if (group.model !== 'ROTATING_POT' && shares !== 1) throw new RuleError('Only a rotating pot has shares. In collector thrift, a person who wants to save more sets a higher contribution.', 400, 'SHARES_NOT_USED');
  if (shares > group.maxSharesPerMember) throw new RuleError(`One person can hold at most ${group.maxSharesPerMember} share${group.maxSharesPerMember === 1 ? '' : 's'} in this group.`, 400, 'TOO_MANY_SHARES');
}

/** Change a person's shares. Only before the group starts: after that the pot and everyone's instalments are fixed. */
export async function setShares(input: { associationId: number; membershipId: number; shares: number; actorUserId: number }) {
  return prisma.$transaction(async (tx) => {
    const m = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, include: { group: { select: { status: true, model: true, maxSharesPerMember: true } } } });
    if (!m) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
    if (m.group.status !== 'DRAFT' && m.group.status !== 'OPEN') throw new RuleError('Shares are fixed once a group has started.', 409, 'GROUP_LOCKED');
    if (m.status === 'LEFT') throw new RuleError('This person has left the group.', 409, 'INVALID_MEMBERSHIP_STATE');
    assertShares(m.group, input.shares);
    if (m.shares === input.shares) return { membershipId: m.id, shares: m.shares, replayed: true };
    await tx.ajoMembership.update({ where: { id: m.id }, data: { shares: input.shares } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_SHARES_CHANGED', tableName: 'ajo_memberships', recordId: m.id, oldValues: { shares: m.shares }, newValues: { shares: input.shares } });
    return { membershipId: m.id, shares: input.shares, replayed: false };
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
export async function approveMembership(input: { associationId: number; membershipId: number; actorUserId: number; now?: Date }): Promise<ApproveResult> {
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

    const outcome = await tryActivate(tx, { associationId: input.associationId, membershipId: membership.id, actorUserId: input.actorUserId, now: input.now });
    return { ...outcome, membershipId: membership.id, approvedAt, replayed };
  });

  if (result.activated) await notifyActivated(input.associationId, input.membershipId);
  return result;
}

/**
 * A person leaves (or is removed from) a group. Instalments still ahead that nothing has been paid against are removed; anything with
 * money against it stays exactly as it is. In a rotating pot that has started, leaving is a default matter (T8), not a button.
 */
export async function leaveMembership(input: { associationId: number; membershipId: number; actorUserId: number; reason?: string; now?: Date }) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const m = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, include: { group: { select: { id: true, status: true, model: true } } } });
    if (!m) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
    if (m.status === 'LEFT') return { membershipId: m.id, status: 'LEFT' as const, replayed: true };
    if (m.group.status === 'ACTIVE' && m.group.model === 'ROTATING_POT') {
      throw new RuleError('This rotating pot has started, so a participant cannot simply leave: the group owes them and they owe the group. Use the default process.', 409, 'USE_DEFAULT_PROCESS');
    }
    await tx.ajoMembership.update({ where: { id: m.id }, data: { status: 'LEFT', leftAt: now } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_MEMBER_LEFT', tableName: 'ajo_memberships', recordId: m.id, oldValues: { status: m.status }, newValues: { status: 'LEFT', reason: input.reason ?? null } });
    if (m.group.status === 'ACTIVE') await syncMembershipSchedule(tx, { groupId: m.group.id, membershipId: m.id, now });
    return { membershipId: m.id, status: 'LEFT' as const, replayed: false };
  });
}

/**
 * The guard for contributing and for being scheduled. An unapproved person (or one still missing a requirement) cannot be given a schedule
 * or record a contribution. T4 calls this before it writes either.
 */
export async function assertCanContribute(db: Tx | typeof prisma, input: { associationId: number; membershipId: number }): Promise<void> {
  const membership = await db.ajoMembership.findFirst({
    where: { id: input.membershipId, associationId: input.associationId },
    include: { group: { select: { status: true } } },
  });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  if ((CLOSED_GROUP as readonly string[]).includes(membership.group.status)) throw new RuleError('This group is closed.', 409, 'GROUP_CLOSED');
  if (membership.status === 'ACTIVE') return;

  if (membership.status === 'PENDING') {
    const unmet = unmetRequirements(await loadRequirementFacts(db, membership.id));
    const why = unmet.length ? unmet.map((u) => REQUIREMENT_TEXT[u]).join(' and ') : 'waiting for room on the group plan';
    throw new RuleError(`This person cannot take part yet: ${why}.`, 403, 'MEMBERSHIP_NOT_ACTIVE');
  }
  throw new RuleError(`This person's membership is ${membership.status.toLowerCase()}, so they cannot take part.`, 403, 'MEMBERSHIP_NOT_ACTIVE');
}
