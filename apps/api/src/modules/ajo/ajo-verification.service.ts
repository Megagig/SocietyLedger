/**
 * SocietyLedger verification: the second step of joining an Ajo group (T2.3).
 *
 * Step one is the group's officer approving a person. Step two is this: SocietyLedger staff check what the person submitted (name, phone,
 * address, payout account name) against a short checklist. No ID numbers and no ID photos are collected.
 *
 * "Verified" belongs to the person (the Member), not to one group, and is the latest AjoVerification row. A decided row is never edited:
 * a rejection followed by a fix is a new PENDING row. Verification gates PAYOUTS only; contributing needs the group's approval alone.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { auditAjo, notifyPermissionHolders, notifyUser } from './ajo-support';
import { maskAccount } from './ajo-secrets';

type Tx = Prisma.TransactionClient;

export const MIN_REJECTION_REASON = 10;

export interface VerificationChecklist {
  nameMatchesAccount: boolean;
  phoneConfirmed: boolean;
  addressFilled: boolean;
}

async function snapshotOf(db: Tx, associationId: number, memberId: number) {
  const member = await db.member.findFirst({ where: { id: memberId, associationId }, select: { firstName: true, lastName: true, phone: true, address: true } });
  if (!member) throw new RuleError('That member was not found.', 404, 'MEMBER_NOT_FOUND');
  const account = await db.ajoPayoutAccount.findUnique({ where: { memberId }, select: { accountName: true } });
  return {
    submittedName: `${member.firstName} ${member.lastName}`.trim(),
    submittedPhone: member.phone,
    submittedAddress: member.address,
    submittedAccountName: account?.accountName ?? null,
  };
}

/** The most recent verification row for a person, or null if they have never been put forward. */
export async function latestVerification(db: Pick<Tx, 'ajoVerification'>, associationId: number, memberId: number) {
  return db.ajoVerification.findFirst({ where: { associationId, memberId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
}

/**
 * Called when a group approves a person. Makes sure there is a pending review to look at: creates the first one, or refreshes the
 * snapshot of one that is still pending. A person already verified, or rejected and waiting to fix something, is left alone.
 */
export async function ensureVerificationRequested(tx: Tx, input: { associationId: number; memberId: number }) {
  const latest = await latestVerification(tx, input.associationId, input.memberId);
  const snapshot = await snapshotOf(tx, input.associationId, input.memberId);
  if (!latest) return { created: true, row: await tx.ajoVerification.create({ data: { associationId: input.associationId, memberId: input.memberId, ...snapshot } }) };
  if (latest.status === 'PENDING') return { created: false, row: await tx.ajoVerification.update({ where: { id: latest.id }, data: snapshot }) };
  return { created: false, row: latest };
}

/** After a rejection and a fix: put the person back in the queue. Asking twice while pending changes nothing. */
export async function resubmitVerification(input: { associationId: number; memberId: number; actorUserId: number }) {
  return prisma.$transaction(async (tx) => {
    const latest = await latestVerification(tx, input.associationId, input.memberId);
    if (!latest) throw new RuleError('This person has not been put forward for verification yet. Approve them in a group first.', 409, 'VERIFICATION_NOT_REQUESTED');
    if (latest.status === 'PENDING') return { row: latest, replayed: true };
    if (latest.status === 'VERIFIED') throw new RuleError('This person is already verified.', 409, 'ALREADY_VERIFIED');
    const snapshot = await snapshotOf(tx, input.associationId, input.memberId);
    const row = await tx.ajoVerification.create({ data: { associationId: input.associationId, memberId: input.memberId, ...snapshot } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_VERIFICATION_RESUBMITTED', tableName: 'ajo_verifications', recordId: row.id, oldValues: { status: latest.status }, newValues: { status: 'PENDING' } });
    return { row, replayed: false };
  });
}

/**
 * A payout account changed. Verified or rejected people go back to pending (a new row); a pending one just gets a fresh snapshot, because
 * nobody has looked at it yet. Someone never put forward is left alone: the row is created when a group approves them.
 */
export async function resetVerificationForAccountChange(tx: Tx, input: { associationId: number; memberId: number }): Promise<'NONE' | 'REFRESHED' | 'RESET'> {
  const latest = await latestVerification(tx, input.associationId, input.memberId);
  if (!latest) return 'NONE';
  const snapshot = await snapshotOf(tx, input.associationId, input.memberId);
  if (latest.status === 'PENDING') {
    await tx.ajoVerification.update({ where: { id: latest.id }, data: snapshot });
    return 'REFRESHED';
  }
  await tx.ajoVerification.create({ data: { associationId: input.associationId, memberId: input.memberId, ...snapshot } });
  return 'RESET';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Staff review (admin console)
// ---------------------------------------------------------------------------------------------------------------------------------

const memberSelect = { id: true, firstName: true, lastName: true, phone: true, address: true, userId: true, association: { select: { id: true, name: true } } } as const;

export async function listVerificationQueue(input: { status?: 'PENDING' | 'VERIFIED' | 'REJECTED'; associationId?: number; take?: number; skip?: number }) {
  const where: Prisma.AjoVerificationWhereInput = { ...(input.status ? { status: input.status } : {}), ...(input.associationId ? { associationId: input.associationId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.ajoVerification.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(input.take ?? 25, 1), 100),
      skip: Math.max(input.skip ?? 0, 0),
      include: { member: { select: memberSelect } },
    }),
    prisma.ajoVerification.count({ where }),
  ]);
  const accounts = await prisma.ajoPayoutAccount.findMany({ where: { memberId: { in: rows.map((r) => r.memberId) } }, select: { memberId: true, last4: true, bankName: true } });
  const byMember = new Map(accounts.map((a) => [a.memberId, a]));
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      association: r.member.association,
      memberId: r.memberId,
      name: r.submittedName,
      hasPayoutAccount: byMember.has(r.memberId),
      payoutAccount: byMember.has(r.memberId) ? { bankName: byMember.get(r.memberId)!.bankName, masked: maskAccount(byMember.get(r.memberId)!.last4) } : null,
    })),
  };
}

