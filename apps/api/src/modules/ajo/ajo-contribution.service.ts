/**
 * Recording and confirming contributions (T4.1, T4.3).
 *
 *   Cash:      a collector records it (CASH_RECEIVED). It is confirmed line by line when an officer reconciles the day's handover
 *              (ajo-handover.service.ts).
 *   Transfers: a contributor, or an officer for them, reports it with a proof (REPORTED). An officer confirms it against the group's bank
 *              account, or rejects it with a reason.
 * Only a CONFIRMED payment counts. Confirming and reversing live in ajo-allocation.service.ts; this file is the front door.
 *
 * Every record needs an idempotency key. Repeating a request returns the original and changes nothing; reusing a key for a different
 * payment is refused. Keys are stored per association, so one tenant can never collide with, or learn about, another's.
 */
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { deleteFile, getPresignedUrl, uploadFile } from '../../lib/storage';
import { RuleError } from '../finance/rule-error';
import { confirmContributionInTx, owedIncludingFees, reverseContributionInTx } from './ajo-allocation.service';
import { MAX_PROOF_BYTES, PROOF_TYPES, formatNaira, hashProof, newReference, normaliseBankReference, type ReceiptFacts } from './ajo-collections';
import { assertCanContribute } from './ajo-membership.service';
import { createReceiptInTx, deliverReceipt } from './ajo-receipt.service';
import { businessDay } from './ajo-schedule';
import { auditAjo } from './ajo-support';

type Tx = Prisma.TransactionClient;

export const MIN_NOTE_LENGTH = 5;
export const MIN_REJECTION_REASON = 10;
const KEY_MIN = 8;

const storedKey = (associationId: number, key: string) => `a${associationId}:${key}`;

function checkKey(key: string): string {
  const k = (key ?? '').trim();
  if (k.length < KEY_MIN || k.length > 120) throw new RuleError('Every payment needs an idempotency key of 8 to 120 characters, so sending it twice cannot count it twice.', 400, 'KEY_REQUIRED');
  return k;
}

function checkAmount(amountKobo: bigint): void {
  if (typeof amountKobo !== 'bigint' || amountKobo <= 0n) throw new RuleError('The amount must be more than zero.', 400, 'INVALID_AMOUNT');
}

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** Active, started and not closed. A payment needs a schedule to land on. */
async function loadActiveGroup(tx: Tx, associationId: number, groupId: number) {
  const group = await tx.ajoGroup.findFirst({ where: { id: groupId, associationId } });
  if (!group) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  if (group.status === 'COMPLETED' || group.status === 'CANCELLED') throw new RuleError('This group is closed, so no payments can be recorded.', 409, 'GROUP_CLOSED');
  if (group.status !== 'ACTIVE') throw new RuleError('This group has not started yet, so there is nothing to pay.', 409, 'GROUP_NOT_STARTED');
  return group;
}

/** Everyone in the association who holds `ajo.reconcile`. Used to tell whether someone is the only person who can confirm. */
export async function reconcilerUserIds(db: Tx | typeof prisma, associationId: number): Promise<number[]> {
  const rows = await db.userRole.findMany({
    where: { associationId, isActive: true, user: { isActive: true }, role: { isActive: true, permissions: { some: { permission: { key: 'ajo.reconcile' } } } } },
    select: { userId: true },
    distinct: ['userId'],
  });
  return rows.map((r) => r.userId);
}

/**
 * Anyone who recorded a payment, or is the person who paid, cannot also confirm it. The one exception is a group where they are the only
 * person who can reconcile: then they may confirm their own entry, but only by saying so and giving a note, and it is marked on the record.
 */
