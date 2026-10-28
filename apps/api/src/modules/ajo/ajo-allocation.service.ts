/**
 * Where contribution money becomes real (T4.1): confirming a payment and reversing one.
 *
 * Confirming a payment does four things together, in the caller's transaction, or none of them:
 *   1. moves the contribution from REPORTED / CASH_RECEIVED to CONFIRMED (only one caller can win this),
 *   2. splits it across the person's open installments, oldest first, and stores that split as allocations,
 *   3. raises each installment's `paidKobo` and status,
 *   4. writes one CREDIT entry to the append-only ledger.
 * A reversal undoes exactly what the allocations say that payment paid, writes a REVERSAL ledger entry with the reason, and adds a
 * REVERSED contribution row that points at the original. Nothing is ever edited or deleted.
 *
 * Two payments for the same person are never confirmed at the same moment: each takes a per-membership lock first, so both read the
 * installments as the other left them.
 */
import { Prisma } from '@prisma/client';
import { RuleError } from '../finance/rule-error';
import { LedgerError, recordEntry, reverseEntry, type LedgerDb } from './ajo-ledger.service';
import { allocateOldestFirst, allocateSequential, formatNaira, installmentStatusFor, totalOwed, type OpenInstallment } from './ajo-collections';
import { businessDay } from './ajo-schedule';
import { auditAjo } from './ajo-support';

type Tx = Prisma.TransactionClient;

const confirmKey = (contributionId: number) => `ajo:contribution:${contributionId}:confirm`;
const reverseKey = (contributionId: number) => `ajo:contribution:${contributionId}:reverse`;
const confirmFeeKey = (contributionId: number) => `ajo:contribution:${contributionId}:confirm-fee`;
const reverseFeeKey = (contributionId: number) => `ajo:contribution:${contributionId}:reverse-fee`;
const reversalRowKey = (contributionId: number) => `ajo:contribution:${contributionId}:reversal`;

/** Money rules report their failures as ledger errors; callers of this module should only ever see RuleError. */
function asRuleError(error: unknown): never {
  if (error instanceof LedgerError) {
    const status = error.code === 'ENTRY_NOT_FOUND' ? 404 : error.code === 'REASON_REQUIRED' || error.code === 'KEY_REQUIRED' || error.code === 'INVALID_AMOUNT' ? 400 : 409;
    throw new RuleError(error.message, status, error.code);
  }
  throw error;
}

/** Take turns with anyone else confirming or reversing money for the same person. Released when the transaction ends. */
export async function lockMembershipMoney(tx: Tx, membershipId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ajo-money:' + membershipId}))`;
}

/** The installments a person still owes on, with what remains of each. Waived installments are not owed. */
export async function openInstallments(db: Pick<Tx, 'ajoInstallment'>, membershipId: number): Promise<OpenInstallment[]> {
  const rows = await db.ajoInstallment.findMany({ where: { membershipId, status: { not: 'WAIVED' } }, select: { id: true, dueDate: true, amountKobo: true, paidKobo: true } });
  return rows.map((r) => ({ id: r.id, dueDate: r.dueDate, remainingKobo: r.amountKobo - r.paidKobo })).filter((r) => r.remainingKobo > 0n);
}

/** Late fees the member owes now (payable, and not yet paid in full), oldest first. A pending fee is shown but is not owed. */
export async function payableFeesFor(db: Pick<Tx, 'ajoLateFeeAssessment'>, membershipId: number) {
  const rows = await db.ajoLateFeeAssessment.findMany({ where: { membershipId, status: 'PAYABLE' }, orderBy: { id: 'asc' }, select: { id: true, feeKobo: true, paidKobo: true } });
  return rows.map((r) => ({ id: r.id, remainingKobo: r.feeKobo - r.paidKobo })).filter((r) => r.remainingKobo > 0n);
}

/** Everything a person owes right now: the instalments still unpaid, and the late fees that have become payable. A payment cannot exceed it. */
export async function owedIncludingFees(db: Pick<Tx, 'ajoInstallment' | 'ajoLateFeeAssessment'>, membershipId: number): Promise<bigint> {
  const [open, fees] = await Promise.all([openInstallments(db, membershipId), payableFeesFor(db, membershipId)]);
  return totalOwed(open) + fees.reduce((s, f) => s + f.remainingKobo, 0n);
}