/** Everything a reviewer needs for one person: what is on file right now, the account name to compare, and earlier decisions. */
export async function getVerificationDetail(id: number) {
  const row = await prisma.ajoVerification.findUnique({ where: { id }, include: { member: { select: memberSelect } } });
  if (!row) throw new RuleError('That verification was not found.', 404, 'VERIFICATION_NOT_FOUND');
  const [account, history] = await Promise.all([
    prisma.ajoPayoutAccount.findUnique({ where: { memberId: row.memberId }, select: { bankName: true, accountName: true, last4: true, changedAt: true } }),
    prisma.ajoVerification.findMany({ where: { memberId: row.memberId, id: { not: id } }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, rejectionReason: true, reviewedAt: true, createdAt: true } }),
  ]);
  const m = row.member;
  return {
    id: row.id,
    status: row.status,
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt,
    association: m.association,
    // Live values: what is on file now. A pending review decides on these, not on the snapshot taken when the group approved.
    current: {
      name: `${m.firstName} ${m.lastName}`.trim(),
      phone: m.phone,
      address: m.address,
      payoutAccountName: account?.accountName ?? null,
      payoutAccount: account ? { bankName: account.bankName, masked: maskAccount(account.last4), changedAt: account.changedAt } : null,
    },
    checklist: { nameMatchesAccount: row.nameMatchesAccount, phoneConfirmed: row.phoneConfirmed, addressFilled: row.addressFilled },
    history,
  };
}