export async function assertMayConfirm(tx: Tx | typeof prisma, input: { associationId: number; actorUserId: number; conflicted: boolean; confirmOwn?: boolean; note?: string; what: string }): Promise<{ self: boolean; note: string | null }> {
  if (!input.conflicted) return { self: false, note: input.note?.trim() || null };
  const reconcilers = await reconcilerUserIds(tx, input.associationId);
  const sole = reconcilers.length <= 1 && reconcilers.includes(input.actorUserId);
  if (!sole) throw new RuleError(`You recorded or made this ${input.what}, so another officer has to confirm it.`, 403, 'SELF_CONFIRM_NOT_ALLOWED');
  const note = (input.note ?? '').trim();
  if (!input.confirmOwn || note.length < MIN_NOTE_LENGTH) {
    throw new RuleError(`You are the only person who can confirm in this group. To confirm your own ${input.what}, say so (confirmOwn) and add a note saying how you checked it.`, 403, 'SELF_CONFIRM_NEEDS_NOTE');
  }
  return { self: true, note };
}

async function nameOfUser(db: Tx | typeof prisma, associationId: number, userId: number | null): Promise<string | null> {
  if (!userId) return null;
  const m = await db.member.findFirst({ where: { associationId, userId }, select: { firstName: true, lastName: true } });
  return m ? `${m.firstName} ${m.lastName}`.trim() : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------------------------------------------------------------

type ContributionRow = Prisma.AjoContributionGetPayload<{ include: { reversedBy: { select: { id: true; reason: true } }; allocations: true } }>;

/** A payment as the API sends it: kobo as strings, no storage key, and a plain statement of whether it counts yet. */
export function toContributionView(c: ContributionRow, options: { officer?: boolean } = {}) {
  const reversed = c.reversedBy !== null;
  return {
    id: c.id,
    groupId: c.groupId,
    membershipId: c.membershipId,
    reference: c.reference,
    method: c.method,
    status: c.status,
    amountKobo: c.amountKobo.toString(),
    amount: formatNaira(c.amountKobo),
    receivedAt: c.receivedAt,
    confirmedAt: c.confirmedAt,
    isReversal: c.reversalOfId !== null,
    reversed,
    reversalReason: reversed ? c.reversedBy?.reason ?? null : null,
    reason: c.reason,
    /** Only confirmed money counts; everything else is still being checked, or was turned down. */
    counts: c.status === 'CONFIRMED' && !reversed,
    awaitingConfirmation: c.status === 'REPORTED' || c.status === 'CASH_RECEIVED',
    missingFromHandover: c.missingFromHandover,
    installmentsCovered: c.allocations.filter((a) => a.installmentId !== null).map((a) => ({ installmentId: a.installmentId, amountKobo: a.amountKobo.toString() })),
    lateFeesCovered: c.allocations.filter((a) => a.lateFeeId !== null).map((a) => ({ lateFeeId: a.lateFeeId, amountKobo: a.amountKobo.toString() })),
    ...(options.officer ? { hasProof: c.proofKey !== null, bankReference: c.bankReference, paidOn: c.paidOn, possibleDuplicateOf: c.duplicateOfId, collectorUserId: c.collectorId, handoverId: c.handoverId, selfConfirmed: c.selfConfirmed } : {}),
  };
}

const viewInclude = { reversedBy: { select: { id: true, reason: true } }, allocations: true } as const;

export async function listMembershipContributions(input: { associationId: number; membershipId: number; officer: boolean }) {
  const membership = await prisma.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, select: { id: true } });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  const rows = await prisma.ajoContribution.findMany({ where: { membershipId: membership.id }, orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }], include: viewInclude });
  return rows.map((r) => toContributionView(r, { officer: input.officer }));
}

/** The officers' queue: payments in a group, by status and method. */
export async function listGroupContributions(input: { associationId: number; groupId: number; status?: string; method?: 'CASH' | 'TRANSFER'; take?: number; skip?: number }) {
  const group = await prisma.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId }, select: { id: true } });
  if (!group) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  const where: Prisma.AjoContributionWhereInput = { groupId: group.id, associationId: input.associationId, ...(input.status ? { status: input.status as never } : {}), ...(input.method ? { method: input.method } : {}) };
  const [rows, total] = await Promise.all([
    prisma.ajoContribution.findMany({ where, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }], take: Math.min(Math.max(input.take ?? 50, 1), 200), skip: Math.max(input.skip ?? 0, 0), include: viewInclude }),
    prisma.ajoContribution.count({ where }),
  ]);
  return { total, items: rows.map((r) => toContributionView(r, { officer: true })) };
}

