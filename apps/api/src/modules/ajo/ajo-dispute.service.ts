/**
 * Disputes (T6.5): a member says "I paid" about one instalment, with evidence, and an officer decides.
 *
 * While a check is open about a member (a payment waiting to be verified, or a dispute), nothing is done to them for being late: no late
 * fee, no "overdue" reminder, no default. When it ends, `lastCheckEndedAt` lets the fee rules give them one more clear day.
 * A dispute never creates money. If the claim is upheld, the officer records or confirms the payment through the normal flow, so the
 * ledger and the allocations stay the only source of truth. A decided dispute is never edited; raising it again is a new dispute.
 */
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { deleteFile, getPresignedUrl, uploadFile } from '../../lib/storage';
import { RuleError } from '../finance/rule-error';
import { MAX_PROOF_BYTES, PROOF_TYPES, formatNaira } from './ajo-collections';
import { memberOfMembership, messageMember } from './ajo-messenger';
import { auditAjo, notifyPermissionHolders } from './ajo-support';

type Db = Prisma.TransactionClient | typeof prisma;

export const MIN_CLAIM = 10;
const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export interface VerificationState {
  /** A payment of theirs is waiting for confirmation, or a dispute about them is open. */
  pending: boolean;
  pendingPayments: number;
  openDisputes: number;
  /** When the last check about them ended (a payment turned down, or a dispute decided), if any. */
  lastCheckEndedAt: Date | null;
}

/** Is anything being checked about this member right now, and when did the last check end? */
export async function verificationState(db: Db, membershipId: number): Promise<VerificationState> {
  const [pendingPayments, openDisputes, rejected, decided] = await Promise.all([
    db.ajoContribution.count({ where: { membershipId, status: { in: ['REPORTED', 'CASH_RECEIVED'] }, reversalOfId: null } }),
    db.ajoDispute.count({ where: { membershipId, status: 'OPEN' } }),
    db.ajoContribution.findFirst({ where: { membershipId, status: 'REJECTED', rejectedAt: { not: null } }, orderBy: { rejectedAt: 'desc' }, select: { rejectedAt: true } }),
    db.ajoDispute.findFirst({ where: { membershipId, status: { in: ['RESOLVED', 'REJECTED'] }, resolvedAt: { not: null } }, orderBy: { resolvedAt: 'desc' }, select: { resolvedAt: true } }),
  ]);
  const ends = [rejected?.rejectedAt, decided?.resolvedAt].filter((d): d is Date => !!d);
  const lastCheckEndedAt = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
  return { pending: pendingPayments > 0 || openDisputes > 0, pendingPayments, openDisputes, lastCheckEndedAt };
}

type DisputeRow = Prisma.AjoDisputeGetPayload<Record<string, never>>;

export function toDisputeView(d: DisputeRow) {
  return {
    id: d.id,
    membershipId: d.membershipId,
    installmentId: d.installmentId,
    contributionId: d.contributionId,
    claim: d.claim,
    hasEvidence: d.evidenceKey !== null,
    status: d.status,
    /** UPHELD when the claim was accepted, NOT_UPHELD when it was not, OPEN while undecided. */
    outcome: d.status === 'OPEN' ? 'OPEN' : d.status === 'RESOLVED' ? 'UPHELD' : 'NOT_UPHELD',
    resolution: d.resolution,
    resolvedAt: d.resolvedAt,
    raisedBy: d.raisedBy,
    createdAt: d.createdAt,
  };
}

export interface RaiseInput {
  associationId: number;
  membershipId: number;
  installmentId: number;
  claim: string;
  evidence?: { buffer: Buffer; mimeType: string };
  actorUserId: number;
  /** An officer with `ajo.manage` may raise one for someone with no login. */
  actorCanManage: boolean;
  now?: Date;
}

export async function raiseDispute(input: RaiseInput) {
  const claim = (input.claim ?? '').trim();
  if (claim.length < MIN_CLAIM) throw new RuleError(`Say what happened in at least ${MIN_CLAIM} characters (for example when and how you paid, and to whom).`, 400, 'CLAIM_REQUIRED');
  if (input.evidence) {
    if (!(PROOF_TYPES as readonly string[]).includes(input.evidence.mimeType)) throw new RuleError('The evidence must be a JPEG, PNG or WebP picture, or a PDF.', 400, 'INVALID_PROOF');
    if (input.evidence.buffer.length === 0 || input.evidence.buffer.length > MAX_PROOF_BYTES) throw new RuleError('The evidence must be larger than zero and no bigger than 5 MB.', 400, 'INVALID_PROOF');
  }

  const stored: string[] = [];
  try {
    const result = await prisma.$transaction(async (tx) => {
      const membership = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, include: { member: { select: { userId: true, firstName: true, lastName: true } }, group: { select: { name: true, status: true } } } });
      if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
      const own = membership.member.userId !== null && membership.member.userId === input.actorUserId;
      // Someone else's membership is reported as missing to a person who has no right to act for them.
      if (!own && !input.actorCanManage) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
      if (membership.group.status !== 'ACTIVE') throw new RuleError('Disputes are for a running group.', 409, 'GROUP_NOT_ACTIVE');

      const installment = await tx.ajoInstallment.findFirst({ where: { id: input.installmentId, membershipId: membership.id } });
      if (!installment) throw new RuleError('That instalment was not found.', 404, 'INSTALMENT_NOT_FOUND');
      if (installment.paidKobo >= installment.amountKobo || installment.status === 'WAIVED') throw new RuleError('That instalment is already paid or waived, so there is nothing to dispute.', 409, 'ALREADY_PAID');
      const open = await tx.ajoDispute.findFirst({ where: { membershipId: membership.id, installmentId: installment.id, status: 'OPEN' }, select: { id: true } });
      if (open) throw new RuleError('A dispute about this instalment is already open.', 409, 'DISPUTE_ALREADY_OPEN');

      let evidenceKey: string | null = null;
      if (input.evidence) {
        evidenceKey = `ajo/dispute-evidence/${input.associationId}/${membership.groupId}/${randomUUID()}.${EXTENSION[input.evidence.mimeType]}`;
        await uploadFile(evidenceKey, input.evidence.buffer, input.evidence.mimeType);
        stored.push(evidenceKey);
      }
      const created = await tx.ajoDispute.create({ data: { associationId: input.associationId, membershipId: membership.id, installmentId: installment.id, claim, evidenceKey, raisedBy: input.actorUserId } });
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_DISPUTE_RAISED', tableName: 'ajo_disputes', recordId: created.id, newValues: { membershipId: membership.id, installmentId: installment.id, onBehalf: !own, claim } });
      return { created, name: `${membership.member.firstName} ${membership.member.lastName}`.trim(), groupName: membership.group.name, amount: installment.amountKobo - installment.paidKobo };
    });

    const notice = { pushType: 'ajo.dispute_raised', entityId: result.created.id, title: 'A payment is disputed', message: `${result.name} says they paid ${formatNaira(result.amount)} in ${result.groupName}. Please look at the evidence and decide.` };
    await notifyPermissionHolders(input.associationId, 'ajo.manage', notice, input.actorUserId);
    await notifyPermissionHolders(input.associationId, 'ajo.reconcile', notice, input.actorUserId);
    return toDisputeView(result.created);
  } catch (error) {
    for (const key of stored) await deleteFile(key).catch(() => undefined);
    throw error;
  }
}

