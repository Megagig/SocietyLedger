/**
 * Payouts (T5.1 to T5.3): prepare, approve, record as paid, and the ways a payout can stop or be undone.
 *
 * SocietyLedger never moves this money. The group pays from its own bank account; here an officer RECORDS that it did, with the bank's
 * reference. A payout is prepared by an officer (with a preview), approved by an admin who is not the preparer, and recorded as paid by
 * an officer who is not the recipient. Only recording writes the ledger, and a recorded payout is undone only by a reversal.
 *
 *   PREPARED → APPROVED → PAID → REVERSED          a payout moving forward, and the one way back after it is paid
 *   PREPARED / APPROVED → VOID                      cancelled, or the bank transfer failed (`failed`); nothing was written to the ledger
 *
 * The calculation is pure (ajo-payout-calc.ts). This file gathers the figures, enforces who and when, and keeps every step audited.
 */
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { deleteFile, uploadFile } from '../../lib/storage';
import { RuleError } from '../finance/rule-error';
import { LedgerError, recordEntry, reverseEntry, type LedgerDb } from './ajo-ledger.service';
import { MAX_PROOF_BYTES, PROOF_TYPES, formatNaira, normaliseBankReference } from './ajo-collections';
import { assertMayConfirm } from './ajo-contribution.service';
import { calculatePayout, type FeeType, type PayoutFigures } from './ajo-payout-calc';
import { businessDay, groupDates } from './ajo-schedule';
import { maskAccount } from './ajo-secrets';
import { auditAjo, notifyPermissionHolders, notifyUser, permissionHolderIds } from './ajo-support';
import { assertPayoutEligible } from './ajo-verification.service';

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const MIN_REASON = 10;
const APPROVE = 'ajo.approve_payout';
const STANDING: Array<'PREPARED' | 'APPROVED' | 'PAID'> = ['PREPARED', 'APPROVED', 'PAID'];

const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

const reasonOf = (value: string | undefined, what: string): string => {
  const text = (value ?? '').trim();
  if (text.length < MIN_REASON) throw new RuleError(`Give a reason of at least ${MIN_REASON} characters for ${what}. It stays on the record.`, 400, 'REASON_REQUIRED');
  return text.slice(0, 500);
};

type PayoutRow = Prisma.AjoPayoutGetPayload<{ include: { membership: { select: { id: true; memberId: true; member: { select: { firstName: true; lastName: true; userId: true } } } } } }>;

const snapshotOf = (p: { accountSnapshot: Prisma.JsonValue }) => p.accountSnapshot as { bankName: string; accountName: string; last4: string };
const kobo = (n: bigint) => n.toString();

/** A payout as the API sends it: kobo as strings, the account masked, no storage key. */
export function toPayoutView(p: PayoutRow) {
  const account = snapshotOf(p);
  return {
    id: p.id,
    groupId: p.groupId,
    membershipId: p.membershipId,
    recipient: `${p.membership.member.firstName} ${p.membership.member.lastName}`.trim(),
    round: p.round,
    sequence: p.sequence,
    status: p.status,
    grossKobo: kobo(p.grossKobo),
    confirmedKobo: kobo(p.confirmedKobo),
    shortfallKobo: kobo(p.shortfallKobo),
    collectorFeeKobo: kobo(p.collectorFeeKobo),
    netKobo: kobo(p.netKobo),
    net: formatNaira(p.netKobo),
    shortfall: formatNaira(p.shortfallKobo),
    account: { bankName: account.bankName, accountName: account.accountName, masked: maskAccount(account.last4) },
    preparedBy: p.preparedBy,
    preparedAt: p.preparedAt,
    approvedBy: p.approvedBy,
    approvedAt: p.approvedAt,
    selfApprovalConfirmed: p.selfApprovalConfirmed,
    paidReference: p.paidReference,
    paidAt: p.paidAt,
    hasProof: p.proofKey !== null,
    voidReason: p.voidReason,
    failed: p.failed,
    reversedAt: p.reversedAt,
    reverseReason: p.reverseReason,
  };
}

const include = { membership: { select: { id: true, memberId: true, member: { select: { firstName: true, lastName: true, userId: true } } } } } as const;

// ---------------------------------------------------------------------------------------------------------------------------------
// Who is being paid, and the figures
// ---------------------------------------------------------------------------------------------------------------------------------

interface Recipient {
  membershipId: number;
  memberId: number;
  userId: number | null;
  name: string;
  shares: number;
  status: string;
}

interface Target {
  group: Awaited<ReturnType<typeof loadGroup>>;
  recipient: Recipient;
  /** The round (rotating pot) or null (collector thrift). */
  round: number | null;
  dueDate: Date | null;
}

async function loadGroup(db: Db, associationId: number, groupId: number) {
  const group = await db.ajoGroup.findFirst({ where: { id: groupId, associationId } });
  if (!group) throw new RuleError('That circle was not found.', 404, 'GROUP_NOT_FOUND');
  return group;
}