/** A short-lived link to the proof, for the person who paid and for officers. The storage key itself is never sent out. */
export async function getProofLink(input: { associationId: number; contributionId: number; viewerUserId: number; viewerIsOfficer: boolean; host?: string }) {
  const c = await prisma.ajoContribution.findFirst({ where: { id: input.contributionId, associationId: input.associationId }, include: { membership: { select: { member: { select: { userId: true } } } } } });
  if (!c || (!input.viewerIsOfficer && c.membership.member.userId !== input.viewerUserId)) throw new RuleError('That payment was not found.', 404, 'CONTRIBUTION_NOT_FOUND');
  if (!c.proofKey) throw new RuleError('No proof was attached to this payment.', 404, 'NO_PROOF');
  return { url: await getPresignedUrl(c.proofKey, 300, input.host) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Replays
// ---------------------------------------------------------------------------------------------------------------------------------

async function findReplay(associationId: number, key: string, expected: { groupId: number; membershipId: number; amountKobo: bigint; method: 'CASH' | 'TRANSFER' }) {
  const prior = await prisma.ajoContribution.findUnique({ where: { idempotencyKey: storedKey(associationId, key) }, include: viewInclude });
  if (!prior) return null;
  if (prior.associationId !== associationId || prior.groupId !== expected.groupId || prior.membershipId !== expected.membershipId || prior.amountKobo !== expected.amountKobo || prior.method !== expected.method) {
    throw new RuleError('That idempotency key was already used for a different payment.', 409, 'IDEMPOTENCY_CONFLICT');
  }
  return prior;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Cash
// ---------------------------------------------------------------------------------------------------------------------------------

export interface RecordCashInput {
  associationId: number;
  groupId: number;
  membershipId: number;
  amountKobo: bigint;
  idempotencyKey: string;
  actorUserId: number;
  /** True for an officer with `ajo.manage`; a collector without it may record only for the people assigned to them. */
  actorCanManage: boolean;
  now?: Date;
}

/** A collector records cash they have just taken. It is CASH_RECEIVED and does not count until an officer reconciles the handover. */
export async function recordCash(input: RecordCashInput) {
  const now = input.now ?? new Date();
  const key = checkKey(input.idempotencyKey);
  checkAmount(input.amountKobo);

  const prior = await findReplay(input.associationId, key, { groupId: input.groupId, membershipId: input.membershipId, amountKobo: input.amountKobo, method: 'CASH' });
  if (prior) return { contribution: toContributionView(prior, { officer: true }), replayed: true };

  let receiptId = 0;
  let contributionId = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const group = await loadActiveGroup(tx, input.associationId, input.groupId);
      const membership = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, groupId: group.id, associationId: input.associationId }, include: { member: { select: { firstName: true, lastName: true } } } });
      if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');

      const today = businessDay(now, group.timezone, group.cutoffTime);
      if (!input.actorCanManage) {
        // A collector sees, and records for, only the people assigned to them. Anyone else is reported as missing.
        const assigned = await tx.ajoCollectorAssignment.findFirst({ where: { membershipId: membership.id, collectorUserId: input.actorUserId, startsOn: { lte: today }, OR: [{ endsOn: null }, { endsOn: { gte: today } }] }, select: { id: true } });
        if (!assigned) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
      }
      await assertCanContribute(tx, { associationId: input.associationId, membershipId: membership.id });

      const owed = await owedIncludingFees(tx, membership.id);
      if (input.amountKobo > owed) throw new RuleError(`That is more than the ${formatNaira(owed)} this person still owes in ${group.name}.`, 409, 'EXCEEDS_OWED');

      // Cash taken after the day's handover belongs to the next business day: the handover is closed.
      const handedOver = await tx.ajoCashHandover.findUnique({ where: { groupId_collectorUserId_forDate: { groupId: group.id, collectorUserId: input.actorUserId, forDate: today } }, select: { id: true } });
      if (handedOver) throw new RuleError('You have already handed over the cash for today. Cash taken now counts for the next business day.', 409, 'HANDOVER_CLOSED');

      const created = await tx.ajoContribution.create({
        data: {
          associationId: input.associationId,
          groupId: group.id,
          membershipId: membership.id,
          amountKobo: input.amountKobo,
          method: 'CASH',
          status: 'CASH_RECEIVED',
          collectorId: input.actorUserId,
          reference: newReference(now),
          idempotencyKey: storedKey(input.associationId, key),
          receivedAt: now,
          businessDate: today,
          recordedBy: input.actorUserId,
        },
      });
      const facts: ReceiptFacts = { moment: 'RECORDED', method: 'CASH', amountKobo: created.amountKobo, groupName: group.name, reference: created.reference, collectorName: await nameOfUser(tx, input.associationId, input.actorUserId) };
      receiptId = (await createReceiptInTx(tx, { associationId: input.associationId, contributionId: created.id, facts })).id;
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_CONTRIBUTION_RECORDED', tableName: 'ajo_contributions', recordId: created.id, newValues: { method: 'CASH', status: 'CASH_RECEIVED', amountKobo: created.amountKobo.toString(), membershipId: membership.id, reference: created.reference } });
      contributionId = created.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Two identical requests at the same moment: the other one won. Return its result.
      const winner = await findReplay(input.associationId, key, { groupId: input.groupId, membershipId: input.membershipId, amountKobo: input.amountKobo, method: 'CASH' });
      if (winner) return { contribution: toContributionView(winner, { officer: true }), replayed: true };
    }
    throw error;
  }

  await deliverReceipt(receiptId);
  const row = await prisma.ajoContribution.findUniqueOrThrow({ where: { id: contributionId }, include: viewInclude });
  return { contribution: toContributionView(row, { officer: true }), replayed: false };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------------------------------------------------------------