export interface ConfirmInput {
  associationId: number;
  contributionId: number;
  actorUserId: number;
  now: Date;
  /** Extra fields to set on the contribution as it becomes confirmed (a note, the self-confirmation flag). */
  extra?: Prisma.AjoContributionUpdateManyMutationInput;
}

export interface ConfirmResult {
  contributionId: number;
  membershipId: number;
  groupId: number;
  replayed: boolean;
  allocations: Array<{ installmentId: number; amountKobo: bigint }>;
  /** The part of the payment that cleared late fees, after the instalments. */
  lateFees: Array<{ lateFeeId: number; amountKobo: bigint }>;
}

/** Confirm one payment. Repeating it changes nothing and returns the original allocations. */
export async function confirmContributionInTx(tx: Tx, input: ConfirmInput): Promise<ConfirmResult> {
  const contribution = await tx.ajoContribution.findFirst({ where: { id: input.contributionId, associationId: input.associationId }, include: { group: { select: { timezone: true, cutoffTime: true, name: true } } } });
  // Another association's payment is reported as missing, never as forbidden.
  if (!contribution) throw new RuleError('That payment was not found.', 404, 'CONTRIBUTION_NOT_FOUND');
  if (contribution.reversalOfId !== null) throw new RuleError('A reversal cannot be confirmed.', 409, 'CONTRIBUTION_NOT_CONFIRMABLE');

  await lockMembershipMoney(tx, contribution.membershipId);

  // The status guard in the WHERE is what lets exactly one of two simultaneous confirmations through.
  const won = await tx.ajoContribution.updateMany({
    where: { id: contribution.id, status: { in: ['REPORTED', 'CASH_RECEIVED'] } },
    data: { status: 'CONFIRMED', confirmedAt: input.now, confirmedBy: input.actorUserId, missingFromHandover: false, ...input.extra },
  });
  if (won.count !== 1) {
    const current = await tx.ajoContribution.findUniqueOrThrow({ where: { id: contribution.id }, include: { allocations: true } });
    if (current.status === 'CONFIRMED') return { contributionId: current.id, membershipId: current.membershipId, groupId: current.groupId, replayed: true, allocations: current.allocations.filter((a) => a.installmentId !== null).map((a) => ({ installmentId: a.installmentId as number, amountKobo: a.amountKobo })), lateFees: current.allocations.filter((a) => a.lateFeeId !== null).map((a) => ({ lateFeeId: a.lateFeeId as number, amountKobo: a.amountKobo })) };
    throw new RuleError(`A ${current.status.toLowerCase().replace('_', ' ')} payment cannot be confirmed.`, 409, 'CONTRIBUTION_NOT_CONFIRMABLE');
  }

  const open = await openInstallments(tx, contribution.membershipId);
  const { allocations, leftoverKobo } = allocateOldestFirst(open, contribution.amountKobo);
  // What is left after the instalments clears late fees that have become payable, oldest first. Savings always come first.
  const feeSplit = leftoverKobo > 0n ? allocateSequential(await payableFeesFor(tx, contribution.membershipId), leftoverKobo) : { parts: [], leftoverKobo: 0n };
  if (feeSplit.leftoverKobo > 0n) {
    throw new RuleError(`This payment of ${formatNaira(contribution.amountKobo)} is more than the ${formatNaira(contribution.amountKobo - feeSplit.leftoverKobo)} this person still owes in ${contribution.group.name}.`, 409, 'EXCEEDS_OWED');
  }
  const feeTotal = feeSplit.parts.reduce((s, p) => s + p.amountKobo, 0n);

  const today = businessDay(input.now, contribution.group.timezone, contribution.group.cutoffTime);
  const byId = new Map((await tx.ajoInstallment.findMany({ where: { id: { in: allocations.map((a) => a.installmentId) } } })).map((i) => [i.id, i]));
  for (const a of allocations) {
    const row = byId.get(a.installmentId)!;
    const paid = row.paidKobo + a.amountKobo;
    await tx.ajoContributionAllocation.create({ data: { associationId: input.associationId, contributionId: contribution.id, installmentId: a.installmentId, amountKobo: a.amountKobo } });
    await tx.ajoInstallment.update({ where: { id: row.id }, data: { paidKobo: paid, status: installmentStatusFor(row.amountKobo, paid, row.dueDate, today) } });
  }
  const feeRows = new Map((await tx.ajoLateFeeAssessment.findMany({ where: { id: { in: feeSplit.parts.map((p) => p.id) } } })).map((f) => [f.id, f]));
  for (const p of feeSplit.parts) {
    const fee = feeRows.get(p.id)!;
    const paid = fee.paidKobo + p.amountKobo;
    await tx.ajoContributionAllocation.create({ data: { associationId: input.associationId, contributionId: contribution.id, lateFeeId: p.id, amountKobo: p.amountKobo } });
    await tx.ajoLateFeeAssessment.update({ where: { id: fee.id }, data: { paidKobo: paid, status: paid >= fee.feeKobo ? 'PAID' : 'PAYABLE' } });
  }

  try {
    // The instalments part is the member's contribution; the late-fee part is the group's own income, recorded apart as a FEE credit.
    const contributionPart = contribution.amountKobo - feeTotal;
    if (contributionPart > 0n) {
      await recordEntry(tx as unknown as LedgerDb, { associationId: input.associationId, groupId: contribution.groupId, membershipId: contribution.membershipId, type: 'CONTRIBUTION', direction: 'CREDIT', amountKobo: contributionPart, refType: 'contribution', refId: contribution.id, idempotencyKey: confirmKey(contribution.id), createdBy: input.actorUserId });
    }
    if (feeTotal > 0n) {
      await recordEntry(tx as unknown as LedgerDb, { associationId: input.associationId, groupId: contribution.groupId, membershipId: contribution.membershipId, type: 'FEE', direction: 'CREDIT', amountKobo: feeTotal, refType: 'late_fee', refId: contribution.id, idempotencyKey: confirmFeeKey(contribution.id), createdBy: input.actorUserId });
    }
  } catch (error) {
    asRuleError(error);
  }

  await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_CONTRIBUTION_CONFIRMED', tableName: 'ajo_contributions', recordId: contribution.id, oldValues: { status: contribution.status }, newValues: { status: 'CONFIRMED', amountKobo: contribution.amountKobo.toString(), installments: allocations.length, lateFeeKobo: feeTotal.toString(), method: contribution.method } });
  return { contributionId: contribution.id, membershipId: contribution.membershipId, groupId: contribution.groupId, replayed: false, allocations, lateFees: feeSplit.parts.map((p) => ({ lateFeeId: p.id, amountKobo: p.amountKobo })) };
}