/** Rotating pot: the holder of the slot in that round. Collector thrift: the named participant. */
async function resolveTarget(db: Db, group: Awaited<ReturnType<typeof loadGroup>>, input: { round?: number; membershipId?: number }): Promise<Target> {
  const pick = { id: true, memberId: true, shares: true, status: true, member: { select: { firstName: true, lastName: true, userId: true } } } as const;
  if (group.model === 'ROTATING_POT') {
    if (!input.round || !Number.isInteger(input.round) || input.round < 1 || input.round > (group.rounds ?? 0)) {
      throw new RuleError(`Choose a round between 1 and ${group.rounds ?? 0}.`, 400, 'INVALID_ROUND');
    }
    const slot = await db.ajoPayoutSlot.findFirst({ where: { groupId: group.id, position: input.round }, include: { membership: { select: pick } } });
    if (!slot) throw new RuleError('That round has no payout slot. The order has not been drawn.', 409, 'ORDER_NOT_DRAWN');
    if (input.membershipId && input.membershipId !== slot.membershipId) throw new RuleError('That person does not hold the slot for this round.', 409, 'WRONG_RECIPIENT');
    const m = slot.membership;
    const { dates } = groupDates({ model: group.model, frequency: group.frequency, startDate: group.startDate, cycleLength: group.cycleLength, rounds: group.rounds });
    return { group, round: input.round, dueDate: dates[input.round - 1], recipient: { membershipId: m.id, memberId: m.memberId, userId: m.member.userId, name: `${m.member.firstName} ${m.member.lastName}`.trim(), shares: m.shares, status: m.status } };
  }
  if (!input.membershipId) throw new RuleError('Choose the participant to pay.', 400, 'INVALID_RECIPIENT');
  const m = await db.ajoMembership.findFirst({ where: { id: input.membershipId, groupId: group.id, associationId: group.associationId }, select: pick });
  if (!m) throw new RuleError('That participant was not found in this circle.', 404, 'MEMBERSHIP_NOT_FOUND');
  return { group, round: null, dueDate: null, recipient: { membershipId: m.id, memberId: m.memberId, userId: m.member.userId, name: `${m.member.firstName} ${m.member.lastName}`.trim(), shares: m.shares, status: m.status } };
}

interface Gathered {
  /** Collector thrift: what this saver pays each time in the cycle being paid out, and what they carried in from the cycle before. */
  cycleAmountKobo: bigint | null;
  carriedKobo: bigint;
  scheduledKobo: bigint;
  confirmedKobo: bigint;
  short: Array<{ membershipId: number; name: string; shortKobo: bigint }>;
  recipientArrearsKobo: bigint;
  earlier: Array<{ id: number; status: string; sequence: number; netKobo: bigint; feeKobo: bigint }>;
}

/** What the round (or cycle) was scheduled to bring in, what is confirmed, who is short, and what has already been planned or paid out of it. */
async function gather(db: Db, target: Target, today: Date, excludePayoutId?: number): Promise<Gathered> {
  const { group, recipient, round } = target;
  // Collector thrift pays out one cycle at a time: only the running cycle's installments, plus what the saver carried in.
  const cycle = round === null ? await db.ajoMembershipCycle.findUnique({ where: { membershipId_cycleNo: { membershipId: recipient.membershipId, cycleNo: group.cycleNo } } }) : null;
  const rows = await db.ajoInstallment.findMany({
    where: round !== null ? { membership: { groupId: group.id }, dueDate: target.dueDate as Date, status: { not: 'WAIVED' } } : { membershipId: recipient.membershipId, cycleNo: group.cycleNo, status: { not: 'WAIVED' } },
    include: { membership: { select: { id: true, member: { select: { firstName: true, lastName: true } } } } },
  });
  const scheduledKobo = rows.reduce((s, r) => s + r.amountKobo, 0n);
  const confirmedKobo = rows.reduce((s, r) => s + r.paidKobo, 0n);
  const shortBy = new Map<number, { name: string; shortKobo: bigint }>();
  for (const r of rows) {
    const left = r.amountKobo - r.paidKobo;
    if (left > 0n) {
      const cur = shortBy.get(r.membershipId);
      shortBy.set(r.membershipId, { name: `${r.membership.member.firstName} ${r.membership.member.lastName}`.trim(), shortKobo: (cur?.shortKobo ?? 0n) + left });
    }
  }

  const own = await db.ajoInstallment.findMany({ where: { membershipId: recipient.membershipId, status: { not: 'WAIVED' }, dueDate: { lte: today } }, select: { amountKobo: true, paidKobo: true } });
  const recipientArrearsKobo = own.reduce((s, r) => s + (r.amountKobo > r.paidKobo ? r.amountKobo - r.paidKobo : 0n), 0n);

  const earlier = await db.ajoPayout.findMany({
    where: { groupId: group.id, membershipId: recipient.membershipId, round, ...(round === null ? { cycleNo: group.cycleNo } : {}), status: { in: STANDING }, ...(excludePayoutId ? { id: { not: excludePayoutId } } : {}) },
    orderBy: { id: 'asc' },
    select: { id: true, status: true, sequence: true, netKobo: true, collectorFeeKobo: true },
  });
  return { cycleAmountKobo: cycle?.amountKobo ?? null, carriedKobo: cycle?.carriedKobo ?? 0n, scheduledKobo, confirmedKobo, short: [...shortBy.entries()].map(([membershipId, v]) => ({ membershipId, ...v })), recipientArrearsKobo, earlier: earlier.map((e) => ({ id: e.id, status: e.status, sequence: e.sequence, netKobo: e.netKobo, feeKobo: e.collectorFeeKobo })) };
}

function figuresOf(target: Target, g: Gathered): PayoutFigures {
  const { group, recipient } = target;
  return calculatePayout({
    scheduledKobo: g.scheduledKobo,
    confirmedKobo: g.confirmedKobo,
    feeType: group.collectorFeeType as FeeType,
    feeValue: group.collectorFeeValue,
    // Collector thrift: the fee in days is of this saver's own amount, so a ₦500.00 saver pays ₦500.00 and a ₦1,000.00 saver pays ₦1,000.00.
    perInstallmentKobo: group.model === 'ROTATING_POT' ? group.contributionKobo * BigInt(recipient.shares) : g.cycleAmountKobo ?? group.contributionKobo,
    carriedKobo: g.carriedKobo,
    earlier: g.earlier.map((e) => ({ netKobo: e.netKobo, feeKobo: e.feeKobo })),
  });
}