export interface ReportTransferInput {
  associationId: number;
  groupId: number;
  membershipId: number;
  amountKobo: bigint;
  idempotencyKey: string;
  actorUserId: number;
  /** An officer with `ajo.manage` may record a transfer for someone else, with the proof attached. */
  actorCanManage: boolean;
  proof?: { buffer: Buffer; mimeType: string };
  bankReference?: string;
  /** The date the contributor says they paid. */
  paidOn?: Date;
  now?: Date;
}

const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

/** Other payments in the association carrying the same proof file or the same bank reference, most damning first. */
async function findDuplicates(tx: Tx | typeof prisma, input: { associationId: number; excludeId?: number; proofHash: string | null; bankReference: string | null }) {
  const clauses: Prisma.AjoContributionWhereInput[] = [];
  if (input.proofHash) clauses.push({ proofHash: input.proofHash });
  if (input.bankReference) clauses.push({ bankReference: input.bankReference });
  if (!clauses.length) return [];
  const rows = await tx.ajoContribution.findMany({
    where: { associationId: input.associationId, ...(input.excludeId ? { id: { not: input.excludeId } } : {}), reversalOfId: null, status: { in: ['REPORTED', 'CASH_RECEIVED', 'CONFIRMED'] }, OR: clauses },
    include: { reversedBy: { select: { id: true } }, membership: { select: { member: { select: { firstName: true, lastName: true } } } } },
    orderBy: { id: 'asc' },
    take: 10,
  });
  // A payment that was reversed no longer stands behind its proof.
  return rows.filter((r) => !(r.status === 'CONFIRMED' && r.reversedBy));
}