export interface DecideInput {
  verificationId: number;
  reviewerId: number;
  reviewerRole: string;
  decision: 'VERIFIED' | 'REJECTED';
  checklist: VerificationChecklist;
  reason?: string | null;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Staff decision. VERIFIED needs all three checklist answers yes; REJECTED needs a written reason the group's admin will see. A person
 * with no payout account cannot be decided, because there is no account name to compare. Deciding twice is refused, not repeated.
 */
export async function decideVerification(input: DecideInput) {
  const reason = (input.reason ?? '').trim();
  if (input.decision === 'REJECTED' && reason.length < MIN_REJECTION_REASON) {
    throw new RuleError(`Give a reason of at least ${MIN_REJECTION_REASON} characters, so the group admin knows what to fix.`, 400, 'REASON_REQUIRED');
  }
  const { nameMatchesAccount, phoneConfirmed, addressFilled } = input.checklist;
  if (input.decision === 'VERIFIED' && !(nameMatchesAccount && phoneConfirmed && addressFilled)) {
    throw new RuleError('A person can only be verified when all three checks pass. Reject them with a reason instead.', 400, 'CHECKLIST_INCOMPLETE');
  }

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.ajoVerification.findUnique({ where: { id: input.verificationId } });
    if (!row) throw new RuleError('That verification was not found.', 404, 'VERIFICATION_NOT_FOUND');
    if (row.status !== 'PENDING') throw new RuleError(`This verification was already ${row.status.toLowerCase()}.`, 409, 'ALREADY_DECIDED');

    const account = await tx.ajoPayoutAccount.findUnique({ where: { memberId: row.memberId }, select: { accountName: true } });
    if (!account) throw new RuleError('This person has not entered a payout account yet, so there is no account name to check.', 409, 'PAYOUT_ACCOUNT_MISSING');

    const snapshot = await snapshotOf(tx, row.associationId, row.memberId);
    // The status guard in the WHERE makes a second reviewer at the same moment lose cleanly instead of overwriting the first.
    const updated = await tx.ajoVerification.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: {
        ...snapshot,
        status: input.decision,
        nameMatchesAccount,
        phoneConfirmed,
        addressFilled,
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
        rejectionReason: input.decision === 'REJECTED' ? reason : null,
      },
    });
    if (updated.count !== 1) throw new RuleError('This verification was just decided by someone else.', 409, 'ALREADY_DECIDED');

    await tx.platformActionLog.create({
      data: {
        actorId: input.reviewerId,
        actorRole: input.reviewerRole,
        actionType: input.decision === 'VERIFIED' ? 'AJO_VERIFICATION_VERIFIED' : 'AJO_VERIFICATION_REJECTED',
        targetType: 'ajo_verification',
        targetId: row.id,
        associationId: row.associationId,
        beforeState: { status: 'PENDING' },
        afterState: { status: input.decision, checklist: { nameMatchesAccount, phoneConfirmed, addressFilled } },
        reason: input.decision === 'REJECTED' ? reason : null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
    const member = await tx.member.findUnique({ where: { id: row.memberId }, select: { userId: true, firstName: true, lastName: true } });
    return { row, snapshot, member };
  });

  const name = result.snapshot.submittedName;
  const verified = input.decision === 'VERIFIED';
  const notice = {
    pushType: 'ajo.verification_status',
    entityId: result.row.id,
    title: verified ? 'Verified by SocietyLedger' : 'Verification not accepted',
    message: verified ? `${name} has been verified and can now be paid out.` : `${name} was not verified: ${reason}`,
  };
  await notifyPermissionHolders(result.row.associationId, 'ajo.manage', notice);
  if (result.member?.userId) {
    await notifyUser(result.row.associationId, result.member.userId, {
      ...notice,
      message: verified ? 'SocietyLedger has verified you. You can now be paid out.' : `SocietyLedger could not verify you: ${reason}`,
    });
  }
  return { id: result.row.id, status: input.decision };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The payout guard
// ---------------------------------------------------------------------------------------------------------------------------------

const verificationMessage: Record<string, string> = {
  NONE: 'This person has not been put forward for SocietyLedger verification.',
  PENDING: 'This person is waiting for SocietyLedger to verify them. A payout cannot be prepared or approved until they are.',
  REJECTED: 'SocietyLedger could not verify this person. A payout cannot be prepared or approved until they are verified.',
};

/**
 * T7 calls this before preparing or approving a payout (and again before recording it as paid). It refuses, with a code the apps can show,
 * when the person has no payout account, is not verified, or changed their account inside the cool-off.
 */
export async function assertPayoutEligible(db: Tx | typeof prisma, input: { associationId: number; membershipId: number; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  const membership = await db.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, select: { memberId: true } });
  // Another association's membership is reported as missing, never as forbidden.
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');

  const [account, latest] = await Promise.all([
    db.ajoPayoutAccount.findUnique({ where: { memberId: membership.memberId }, select: { coolOffUntil: true } }),
    latestVerification(db, input.associationId, membership.memberId),
  ]);
  if (!account) throw new RuleError('This person has not entered a payout account.', 409, 'PAYOUT_ACCOUNT_MISSING');
  if (!latest || latest.status !== 'VERIFIED') {
    const state = latest?.status ?? 'NONE';
    const why = state === 'REJECTED' && latest?.rejectionReason ? ` Reason: ${latest.rejectionReason}` : '';
    throw new RuleError(`${verificationMessage[state]}${why}`, 403, 'PERSON_NOT_VERIFIED');
  }
  if (account.coolOffUntil && account.coolOffUntil.getTime() > now.getTime()) {
    throw new RuleError(`This person changed their payout account recently. A payout can be approved after ${account.coolOffUntil.toISOString()}.`, 403, 'PAYOUT_COOL_OFF');
  }
}