export interface ResolveInput {
  associationId: number;
  disputeId: number;
  outcome: 'UPHELD' | 'NOT_UPHELD';
  reason: string;
  actorUserId: number;
  now?: Date;
}

/** An officer decides, with a written reason, and not the person who raised it. A decided dispute is never changed. */
export async function resolveDispute(input: ResolveInput) {
  const now = input.now ?? new Date();
  const reason = (input.reason ?? '').trim();
  if (reason.length < MIN_CLAIM) throw new RuleError(`Give a reason of at least ${MIN_CLAIM} characters. The member is told.`, 400, 'REASON_REQUIRED');
  const status = input.outcome === 'UPHELD' ? 'RESOLVED' : 'REJECTED';

  const result = await prisma.$transaction(async (tx) => {
    const d = await tx.ajoDispute.findFirst({ where: { id: input.disputeId, associationId: input.associationId } });
    if (!d) throw new RuleError('That dispute was not found.', 404, 'DISPUTE_NOT_FOUND');
    if (d.status !== 'OPEN') {
      if (d.status === status) return { dispute: d, replayed: true };
      throw new RuleError('This dispute has already been decided, and a decision is not changed. If something was missed, the member can raise it again.', 409, 'ALREADY_DECIDED');
    }
    if (d.raisedBy === input.actorUserId) throw new RuleError('You raised this dispute, so someone else has to decide it.', 403, 'SELF_RESOLUTION_NOT_ALLOWED');
    const won = await tx.ajoDispute.updateMany({ where: { id: d.id, status: 'OPEN' }, data: { status, resolution: reason, resolvedBy: input.actorUserId, resolvedAt: now } });
    if (won.count !== 1) throw new RuleError('This dispute was just decided by someone else.', 409, 'ALREADY_DECIDED');
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_DISPUTE_RESOLVED', tableName: 'ajo_disputes', recordId: d.id, oldValues: { status: 'OPEN' }, newValues: { outcome: input.outcome, reason } });
    return { dispute: await tx.ajoDispute.findUniqueOrThrow({ where: { id: d.id } }), replayed: false };
  });

  if (!result.replayed) {
    const target = await memberOfMembership(result.dispute.membershipId);
    if (target) {
      const upheld = input.outcome === 'UPHELD';
      await messageMember({ associationId: input.associationId, member: target.member, title: upheld ? 'Your claim was accepted' : 'Your claim was not accepted', message: upheld ? `Your claim that you paid was accepted: ${reason}. The officer will record your payment.` : `Your claim that you paid was not accepted: ${reason}.`, pushType: 'ajo.dispute_decided', entityId: result.dispute.id, kind: 'system', sms: true });
    }
  }
  return toDisputeView(result.dispute);
}

export async function listDisputes(input: { associationId: number; groupId?: number; membershipId?: number; status?: 'OPEN' | 'RESOLVED' | 'REJECTED' }) {
  const rows = await prisma.ajoDispute.findMany({
    where: { associationId: input.associationId, ...(input.membershipId ? { membershipId: input.membershipId } : {}), ...(input.groupId ? { membership: { groupId: input.groupId } } : {}), ...(input.status ? { status: input.status } : {}) },
    orderBy: { id: 'desc' },
    take: 200,
  });
  return rows.map(toDisputeView);
}

/** A short-lived link to the evidence, for the member and for officers. The storage key is never sent out. */
export async function getEvidenceLink(input: { associationId: number; disputeId: number; viewerUserId: number; viewerIsOfficer: boolean; host?: string }) {
  const d = await prisma.ajoDispute.findFirst({ where: { id: input.disputeId, associationId: input.associationId }, include: { membership: { select: { member: { select: { userId: true } } } } } });
  if (!d || (!input.viewerIsOfficer && d.membership.member.userId !== input.viewerUserId)) throw new RuleError('That dispute was not found.', 404, 'DISPUTE_NOT_FOUND');
  if (!d.evidenceKey) throw new RuleError('No evidence was attached.', 404, 'NO_EVIDENCE');
  return { url: await getPresignedUrl(d.evidenceKey, 300, input.host) };
}