/** A contributor, or an officer for them, reports a bank transfer. REPORTED does not count until an officer confirms it. */
export async function reportTransfer(input: ReportTransferInput) {
  const now = input.now ?? new Date();
  const key = checkKey(input.idempotencyKey);
  checkAmount(input.amountKobo);

  const bankReference = normaliseBankReference(input.bankReference);
  if (!input.proof && !bankReference) throw new RuleError('Attach the proof of payment (a screenshot or receipt), or give the bank reference, so the officer can find it on the statement.', 400, 'PROOF_REQUIRED');
  if (input.proof) {
    if (!(PROOF_TYPES as readonly string[]).includes(input.proof.mimeType)) throw new RuleError('The proof must be a JPEG, PNG or WebP picture, or a PDF.', 400, 'INVALID_PROOF');
    if (input.proof.buffer.length === 0 || input.proof.buffer.length > MAX_PROOF_BYTES) throw new RuleError('The proof must be larger than zero and no bigger than 5 MB.', 400, 'INVALID_PROOF');
  }

  const prior = await findReplay(input.associationId, key, { groupId: input.groupId, membershipId: input.membershipId, amountKobo: input.amountKobo, method: 'TRANSFER' });
  if (prior) return { contribution: toContributionView(prior, { officer: input.actorCanManage }), replayed: true, possibleDuplicate: prior.duplicateOfId !== null };

  const proofHash = input.proof ? hashProof(input.proof.buffer) : null;
  let proofKey: string | null = null;
  let receiptId = 0;
  let contributionId = 0;
  let duplicateOfId: number | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const group = await loadActiveGroup(tx, input.associationId, input.groupId);
      const membership = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, groupId: group.id, associationId: input.associationId }, include: { member: { select: { userId: true } } } });
      if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
      const own = membership.member.userId !== null && membership.member.userId === input.actorUserId;
      if (!own && !input.actorCanManage) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
      await assertCanContribute(tx, { associationId: input.associationId, membershipId: membership.id });

      const owed = await owedIncludingFees(tx, membership.id);
      if (input.amountKobo > owed) throw new RuleError(`That is more than the ${formatNaira(owed)} this person still owes in ${group.name}.`, 409, 'EXCEEDS_OWED');

      const duplicates = await findDuplicates(tx, { associationId: input.associationId, proofHash, bankReference });
      duplicateOfId = (duplicates.find((d) => d.status === 'CONFIRMED') ?? duplicates[0])?.id ?? null;

      // The file is stored only once everything else has been checked; if the write below fails it is removed again.
      if (input.proof && !proofKey) {
        proofKey = `ajo/proofs/${input.associationId}/${group.id}/${randomUUID()}.${EXTENSION[input.proof.mimeType]}`;
        await uploadFile(proofKey, input.proof.buffer, input.proof.mimeType);
      }

      const created = await tx.ajoContribution.create({
        data: {
          associationId: input.associationId,
          groupId: group.id,
          membershipId: membership.id,
          amountKobo: input.amountKobo,
          method: 'TRANSFER',
          status: 'REPORTED',
          reference: newReference(now),
          idempotencyKey: storedKey(input.associationId, key),
          proofKey,
          proofHash,
          bankReference,
          paidOn: input.paidOn ?? null,
          duplicateOfId,
          receivedAt: now,
          businessDate: businessDay(now, group.timezone, group.cutoffTime),
          recordedBy: input.actorUserId,
        },
      });
      const facts: ReceiptFacts = { moment: 'RECORDED', method: 'TRANSFER', amountKobo: created.amountKobo, groupName: group.name, reference: created.reference };
      receiptId = (await createReceiptInTx(tx, { associationId: input.associationId, contributionId: created.id, facts })).id;
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_CONTRIBUTION_RECORDED', tableName: 'ajo_contributions', recordId: created.id, newValues: { method: 'TRANSFER', status: 'REPORTED', amountKobo: created.amountKobo.toString(), membershipId: membership.id, reference: created.reference, onBehalf: !own, possibleDuplicateOf: duplicateOfId } });
      contributionId = created.id;
    });
  } catch (error) {
    if (proofKey) await deleteFile(proofKey).catch(() => undefined);
    if (isUniqueViolation(error)) {
      const winner = await findReplay(input.associationId, key, { groupId: input.groupId, membershipId: input.membershipId, amountKobo: input.amountKobo, method: 'TRANSFER' });
      if (winner) return { contribution: toContributionView(winner, { officer: input.actorCanManage }), replayed: true, possibleDuplicate: winner.duplicateOfId !== null };
    }
    throw error;
  }

  await deliverReceipt(receiptId);
  const row = await prisma.ajoContribution.findUniqueOrThrow({ where: { id: contributionId }, include: viewInclude });
  return { contribution: toContributionView(row, { officer: input.actorCanManage }), replayed: false, possibleDuplicate: duplicateOfId !== null };
}