/** When may this payout be prepared at all? The group must be running, the round's date must have come, and earlier rounds must be paid. */
async function assertReady(db: Db, target: Target, now: Date): Promise<void> {
  const { group, round } = target;
  if (group.status !== 'ACTIVE') throw new RuleError(group.status === 'COMPLETED' ? 'This group is complete.' : 'This group is not running, so there is nothing to pay out.', 409, 'GROUP_NOT_ACTIVE');
  const today = businessDay(now, group.timezone, group.cutoffTime);
  if (round !== null) {
    if (today.getTime() < (target.dueDate as Date).getTime()) throw new RuleError(`Round ${round} is not due until ${(target.dueDate as Date).toISOString().slice(0, 10)}.`, 409, 'ROUND_NOT_DUE');
    if (round > 1) {
      const before = await db.ajoPayout.findFirst({ where: { groupId: group.id, round: round - 1, status: 'PAID' }, select: { id: true } });
      if (!before) {
        throw new RuleError(`Round ${round - 1} has not been paid yet, and rounds are paid in the order that was drawn. Pay it first, or ask the admin to move the person who cannot be paid to a later round (an emergency exception).`, 409, 'PREVIOUS_ROUND_NOT_PAID');
      }
    }
  } else if (!group.endsOn || today.getTime() <= group.endsOn.getTime()) {
    throw new RuleError(`Collector-thrift payouts are made after the last due date${group.endsOn ? ` (${group.endsOn.toISOString().slice(0, 10)})` : ''}.`, 409, 'CYCLE_NOT_FINISHED');
  }
  const status = target.recipient.status;
  if (status !== 'ACTIVE' && !(round === null && status === 'LEFT')) throw new RuleError('Only a current participant can be paid.', 409, 'RECIPIENT_NOT_ACTIVE');
}

/**
 * Collector thrift: is anything still payable to this saver for the running cycle, and is a payout already waiting to be approved or paid?
 * The next cycle cannot start while a withdrawing saver still has either.
 */
export async function payableForSaver(db: Db, input: { associationId: number; groupId: number; membershipId: number; now: Date }) {
  const group = await loadGroup(db, input.associationId, input.groupId);
  const target = await resolveTarget(db, group, { membershipId: input.membershipId });
  const today = businessDay(input.now, group.timezone, group.cutoffTime);
  const gathered = await gather(db, target, today);
  const figures = figuresOf(target, gathered);
  return { name: target.recipient.name, netKobo: figures.netKobo, canPay: figures.canPay, standing: gathered.earlier.some((e) => e.status === 'PREPARED' || e.status === 'APPROVED') };
}

/** Run a check and report whether it passed, with the reason in words, instead of throwing. For previews. */
async function attempt(fn: () => Promise<void>): Promise<{ ok: boolean; code?: string; message?: string }> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------------------------------------------------------------

export interface TargetInput {
  associationId: number;
  groupId: number;
  round?: number;
  membershipId?: number;
  now?: Date;
}

/**
 * Everything an officer or admin needs to decide about a payout before it exists: the figures, who is short, the recipient's own arrears,
 * whether it can be prepared now and if not why, and any payout of the same round already standing.
 */