export interface ReverseInput {
  associationId: number;
  contributionId: number;
  actorUserId: number;
  reason: string;
  now: Date;
}

export const MIN_REVERSAL_REASON = 10;

export interface ReverseResult {
  reversalId: number;
  originalId: number;
  membershipId: number;
  groupId: number;
  replayed: boolean;
}

/** Reverse a confirmed payment, with a reason. It can be reversed once; repeating the request returns the same reversal. */
export async function reverseContributionInTx(tx: Tx, input: ReverseInput): Promise<ReverseResult> {
  const reason = (input.reason ?? '').trim();
  if (reason.length < MIN_REVERSAL_REASON) throw new RuleError(`A reversal needs a reason of at least ${MIN_REVERSAL_REASON} characters. It stays on the record.`, 400, 'REASON_REQUIRED');

  const original = await tx.ajoContribution.findFirst({ where: { id: input.contributionId, associationId: input.associationId }, include: { allocations: true, group: { select: { timezone: true, cutoffTime: true } } } });
  if (!original) throw new RuleError('That payment was not found.', 404, 'CONTRIBUTION_NOT_FOUND');
  if (original.reversalOfId !== null) throw new RuleError('A reversal cannot be reversed. Record a new payment instead.', 409, 'CANNOT_REVERSE_A_REVERSAL');

  await lockMembershipMoney(tx, original.membershipId);

  const existing = await tx.ajoContribution.findFirst({ where: { reversalOfId: original.id } });
  if (existing) return { reversalId: existing.id, originalId: original.id, membershipId: original.membershipId, groupId: original.groupId, replayed: true };
  if (original.status !== 'CONFIRMED') {
    throw new RuleError(original.status === 'REPORTED' || original.status === 'CASH_RECEIVED' ? 'This payment was never confirmed, so there is nothing to reverse. Reject it instead.' : `A ${original.status.toLowerCase()} payment cannot be reversed.`, 409, 'NOT_CONFIRMED');
  }

  const reversal = await tx.ajoContribution.create({
    data: {
      associationId: input.associationId,
      groupId: original.groupId,
      membershipId: original.membershipId,
      amountKobo: original.amountKobo,
      method: original.method,
      status: 'REVERSED',
      collectorId: original.collectorId,
      reference: `${original.reference}-R`,
      idempotencyKey: reversalRowKey(original.id),
      reason,
      receivedAt: input.now,
      businessDate: original.businessDate,
      reversalOfId: original.id,
      recordedBy: input.actorUserId,
    },
  });

  // Undo exactly what the allocations say was paid, not a fresh calculation.
  const today = businessDay(input.now, original.group.timezone, original.group.cutoffTime);
  for (const a of original.allocations) {
    if (a.installmentId !== null) {
      const row = await tx.ajoInstallment.findUniqueOrThrow({ where: { id: a.installmentId } });
      const paid = row.paidKobo - a.amountKobo;
      if (paid < 0n) throw new RuleError('This payment cannot be undone because the instalment it paid no longer adds up. Ask support.', 409, 'ALLOCATION_MISMATCH');
      await tx.ajoInstallment.update({ where: { id: row.id }, data: { paidKobo: paid, status: installmentStatusFor(row.amountKobo, paid, row.dueDate, today) } });
    } else if (a.lateFeeId !== null) {
      const fee = await tx.ajoLateFeeAssessment.findUniqueOrThrow({ where: { id: a.lateFeeId } });
      const paid = fee.paidKobo - a.amountKobo;
      if (paid < 0n) throw new RuleError('This payment cannot be undone because the late fee it paid no longer adds up. Ask support.', 409, 'ALLOCATION_MISMATCH');
      // A fee that was fully paid is owed again; a waived one stays waived.
      await tx.ajoLateFeeAssessment.update({ where: { id: fee.id }, data: { paidKobo: paid, status: fee.status === 'PAID' ? 'PAYABLE' : fee.status } });
    }
  }

  try {
    const entry = await tx.ajoLedgerEntry.findUnique({ where: { idempotencyKey: confirmKey(original.id) } });
    const feeEntry = await tx.ajoLedgerEntry.findUnique({ where: { idempotencyKey: confirmFeeKey(original.id) } });
    if (!entry && !feeEntry) throw new RuleError('The ledger entry for this payment was not found. Ask support.', 409, 'ENTRY_NOT_FOUND');
    if (entry) await reverseEntry(tx as unknown as LedgerDb, { associationId: input.associationId, entryId: entry.id, reason, idempotencyKey: reverseKey(original.id), createdBy: input.actorUserId });
    if (feeEntry) await reverseEntry(tx as unknown as LedgerDb, { associationId: input.associationId, entryId: feeEntry.id, reason, idempotencyKey: reverseFeeKey(original.id), createdBy: input.actorUserId });
  } catch (error) {
    asRuleError(error);
  }

  await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_CONTRIBUTION_REVERSED', tableName: 'ajo_contributions', recordId: original.id, oldValues: { status: 'CONFIRMED' }, newValues: { reversalId: reversal.id, amountKobo: original.amountKobo.toString(), reason } });
  return { reversalId: reversal.id, originalId: original.id, membershipId: original.membershipId, groupId: original.groupId, replayed: false };
}