export interface ConfirmTransferInput {
  associationId: number;
  contributionId: number;
  actorUserId: number;
  acknowledgeDuplicate?: boolean;
  note?: string;
  confirmOwn?: boolean;
  now?: Date;
}

/** An officer confirms a transfer against the group's bank statement. Confirming twice, or two officers at once, confirms it once. */
export async function confirmTransfer(input: ConfirmTransferInput) {
  const now = input.now ?? new Date();
  let receiptId: number | null = null;
  const result = await prisma.$transaction(
    async (tx) => {
      const c = await tx.ajoContribution.findFirst({ where: { id: input.contributionId, associationId: input.associationId }, include: { group: { select: { name: true } }, membership: { select: { member: { select: { userId: true } } } } } });
      if (!c) throw new RuleError('That payment was not found.', 404, 'CONTRIBUTION_NOT_FOUND');
      if (c.method !== 'TRANSFER') throw new RuleError('This is a cash payment. Cash is confirmed when the collector’s handover is reconciled.', 409, 'USE_HANDOVER');
      if (c.status === 'CONFIRMED') {
        const replay = await confirmContributionInTx(tx, { associationId: input.associationId, contributionId: c.id, actorUserId: input.actorUserId, now });
        return { ...replay, duplicateAcknowledged: false };
      }
      if (c.status !== 'REPORTED') throw new RuleError(`A ${c.status.toLowerCase()} payment cannot be confirmed.`, 409, 'CONTRIBUTION_NOT_CONFIRMABLE');

      const conflicted = c.recordedBy === input.actorUserId || c.membership.member.userId === input.actorUserId;
      const self = await assertMayConfirm(tx, { associationId: input.associationId, actorUserId: input.actorUserId, conflicted, confirmOwn: input.confirmOwn, note: input.note, what: 'payment' });

      // Checked again now, not just when it was reported: the other payment may have been confirmed in the meantime.
      const others = await findDuplicates(tx, { associationId: input.associationId, excludeId: c.id, proofHash: c.proofHash, bankReference: c.bankReference });
      const standing = others.find((o) => o.status === 'CONFIRMED');
      if (standing) {
        const who = `${standing.membership.member.firstName} ${standing.membership.member.lastName}`.trim();
        throw new RuleError(`This proof, or this bank reference, already backs a confirmed payment (${standing.reference}, ${who}). One bank payment cannot pay twice. Reject this one, or reverse the other first if it was a mistake.`, 409, 'DUPLICATE_PROOF');
      }
      let acknowledged = false;
      if (others.length) {
        const note = (input.note ?? '').trim();
        if (!input.acknowledgeDuplicate || note.length < MIN_NOTE_LENGTH) {
          throw new RuleError(`This looks like the same proof or bank reference as ${others.map((o) => o.reference).join(', ')}. Check the statement, then confirm again with acknowledgeDuplicate and a note saying why it is a different payment.`, 409, 'DUPLICATE_ACK_REQUIRED');
        }
        acknowledged = true;
      }

      const confirmed = await confirmContributionInTx(tx, {
        associationId: input.associationId,
        contributionId: c.id,
        actorUserId: input.actorUserId,
        now,
        extra: { selfConfirmed: self.self, confirmNote: self.note, ...(acknowledged ? { duplicateAckBy: input.actorUserId, duplicateAckNote: (input.note ?? '').trim() } : {}) },
      });
      if (!confirmed.replayed) {
        const facts: ReceiptFacts = { moment: 'CONFIRMED', method: 'TRANSFER', amountKobo: c.amountKobo, groupName: c.group.name, reference: c.reference };
        receiptId = (await createReceiptInTx(tx, { associationId: input.associationId, contributionId: c.id, facts })).id;
      }
      return { ...confirmed, duplicateAcknowledged: acknowledged };
    },
    { timeout: 20_000 },
  );
  if (receiptId) await deliverReceipt(receiptId);
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reject, reverse
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Turn down a payment that was never confirmed: a transfer report that does not match the statement, or cash that never reached the
 * officer. It was never counted, so there is nothing to reverse; it stays on the record with its reason.
 */
export async function rejectContribution(input: { associationId: number; contributionId: number; actorUserId: number; reason: string; now?: Date }) {
  const now = input.now ?? new Date();
  const reason = (input.reason ?? '').trim();
  if (reason.length < MIN_REJECTION_REASON) throw new RuleError(`Give a reason of at least ${MIN_REJECTION_REASON} characters. The contributor is told.`, 400, 'REASON_REQUIRED');

  let receiptId: number | null = null;
  const result = await prisma.$transaction(async (tx) => {
    const c = await tx.ajoContribution.findFirst({ where: { id: input.contributionId, associationId: input.associationId }, include: { group: { select: { name: true } } } });
    if (!c) throw new RuleError('That payment was not found.', 404, 'CONTRIBUTION_NOT_FOUND');
    if (c.status === 'REJECTED') return { contributionId: c.id, replayed: true };
    if (c.reversalOfId !== null || (c.status !== 'REPORTED' && c.status !== 'CASH_RECEIVED')) {
      throw new RuleError(c.status === 'CONFIRMED' ? 'This payment is already confirmed. Reverse it instead.' : `A ${c.status.toLowerCase()} payment cannot be rejected.`, 409, 'CONTRIBUTION_NOT_REJECTABLE');
    }
    const won = await tx.ajoContribution.updateMany({ where: { id: c.id, status: { in: ['REPORTED', 'CASH_RECEIVED'] } }, data: { status: 'REJECTED', reason, rejectedBy: input.actorUserId, rejectedAt: now } });
    if (won.count !== 1) throw new RuleError('This payment was just decided by someone else.', 409, 'CONTRIBUTION_NOT_REJECTABLE');
    const facts: ReceiptFacts = { moment: 'REJECTED', method: c.method, amountKobo: c.amountKobo, groupName: c.group.name, reference: c.reference, reason };
    receiptId = (await createReceiptInTx(tx, { associationId: input.associationId, contributionId: c.id, facts })).id;
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_CONTRIBUTION_REJECTED', tableName: 'ajo_contributions', recordId: c.id, oldValues: { status: c.status }, newValues: { status: 'REJECTED', reason } });
    return { contributionId: c.id, replayed: false };
  });
  if (receiptId) await deliverReceipt(receiptId);
  return result;
}

/** Reverse a confirmed payment, with a reason. The contributor is told. */
export async function reverseContribution(input: { associationId: number; contributionId: number; actorUserId: number; reason: string; now?: Date }) {
  const now = input.now ?? new Date();
  let receiptId: number | null = null;
  const result = await prisma.$transaction(
    async (tx) => {
      const reversed = await reverseContributionInTx(tx, { associationId: input.associationId, contributionId: input.contributionId, actorUserId: input.actorUserId, reason: input.reason, now });
      if (!reversed.replayed) {
        const c = await tx.ajoContribution.findUniqueOrThrow({ where: { id: reversed.originalId }, include: { group: { select: { name: true } } } });
        const facts: ReceiptFacts = { moment: 'REVERSED', method: c.method, amountKobo: c.amountKobo, groupName: c.group.name, reference: c.reference, reason: input.reason.trim() };
        receiptId = (await createReceiptInTx(tx, { associationId: input.associationId, contributionId: c.id, facts })).id;
      }
      return reversed;
    },
    { timeout: 20_000 },
  );
  if (receiptId) await deliverReceipt(receiptId);
  return result;
}