export async function previewPayout(input: TargetInput) {
  const now = input.now ?? new Date();
  const group = await loadGroup(prisma, input.associationId, input.groupId);
  const target = await resolveTarget(prisma, group, input);
  const today = businessDay(now, group.timezone, group.cutoffTime);
  const gathered = await gather(prisma, target, today);
  const figures = figuresOf(target, gathered);

  const readiness = await attempt(() => assertReady(prisma, target, now));
  const eligibility = await attempt(() => assertPayoutEligible(prisma, { associationId: input.associationId, membershipId: target.recipient.membershipId, now }));
  const account = await prisma.ajoPayoutAccount.findUnique({ where: { memberId: target.recipient.memberId }, select: { bankName: true, accountName: true, last4: true } });
  const open = gathered.earlier.find((e) => e.status === 'PREPARED' || e.status === 'APPROVED');

  return {
    groupId: group.id,
    round: target.round,
    dueDate: target.dueDate,
    membershipId: target.recipient.membershipId,
    recipient: target.recipient.name,
    grossKobo: kobo(figures.grossKobo),
    confirmedKobo: kobo(figures.confirmedKobo),
    shortfallKobo: kobo(figures.shortfallKobo),
    totalFeeKobo: kobo(figures.totalFeeKobo),
    feeKobo: kobo(figures.feeKobo),
    netKobo: kobo(figures.netKobo),
    net: formatNaira(figures.netKobo),
    alreadyPlannedKobo: kobo(figures.earlierNetKobo),
    explanation: figures.explanation,
    shortfall: gathered.short.map((s) => ({ membershipId: s.membershipId, name: s.name, shortKobo: kobo(s.shortKobo), short: formatNaira(s.shortKobo) })),
    recipientArrearsKobo: kobo(gathered.recipientArrearsKobo),
    recipientArrearsNote: gathered.recipientArrearsKobo > 0n ? `${target.recipient.name} is behind on their own contributions by ${formatNaira(gathered.recipientArrearsKobo)}. This does not stop the payout; the group decides.` : null,
    canPrepare: readiness.ok && eligibility.ok && figures.canPay && !open,
    readiness,
    eligibility,
    nothingToPay: !figures.canPay,
    openPayoutId: open?.id ?? null,
    earlier: gathered.earlier.map((e) => ({ id: e.id, status: e.status, sequence: e.sequence, netKobo: kobo(e.netKobo) })),
    account: account ? { bankName: account.bankName, accountName: account.accountName, masked: maskAccount(account.last4) } : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Prepare
// ---------------------------------------------------------------------------------------------------------------------------------

/** Cycle 1 keeps the key it always had; later cycles of a collector-thrift saver carry the cycle in it so a new cycle's payout is a new payout. */
const payoutKey = (groupId: number, membershipId: number, round: number | null, sequence: number, cycleNo = 1) => `ajo:payout:${groupId}:${membershipId}:${round ?? (cycleNo > 1 ? `c${cycleNo}` : 'c')}:${sequence}`;

/** Prepare a payout for the figures as they stand. Repeating the request while one is open returns that one. */
export async function preparePayout(input: TargetInput & { actorUserId: number }) {
  const now = input.now ?? new Date();
  const result = await prisma.$transaction(
    async (tx) => {
      // One preparation at a time per group, so two officers cannot both prepare the same round.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ajo-payout:' + input.groupId}))`;
      const group = await loadGroup(tx, input.associationId, input.groupId);
      const target = await resolveTarget(tx, group, input);
      await assertReady(tx, target, now);

      const today = businessDay(now, group.timezone, group.cutoffTime);
      const gathered = await gather(tx, target, today);
      const open = gathered.earlier.find((e) => e.status === 'PREPARED' || e.status === 'APPROVED');
      if (open) {
        const existing = await tx.ajoPayout.findUniqueOrThrow({ where: { id: open.id }, include });
        return { payout: existing, replayed: true, recipientUserId: target.recipient.userId, groupName: group.name };
      }

      // Checked after the replay above: a person who changed their account since cannot be prepared for.
      await assertPayoutEligible(tx, { associationId: input.associationId, membershipId: target.recipient.membershipId, now });
      const figures = figuresOf(target, gathered);
      if (!figures.canPay) throw new RuleError(figures.explanation.join(' '), 409, 'NOTHING_TO_PAY');

      const account = await tx.ajoPayoutAccount.findUniqueOrThrow({ where: { memberId: target.recipient.memberId }, select: { bankName: true, accountName: true, last4: true } });
      const last = await tx.ajoPayout.findFirst({ where: { groupId: group.id, membershipId: target.recipient.membershipId, round: target.round, ...(target.round === null ? { cycleNo: group.cycleNo } : {}) }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
      const sequence = (last?.sequence ?? 0) + 1;
      const created = await tx.ajoPayout.create({
        data: {
          associationId: input.associationId,
          groupId: group.id,
          membershipId: target.recipient.membershipId,
          round: target.round,
          cycleNo: target.round === null ? group.cycleNo : 1,
          sequence,
          grossKobo: figures.grossKobo,
          confirmedKobo: figures.confirmedKobo,
          collectorFeeKobo: figures.feeKobo,
          shortfallKobo: figures.shortfallKobo,
          netKobo: figures.netKobo,
          status: 'PREPARED',
          preparedBy: input.actorUserId,
          preparedAt: now,
          accountSnapshot: { bankName: account.bankName, accountName: account.accountName, last4: account.last4 },
          idempotencyKey: payoutKey(group.id, target.recipient.membershipId, target.round, sequence, target.round === null ? group.cycleNo : 1),
        },
        include,
      });
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_PAYOUT_PREPARED', tableName: 'ajo_payouts', recordId: created.id, newValues: { membershipId: target.recipient.membershipId, round: target.round, sequence, grossKobo: figures.grossKobo.toString(), shortfallKobo: figures.shortfallKobo.toString(), feeKobo: figures.feeKobo.toString(), netKobo: figures.netKobo.toString(), account: maskAccount(account.last4) } });
      return { payout: created, replayed: false, recipientUserId: target.recipient.userId, groupName: group.name };
    },
    { timeout: 20_000 },
  );

  if (!result.replayed) {
    await notifyPermissionHolders(input.associationId, APPROVE, { pushType: 'ajo.payout_prepared', entityId: result.payout.id, title: 'A payout is waiting for approval', message: `A payout of ${formatNaira(result.payout.netKobo)} to ${result.payout.membership.member.firstName} ${result.payout.membership.member.lastName} in ${result.groupName} needs your decision.` }, input.actorUserId);
  }
  return { payout: toPayoutView(result.payout), replayed: result.replayed };
}

/** Collector thrift: prepare for everyone who is ready, and list the ones who are not with the reason. */
export async function prepareAllReady(input: { associationId: number; groupId: number; actorUserId: number; now?: Date }) {
  const group = await loadGroup(prisma, input.associationId, input.groupId);
  if (group.model !== 'COLLECTOR_THRIFT') throw new RuleError('Only collector thrift pays everyone at once. A rotating pot pays one round at a time.', 409, 'NOT_COLLECTOR_THRIFT');
  const people = await prisma.ajoMembership.findMany({ where: { groupId: group.id, status: { in: ['ACTIVE', 'LEFT'] } }, orderBy: { id: 'asc' }, select: { id: true, member: { select: { firstName: true, lastName: true } } } });
  const prepared: Array<ReturnType<typeof toPayoutView>> = [];
  const notReady: Array<{ membershipId: number; name: string; code: string; message: string }> = [];
  for (const p of people) {
    const name = `${p.member.firstName} ${p.member.lastName}`.trim();
    try {
      const done = await preparePayout({ associationId: input.associationId, groupId: group.id, membershipId: p.id, actorUserId: input.actorUserId, now: input.now });
      if (!done.replayed) prepared.push(done.payout);
    } catch (error) {
      if (error instanceof RuleError) notReady.push({ membershipId: p.id, name, code: error.code, message: error.message });
      else throw error;
    }
  }
  return { prepared, notReady };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * The preparer, and the recipient, cannot approve. The one exception is a group with a single person who can approve: they may approve
 * their own preparation (or their own payout) by saying so, with a note. It is flagged on the record and every officer is told.
 */
async function assertMayApprove(tx: Tx, input: { associationId: number; actorUserId: number; preparedBy: number; recipientUserId: number | null; confirmSelfApproval?: boolean; note?: string }) {
  if (input.preparedBy !== input.actorUserId && input.recipientUserId !== input.actorUserId) return { self: false, note: input.note?.trim() || null };
  const holders = await permissionHolderIds(tx, input.associationId, APPROVE);
  const sole = holders.length <= 1 && holders.includes(input.actorUserId);
  if (!sole) throw new RuleError('You prepared this payout, or it is yours, so another admin has to approve it.', 403, 'SELF_APPROVAL_NOT_ALLOWED');
  const note = (input.note ?? '').trim();
  if (!input.confirmSelfApproval || note.length < MIN_REASON) {
    throw new RuleError('You are the only admin who can approve in this circle. To approve your own preparation or payout, say so (confirmSelfApproval) and write a note of at least 10 characters saying why. Every officer is told.', 403, 'SELF_APPROVAL_NEEDS_CONFIRMATION');
  }
  return { self: true, note };
}

/** Void a payout because its recipient changed their payout account since it was prepared. */
async function voidForAccountChange(tx: Tx, payout: PayoutRow, now: Date) {
  await tx.ajoPayout.updateMany({ where: { id: payout.id, status: { in: ['PREPARED', 'APPROVED'] } }, data: { status: 'VOID', voidReason: 'The recipient changed their payout account after this payout was prepared.', voidedAt: now } });
}

async function accountChanged(db: Db, payout: PayoutRow): Promise<boolean> {
  const snap = snapshotOf(payout);
  const current = await db.ajoPayoutAccount.findUnique({ where: { memberId: payout.membership.memberId }, select: { bankName: true, accountName: true, last4: true } });
  return !current || current.bankName !== snap.bankName || current.accountName !== snap.accountName || current.last4 !== snap.last4;
}

/** Money reversed after a payout was prepared can leave it paying out more than was confirmed. Catch that before anything is approved or paid. */
async function assertStillCovered(db: Db, payout: PayoutRow, now: Date): Promise<void> {
  const group = await loadGroup(db, payout.associationId, payout.groupId);
  const target = await resolveTarget(db, group, { round: payout.round ?? undefined, membershipId: payout.membershipId });
  const today = businessDay(now, group.timezone, group.cutoffTime);
  const g = await gather(db, target, today, payout.id);
  const planned = g.earlier.reduce((s, e) => s + e.netKobo + e.feeKobo, 0n);
  if (g.confirmedKobo + g.carriedKobo - planned < payout.netKobo + payout.collectorFeeKobo) {
    throw new RuleError('Some of the money behind this payout was reversed after it was prepared, so it would now pay out more than has been confirmed. Void it and prepare it again.', 409, 'PAYOUT_NOT_COVERED');
  }
}

export async function approvePayout(input: { associationId: number; payoutId: number; actorUserId: number; confirmSelfApproval?: boolean; note?: string; now?: Date }) {
  const now = input.now ?? new Date();
  let changedAccount = false;
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM ajo_payouts WHERE id = ${input.payoutId} AND association_id = ${input.associationId} FOR UPDATE`;
      const p = await tx.ajoPayout.findFirst({ where: { id: input.payoutId, associationId: input.associationId }, include });
      if (!p) throw new RuleError('That payout was not found.', 404, 'PAYOUT_NOT_FOUND');
      if (p.status === 'APPROVED') return { payout: p, replayed: true, self: false };
      if (p.status !== 'PREPARED') throw new RuleError(`A ${p.status.toLowerCase()} payout cannot be approved.`, 409, 'INVALID_PAYOUT_STATE');

      const self = await assertMayApprove(tx, { associationId: input.associationId, actorUserId: input.actorUserId, preparedBy: p.preparedBy, recipientUserId: p.membership.member.userId, confirmSelfApproval: input.confirmSelfApproval, note: input.note });
      if (await accountChanged(tx, p)) {
        await voidForAccountChange(tx, p, now);
        changedAccount = true;
        return { payout: p, replayed: false, self: false };
      }
      await assertPayoutEligible(tx, { associationId: input.associationId, membershipId: p.membershipId, now });
      await assertStillCovered(tx, p, now);

      const won = await tx.ajoPayout.updateMany({ where: { id: p.id, status: 'PREPARED' }, data: { status: 'APPROVED', approvedBy: input.actorUserId, approvedAt: now, selfApprovalConfirmed: self.self, approvalNote: self.note } });
      if (won.count !== 1) throw new RuleError('This payout was just decided by someone else.', 409, 'INVALID_PAYOUT_STATE');
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_PAYOUT_APPROVED', tableName: 'ajo_payouts', recordId: p.id, oldValues: { status: 'PREPARED' }, newValues: { status: 'APPROVED', selfApproval: self.self, note: self.note } });
      const approved = await tx.ajoPayout.findUniqueOrThrow({ where: { id: p.id }, include });
      return { payout: approved, replayed: false, self: self.self };
    },
    { timeout: 20_000 },
  );

  if (changedAccount) {
    await notifyPermissionHolders(input.associationId, APPROVE, { pushType: 'ajo.payout_voided', entityId: result.payout.id, title: 'A payout was cancelled', message: 'A payout was cancelled because the recipient changed their payout account. They must be verified again before it can be prepared.' });
    throw new RuleError('The recipient changed their payout account after this payout was prepared, so it has been cancelled. They have to be verified again, and the payout prepared again.', 409, 'ACCOUNT_CHANGED');
  }
  if (!result.replayed) {
    await notifyPermissionHolders(input.associationId, 'ajo.reconcile', { pushType: 'ajo.payout_approved', entityId: result.payout.id, title: 'A payout is ready to be paid', message: `A payout of ${formatNaira(result.payout.netKobo)} to ${result.payout.membership.member.firstName} ${result.payout.membership.member.lastName} is approved. Pay it from the group's account, then record the bank reference.` });
    if (result.self) await notifyPermissionHolders(input.associationId, 'ajo.manage', { pushType: 'ajo.payout_self_approved', entityId: result.payout.id, title: 'A payout was approved by its own preparer', message: 'The only admin approved a payout they prepared or received, with a note. It is flagged on the record.' }, input.actorUserId);
  }
  return { payout: toPayoutView(result.payout), replayed: result.replayed };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Void, fail
// ---------------------------------------------------------------------------------------------------------------------------------

export interface VoidInput {
  associationId: number;
  payoutId: number;
  actorUserId: number;
  /** True when the caller holds ajo.approve_payout. */
  actorIsAdmin: boolean;
  reason: string;
  /** The bank transfer failed (rather than the payout being cancelled). Only an approved payout can fail. */
  failed?: boolean;
  now?: Date;
}

/**
 * Stop a payout that has not been recorded as paid. The preparer may cancel their own prepared payout; an admin may void any open one;
 * whoever finds a bank transfer failed marks an approved payout failed. It writes nothing to the ledger and the round returns to pending.
 */
export async function voidPayout(input: VoidInput) {
  const now = input.now ?? new Date();
  const reason = reasonOf(input.reason, input.failed ? 'a failed transfer' : 'cancelling a payout');
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ajo_payouts WHERE id = ${input.payoutId} AND association_id = ${input.associationId} FOR UPDATE`;
    const p = await tx.ajoPayout.findFirst({ where: { id: input.payoutId, associationId: input.associationId }, include });
    if (!p) throw new RuleError('That payout was not found.', 404, 'PAYOUT_NOT_FOUND');
    if (p.status === 'VOID') return { payout: p, replayed: true };
    if (p.status === 'PAID' || p.status === 'REVERSED') throw new RuleError('This payout has been recorded as paid. If it was a mistake, or the money came back, an admin reverses it.', 409, 'PAYOUT_ALREADY_PAID');
    if (input.failed && p.status !== 'APPROVED') throw new RuleError('Only an approved payout can fail at the bank. Cancel a prepared one instead.', 409, 'INVALID_PAYOUT_STATE');
    if (!input.actorIsAdmin && !(p.status === 'PREPARED' && p.preparedBy === input.actorUserId) && !input.failed) {
      throw new RuleError('Only an admin can void this payout. You can cancel one you prepared that is still waiting for approval.', 403, 'FORBIDDEN');
    }
    const won = await tx.ajoPayout.updateMany({ where: { id: p.id, status: { in: ['PREPARED', 'APPROVED'] } }, data: { status: 'VOID', voidReason: reason, failed: input.failed === true, voidedBy: input.actorUserId, voidedAt: now } });
    if (won.count !== 1) throw new RuleError('This payout was just decided by someone else.', 409, 'INVALID_PAYOUT_STATE');
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: input.failed ? 'AJO_PAYOUT_FAILED' : 'AJO_PAYOUT_VOIDED', tableName: 'ajo_payouts', recordId: p.id, oldValues: { status: p.status }, newValues: { status: 'VOID', reason, failed: input.failed === true } });
    return { payout: await tx.ajoPayout.findUniqueOrThrow({ where: { id: p.id }, include }), replayed: false };
  });

  if (!result.replayed) {
    const who = `${result.payout.membership.member.firstName} ${result.payout.membership.member.lastName}`.trim();
    await notifyPermissionHolders(input.associationId, APPROVE, { pushType: 'ajo.payout_voided', entityId: result.payout.id, title: input.failed ? 'A payout failed' : 'A payout was cancelled', message: `The payout of ${formatNaira(result.payout.netKobo)} to ${who} ${input.failed ? 'failed at the bank' : 'was cancelled'}: ${reason}. The round is back to pending.` }, input.actorUserId);
    if (result.payout.preparedBy !== input.actorUserId) await notifyUser(input.associationId, result.payout.preparedBy, { pushType: 'ajo.payout_voided', entityId: result.payout.id, title: input.failed ? 'A payout failed' : 'A payout was cancelled', message: `The payout to ${who} ${input.failed ? 'failed at the bank' : 'was cancelled'}: ${reason}.` });
  }
  return { payout: toPayoutView(result.payout), replayed: result.replayed };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Record as paid
// ---------------------------------------------------------------------------------------------------------------------------------

export interface RecordPaidInput {
  associationId: number;
  payoutId: number;
  actorUserId: number;
  /** The bank's reference for the transfer the group made. */
  reference: string;
  proof?: { buffer: Buffer; mimeType: string };
  confirmOwn?: boolean;
  note?: string;
  now?: Date;
}

const ledgerKey = (payoutId: number, part: 'paid' | 'fee' | 'reverse' | 'fee-reverse') => `ajo:payout:${payoutId}:${part}`;

/**
 * An officer records that the group paid, from its own account, and the bank's reference. SocietyLedger sends nothing to any bank. This is
 * the only step that writes the ledger: one debit for the net payout and, if there was one, one for the collector fee.
 */
export async function recordPayoutPaid(input: RecordPaidInput) {
  const now = input.now ?? new Date();
  const reference = (input.reference ?? '').trim();
  const referenceKey = normaliseBankReference(reference);
  if (!referenceKey) throw new RuleError('Enter the bank’s reference for this transfer (at least 4 characters).', 400, 'REFERENCE_REQUIRED');
  if (input.proof) {
    if (!(PROOF_TYPES as readonly string[]).includes(input.proof.mimeType)) throw new RuleError('The proof must be a JPEG, PNG or WebP picture, or a PDF.', 400, 'INVALID_PROOF');
    if (input.proof.buffer.length === 0 || input.proof.buffer.length > MAX_PROOF_BYTES) throw new RuleError('The proof must be larger than zero and no bigger than 5 MB.', 400, 'INVALID_PROOF');
  }

  let changedAccount = false;
  const stored: string[] = [];
  let result: { payout: PayoutRow; replayed: boolean };
  try {
  result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM ajo_payouts WHERE id = ${input.payoutId} AND association_id = ${input.associationId} FOR UPDATE`;
      const p = await tx.ajoPayout.findFirst({ where: { id: input.payoutId, associationId: input.associationId }, include });
      if (!p) throw new RuleError('That payout was not found.', 404, 'PAYOUT_NOT_FOUND');
      if (p.status === 'PAID') {
        if (p.paidReferenceKey !== referenceKey) throw new RuleError('This payout was already recorded as paid with a different reference.', 409, 'IDEMPOTENCY_CONFLICT');
        return { payout: p, replayed: true };
      }
      if (p.status !== 'APPROVED') throw new RuleError(p.status === 'PREPARED' ? 'This payout has not been approved yet.' : `A ${p.status.toLowerCase()} payout cannot be recorded as paid.`, 409, 'INVALID_PAYOUT_STATE');

      await assertMayConfirm(tx, { associationId: input.associationId, actorUserId: input.actorUserId, conflicted: p.membership.member.userId === input.actorUserId, confirmOwn: input.confirmOwn, note: input.note, what: 'payout' });
      if (await accountChanged(tx, p)) {
        await voidForAccountChange(tx, p, now);
        changedAccount = true;
        return { payout: p, replayed: false };
      }
      await assertPayoutEligible(tx, { associationId: input.associationId, membershipId: p.membershipId, now });
      await assertStillCovered(tx, p, now);

      const duplicate = await tx.ajoPayout.findFirst({ where: { associationId: input.associationId, paidReferenceKey: referenceKey, status: 'PAID', id: { not: p.id } }, select: { id: true } });
      if (duplicate) throw new RuleError('That bank reference is already recorded against another payout. One transfer cannot pay two payouts.', 409, 'DUPLICATE_PAYOUT_REFERENCE');

      let proofKey: string | null = null;
      if (input.proof) {
        proofKey = `ajo/payout-proofs/${input.associationId}/${p.groupId}/${randomUUID()}.${EXTENSION[input.proof.mimeType]}`;
        await uploadFile(proofKey, input.proof.buffer, input.proof.mimeType);
        stored.push(proofKey);
      }

      const won = await tx.ajoPayout.updateMany({ where: { id: p.id, status: 'APPROVED' }, data: { status: 'PAID', paidReference: reference, paidReferenceKey: referenceKey, paidAt: now, paidRecordedBy: input.actorUserId, proofKey } });
      if (won.count !== 1) throw new RuleError('This payout was just decided by someone else.', 409, 'INVALID_PAYOUT_STATE');

      try {
        await recordEntry(tx as unknown as LedgerDb, { associationId: input.associationId, groupId: p.groupId, membershipId: p.membershipId, type: 'PAYOUT', direction: 'DEBIT', amountKobo: p.netKobo, refType: 'payout', refId: p.id, idempotencyKey: ledgerKey(p.id, 'paid'), createdBy: input.actorUserId });
        if (p.collectorFeeKobo > 0n) {
          await recordEntry(tx as unknown as LedgerDb, { associationId: input.associationId, groupId: p.groupId, membershipId: p.membershipId, type: 'FEE', direction: 'DEBIT', amountKobo: p.collectorFeeKobo, refType: 'payout', refId: p.id, idempotencyKey: ledgerKey(p.id, 'fee'), createdBy: input.actorUserId });
        }
      } catch (error) {
        if (error instanceof LedgerError) throw new RuleError(error.message, 409, error.code);
        throw error;
      }
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_PAYOUT_PAID', tableName: 'ajo_payouts', recordId: p.id, oldValues: { status: 'APPROVED' }, newValues: { status: 'PAID', netKobo: p.netKobo.toString(), feeKobo: p.collectorFeeKobo.toString(), reference, hasProof: proofKey !== null } });
      return { payout: await tx.ajoPayout.findUniqueOrThrow({ where: { id: p.id }, include }), replayed: false };
    },
    { timeout: 20_000 },
  );
  } catch (error) {
    // A file stored for a record that did not happen is removed again.
    for (const key of stored) await deleteFile(key).catch(() => undefined);
    throw error;
  }

  if (changedAccount) {
    await notifyPermissionHolders(input.associationId, APPROVE, { pushType: 'ajo.payout_voided', entityId: result.payout.id, title: 'A payout was cancelled', message: 'A payout was cancelled before it was recorded because the recipient changed their payout account. Do not pay it.' });
    throw new RuleError('The recipient changed their payout account, so this payout was cancelled and nothing was recorded. Do not pay it.', 409, 'ACCOUNT_CHANGED');
  }
  if (!result.replayed && result.payout.membership.member.userId) {
    await notifyUser(input.associationId, result.payout.membership.member.userId, { pushType: 'ajo.payout_paid', entityId: result.payout.id, title: 'Your payout has been paid', message: `${formatNaira(result.payout.netKobo)} was paid to your ${snapshotOf(result.payout).bankName} account ${maskAccount(snapshotOf(result.payout).last4)}. Reference ${reference}.` });
  }
  return { payout: toPayoutView(result.payout), replayed: result.replayed };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reverse a paid payout
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * An admin reverses a payout that was recorded as paid (the money came back, or it was recorded in error), with a reason. The ledger gets
 * reversal entries, the round returns to pending, and nothing is edited or deleted.
 */
export async function reversePaidPayout(input: { associationId: number; payoutId: number; actorUserId: number; reason: string; now?: Date }) {
  const now = input.now ?? new Date();
  const reason = reasonOf(input.reason, 'reversing a paid payout');
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ajo_payouts WHERE id = ${input.payoutId} AND association_id = ${input.associationId} FOR UPDATE`;
    const p = await tx.ajoPayout.findFirst({ where: { id: input.payoutId, associationId: input.associationId }, include });
    if (!p) throw new RuleError('That payout was not found.', 404, 'PAYOUT_NOT_FOUND');
    if (p.status === 'REVERSED') return { payout: p, replayed: true };
    if (p.status !== 'PAID') throw new RuleError('Only a payout recorded as paid can be reversed. Void one that was never paid.', 409, 'NOT_PAID');

    const won = await tx.ajoPayout.updateMany({ where: { id: p.id, status: 'PAID' }, data: { status: 'REVERSED', reversedBy: input.actorUserId, reversedAt: now, reverseReason: reason } });
    if (won.count !== 1) throw new RuleError('This payout was just changed by someone else.', 409, 'INVALID_PAYOUT_STATE');
    try {
      const entry = await tx.ajoLedgerEntry.findUnique({ where: { idempotencyKey: ledgerKey(p.id, 'paid') } });
      if (!entry) throw new RuleError('The ledger entry for this payout was not found. Ask support.', 409, 'ENTRY_NOT_FOUND');
      await reverseEntry(tx as unknown as LedgerDb, { associationId: input.associationId, entryId: entry.id, reason, idempotencyKey: ledgerKey(p.id, 'reverse'), createdBy: input.actorUserId });
      if (p.collectorFeeKobo > 0n) {
        const fee = await tx.ajoLedgerEntry.findUnique({ where: { idempotencyKey: ledgerKey(p.id, 'fee') } });
        if (fee) await reverseEntry(tx as unknown as LedgerDb, { associationId: input.associationId, entryId: fee.id, reason, idempotencyKey: ledgerKey(p.id, 'fee-reverse'), createdBy: input.actorUserId });
      }
    } catch (error) {
      if (error instanceof LedgerError) throw new RuleError(error.message, 409, error.code);
      throw error;
    }
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_PAYOUT_REVERSED', tableName: 'ajo_payouts', recordId: p.id, oldValues: { status: 'PAID' }, newValues: { status: 'REVERSED', reason } });
    return { payout: await tx.ajoPayout.findUniqueOrThrow({ where: { id: p.id }, include }), replayed: false };
  });

  if (!result.replayed) {
    const who = `${result.payout.membership.member.firstName} ${result.payout.membership.member.lastName}`.trim();
    await notifyPermissionHolders(input.associationId, APPROVE, { pushType: 'ajo.payout_reversed', entityId: result.payout.id, title: 'A paid payout was reversed', message: `The payout of ${formatNaira(result.payout.netKobo)} to ${who} was reversed: ${reason}. The round is back to pending.` }, input.actorUserId);
    if (result.payout.membership.member.userId) await notifyUser(input.associationId, result.payout.membership.member.userId, { pushType: 'ajo.payout_reversed', entityId: result.payout.id, title: 'A payout was reversed', message: `Your payout of ${formatNaira(result.payout.netKobo)} was reversed: ${reason}.` });
  }
  return { payout: toPayoutView(result.payout), replayed: result.replayed };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------------------------------------------

export async function listPayouts(input: { associationId: number; groupId: number; status?: string; round?: number }) {
  await loadGroup(prisma, input.associationId, input.groupId);
  const rows = await prisma.ajoPayout.findMany({
    where: { groupId: input.groupId, associationId: input.associationId, ...(input.status ? { status: input.status as never } : {}), ...(input.round ? { round: input.round } : {}) },
    orderBy: [{ round: 'asc' }, { id: 'asc' }],
    include,
  });
  return rows.map(toPayoutView);
}

export async function getPayout(input: { associationId: number; payoutId: number }) {
  const p = await prisma.ajoPayout.findFirst({ where: { id: input.payoutId, associationId: input.associationId }, include });
  if (!p) throw new RuleError('That payout was not found.', 404, 'PAYOUT_NOT_FOUND');
  return toPayoutView(p);
}

/** A person's own payouts: what they have been, or will be, paid. */
export async function listOwnPayouts(input: { associationId: number; userId: number }) {
  const rows = await prisma.ajoPayout.findMany({ where: { associationId: input.associationId, membership: { member: { userId: input.userId } } }, orderBy: { id: 'desc' }, include });
  return rows.map(toPayoutView);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Completing a group
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Close a group once its cycle is over and everything payable has been paid. It leaves the books readable. Money still owed to the group
 * (a shortfall nobody has paid) is not forgotten here: that is a default, handled in T6.
 */
export async function completeGroup(input: { associationId: number; groupId: number; actorUserId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ajo-payout:' + input.groupId}))`;
      const group = await loadGroup(tx, input.associationId, input.groupId);
      if (group.status === 'COMPLETED') return { group, replayed: true };
      if (group.status !== 'ACTIVE') throw new RuleError('Only a running circle can be completed.', 409, 'INVALID_GROUP_STATE');
      const today = businessDay(now, group.timezone, group.cutoffTime);
      if (!group.endsOn || today.getTime() <= group.endsOn.getTime()) throw new RuleError('The cycle is not over yet.', 409, 'CYCLE_NOT_FINISHED');

      const open = await tx.ajoPayout.count({ where: { groupId: group.id, status: { in: ['PREPARED', 'APPROVED'] } } });
      if (open > 0) throw new RuleError(`${open} payout${open === 1 ? ' is' : 's are'} still waiting to be approved or paid.`, 409, 'PAYOUTS_PENDING');

      // Every recipient must be fully paid for what has been confirmed.
      const waiting: string[] = [];
      if (group.model === 'ROTATING_POT') {
        for (let round = 1; round <= (group.rounds ?? 0); round++) {
          const target = await resolveTarget(tx, group, { round });
          const f = figuresOf(target, await gather(tx, target, today));
          if (f.canPay) waiting.push(`round ${round} (${target.recipient.name}): ${formatNaira(f.netKobo)}`);
        }
      } else {
        const people = await tx.ajoMembership.findMany({ where: { groupId: group.id, status: { in: ['ACTIVE', 'LEFT'] } }, select: { id: true } });
        for (const person of people) {
          const target = await resolveTarget(tx, group, { membershipId: person.id });
          const f = figuresOf(target, await gather(tx, target, today));
          if (f.canPay) waiting.push(`${target.recipient.name}: ${formatNaira(f.netKobo)}`);
        }
      }
      if (waiting.length) throw new RuleError(`These are still payable: ${waiting.join('; ')}. Pay them, or void and re-prepare, before completing the circle.`, 409, 'PAYOUTS_PENDING');

      const done = await tx.ajoGroup.update({ where: { id: group.id }, data: { status: 'COMPLETED' } });
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_GROUP_COMPLETED', tableName: 'ajo_groups', recordId: group.id, oldValues: { status: 'ACTIVE' }, newValues: { status: 'COMPLETED' } });
      return { group: done, replayed: false };
    },
    { timeout: 30_000 },
  );
  return { groupId: result.group.id, status: result.group.status, replayed: result.replayed };
}
