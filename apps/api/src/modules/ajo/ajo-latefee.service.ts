/**
 * Late fees (T6.1, T6.2).
 *
 * A fee is assessed once for each overdue instalment, after grace, only if the rules the member had ACCEPTED and that were in force on the
 * due date have a late fee. It is never retroactive and it keeps its calculation in words. It is shown to the member first (pending) and
 * can only become payable after they have been told AND a 48-hour notice window has passed with no dispute open on that instalment. A
 * member who could not be reached is not charged for something they were never shown.
 *
 * It is paid through the normal payment flow after the instalments (see ajo-allocation.service.ts), and it is the group's own income:
 * a separate FEE credit in the ledger, never part of any payout and never SocietyLedger's money.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { formatNaira } from './ajo-collections';
import { verificationState } from './ajo-dispute.service';
import { planShield } from './ajo-default.service';
import { memberOfMembership, messageMember } from './ajo-messenger';
import { FEE_NOTICE_HOURS, feeEligibleOn, lateFeeFor, versionInForceOn, type LateFeeRule } from './ajo-risk';
import { businessDay, dayInZone } from './ajo-schedule';
import { auditAjo, permissionHolderIds } from './ajo-support';

const HOUR_MS = 60 * 60 * 1000;

export interface RunGroup {
  id: number;
  associationId: number;
  timezone: string;
  cutoffTime: string;
  name: string;
}

/** Mark unpaid instalments past their due date as OVERDUE. A part-paid one stays PARTIAL: it is overdue by its date. Safe to repeat. */
export async function markOverdue(now: Date, groups: RunGroup[]): Promise<number> {
  let marked = 0;
  for (const g of groups) {
    const today = businessDay(now, g.timezone, g.cutoffTime);
    const done = await prisma.ajoInstallment.updateMany({ where: { membership: { groupId: g.id }, status: 'DUE', dueDate: { lt: today } }, data: { status: 'OVERDUE' } });
    marked += done.count;
  }
  return marked;
}

function ruleOf(v: { lateFeeType: string; lateFeeValue: bigint; lateFeeCapKobo: bigint | null }): LateFeeRule {
  return { lateFeeType: v.lateFeeType as LateFeeRule['lateFeeType'], lateFeeValue: v.lateFeeValue, lateFeeCapKobo: v.lateFeeCapKobo };
}

export interface AssessResult {
  assessed: number;
}

/** Assess late fees that have come due. Idempotent: an instalment is assessed once for a rule version, however often this runs. */
export async function assessLateFees(now: Date, groups: RunGroup[]): Promise<AssessResult> {
  let assessed = 0;
  for (const g of groups) {
    const today = businessDay(now, g.timezone, g.cutoffTime);
    const versions = await prisma.ajoGroupRuleVersion.findMany({ where: { groupId: g.id } });
    // A group whose rules never had a late fee has nothing to assess.
    if (!versions.some((v) => v.lateFeeType !== 'NONE' && v.lateFeeValue > 0n)) continue;
    const refs = versions.map((v) => ({ id: v.id, version: v.version, effectiveFrom: v.effectiveFrom }));
    const byId = new Map(versions.map((v) => [v.id, v]));

    const overdue = await prisma.ajoInstallment.findMany({
      where: { membership: { groupId: g.id, status: 'ACTIVE' }, status: { not: 'WAIVED' }, dueDate: { lt: today } },
      include: { membership: { select: { id: true, acceptances: { select: { ruleVersionId: true, acceptedAt: true } } } }, lateFees: { select: { id: true, ruleVersionId: true } } },
      orderBy: [{ membershipId: 'asc' }, { dueDate: 'asc' }],
    });
    const perMember = new Map<number, typeof overdue>();
    for (const i of overdue) if (i.amountKobo > i.paidKobo) perMember.set(i.membershipId, [...(perMember.get(i.membershipId) ?? []), i]);

    for (const [membershipId, items] of perMember) {
      const check = await verificationState(prisma, membershipId);
      if (check.pending) continue; // a payment is being verified or a dispute is open: nothing is done to them for being late
      const lastEnd = check.lastCheckEndedAt ? dayInZone(check.lastCheckEndedAt, g.timezone) : null;
      const shield = await planShield(prisma, membershipId, today);

      for (const i of items) {
        if (shield.has(i.id)) continue; // a kept repayment plan stops new fees on what it covers
        const versionId = versionInForceOn(i.dueDate, refs, i.membership.acceptances);
        if (versionId === null) continue; // they never accepted rules that applied on that day: no fee
        if (i.lateFees.some((f) => f.ruleVersionId === versionId)) continue;
        const v = byId.get(versionId)!;
        const fee = lateFeeFor(ruleOf(v), i.amountKobo);
        if (!fee) continue;
        if (today.getTime() < feeEligibleOn({ dueDate: i.dueDate, graceDays: v.graceDays, lastCheckEndedOn: lastEnd }).getTime()) continue;
        const made = await prisma.ajoLateFeeAssessment.createMany({
          data: [{ associationId: g.associationId, installmentId: i.id, membershipId, ruleVersionId: versionId, basisKobo: i.amountKobo, feeKobo: fee.feeKobo, capApplied: fee.capApplied, calculation: { ...fee.calculation, text: fee.text }, status: 'PENDING' }],
          skipDuplicates: true,
        });
        assessed += made.count;
      }
    }
  }
  return { assessed };
}

/** Tell members about fees that have been assessed and not yet disclosed. A fee nobody has been told about can never become payable. */
export async function noticeLateFees(now: Date, groups: RunGroup[]): Promise<{ told: number; unreachable: number }> {
  let told = 0;
  let unreachable = 0;
  for (const g of groups) {
    const fees = await prisma.ajoLateFeeAssessment.findMany({ where: { associationId: g.associationId, status: 'PENDING', notifiedAt: null, installment: { membership: { groupId: g.id } } }, include: { installment: { select: { dueDate: true } } }, take: 200 });
    for (const fee of fees) {
      const target = fee.membershipId ? await memberOfMembership(fee.membershipId) : null;
      if (!target) continue;
      const text = (fee.calculation as { text?: string } | null)?.text ?? `A late fee of ${formatNaira(fee.feeKobo)} applies.`;
      const result = await messageMember({ associationId: g.associationId, member: target.member, title: 'A late fee applies', message: `${g.name}: your payment due on ${fee.installment.dueDate.toISOString().slice(0, 10)} was late. ${text} It becomes payable in ${FEE_NOTICE_HOURS} hours. If you paid, tell your officer so it can be looked at.`, pushType: 'ajo.late_fee', entityId: fee.id, kind: 'payment_due', sms: true });
      if (result.delivered) {
        told++;
        await prisma.ajoLateFeeAssessment.updateMany({ where: { id: fee.id, notifiedAt: null }, data: { notifiedAt: now } });
      } else {
        unreachable++;
      }
    }
  }
  return { told, unreachable };
}

/** A pending fee becomes payable once the member was told, 48 hours have passed, and no dispute is open on its instalment. */
export async function promotePayableFees(now: Date, associationIds?: number[]): Promise<number> {
  const due = await prisma.ajoLateFeeAssessment.findMany({ where: { status: 'PENDING', notifiedAt: { lte: new Date(now.getTime() - FEE_NOTICE_HOURS * HOUR_MS) }, ...(associationIds ? { associationId: { in: associationIds } } : {}) }, select: { id: true, installmentId: true, membershipId: true } });
  let promoted = 0;
  for (const f of due) {
    const open = await prisma.ajoDispute.findFirst({ where: { status: 'OPEN', OR: [{ installmentId: f.installmentId }, ...(f.membershipId ? [{ membershipId: f.membershipId, installmentId: null }] : [])] }, select: { id: true } });
    if (open) continue;
    const done = await prisma.ajoLateFeeAssessment.updateMany({ where: { id: f.id, status: 'PENDING' }, data: { status: 'PAYABLE', payableAt: now } });
    promoted += done.count;
  }
  return promoted;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Officers
// ---------------------------------------------------------------------------------------------------------------------------------

/** An officer waives a fee that is still owed, with a reason. A waived fee is never counted or charged. */
export async function waiveLateFee(input: { associationId: number; feeId: number; actorUserId: number; reason: string; now?: Date }) {
  const reason = (input.reason ?? '').trim();
  if (reason.length < 10) throw new RuleError('Give a reason of at least 10 characters. It stays on the record.', 400, 'REASON_REQUIRED');
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const f = await tx.ajoLateFeeAssessment.findFirst({ where: { id: input.feeId, associationId: input.associationId } });
    if (!f) throw new RuleError('That late fee was not found.', 404, 'LATE_FEE_NOT_FOUND');
    if (f.status === 'WAIVED') return { fee: toLateFeeView(f), replayed: true };
    if (f.status === 'PAID') throw new RuleError('This fee has been paid. If it was a mistake, reverse the payment.', 409, 'INVALID_FEE_STATE');
    // An officer is also a member. Waiving their own fee is a conflict of interest, so another officer decides, unless they are the only one.
    const owner = await tx.ajoInstallment.findUnique({ where: { id: f.installmentId }, select: { membership: { select: { member: { select: { userId: true } } } } } });
    if (owner?.membership.member.userId === input.actorUserId) {
      const managers = await permissionHolderIds(tx, input.associationId, 'ajo.manage');
      if (managers.some((userId) => userId !== input.actorUserId)) throw new RuleError('This is your own late fee, so another officer has to waive it.', 403, 'SELF_WAIVER_NOT_ALLOWED');
    }
    await tx.ajoLateFeeAssessment.update({ where: { id: f.id }, data: { status: 'WAIVED', waivedBy: input.actorUserId, waivedReason: reason, waivedAt: now } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_LATE_FEE_WAIVED', tableName: 'ajo_late_fee_assessments', recordId: f.id, oldValues: { status: f.status }, newValues: { status: 'WAIVED', reason, feeKobo: f.feeKobo.toString(), paidKobo: f.paidKobo.toString() } });
    return { fee: toLateFeeView(await tx.ajoLateFeeAssessment.findUniqueOrThrow({ where: { id: f.id } })), replayed: false };
  });
}

/** A waiver is undone by a recorded reversal with a reason, never by editing it. The fee returns to where it was. */
export async function reverseWaiver(input: { associationId: number; feeId: number; actorUserId: number; reason: string; now?: Date }) {
  const reason = (input.reason ?? '').trim();
  if (reason.length < 10) throw new RuleError('Give a reason of at least 10 characters. It stays on the record.', 400, 'REASON_REQUIRED');
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const f = await tx.ajoLateFeeAssessment.findFirst({ where: { id: input.feeId, associationId: input.associationId } });
    if (!f) throw new RuleError('That late fee was not found.', 404, 'LATE_FEE_NOT_FOUND');
    if (f.status !== 'WAIVED') throw new RuleError('Only a waived fee can have its waiver reversed.', 409, 'INVALID_FEE_STATE');
    const toldLongEnough = f.notifiedAt !== null && f.notifiedAt.getTime() <= now.getTime() - FEE_NOTICE_HOURS * HOUR_MS;
    const next = f.paidKobo >= f.feeKobo ? 'PAID' : toldLongEnough ? 'PAYABLE' : 'PENDING';
    await tx.ajoLateFeeAssessment.update({ where: { id: f.id }, data: { status: next, waivedBy: null, waivedAt: null, ...(next === 'PAYABLE' ? { payableAt: now } : {}) } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_LATE_FEE_WAIVER_REVERSED', tableName: 'ajo_late_fee_assessments', recordId: f.id, oldValues: { status: 'WAIVED', waivedReason: f.waivedReason }, newValues: { status: next, reason } });
    return { fee: toLateFeeView(await tx.ajoLateFeeAssessment.findUniqueOrThrow({ where: { id: f.id } })) };
  });
}

/** An officer who told the member in person (or by phone) records it, with a note, for a member the system could not reach. */
export async function markFeeNotified(input: { associationId: number; feeId: number; actorUserId: number; note: string; now?: Date }) {
  const note = (input.note ?? '').trim();
  if (note.length < 5) throw new RuleError('Say how the member was told (for example "told in person at the market").', 400, 'NOTE_REQUIRED');
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const f = await tx.ajoLateFeeAssessment.findFirst({ where: { id: input.feeId, associationId: input.associationId } });
    if (!f) throw new RuleError('That late fee was not found.', 404, 'LATE_FEE_NOT_FOUND');
    if (f.notifiedAt) return { fee: toLateFeeView(f), replayed: true };
    await tx.ajoLateFeeAssessment.update({ where: { id: f.id }, data: { notifiedAt: now, notifiedNote: note } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_LATE_FEE_TOLD', tableName: 'ajo_late_fee_assessments', recordId: f.id, newValues: { note } });
    return { fee: toLateFeeView(await tx.ajoLateFeeAssessment.findUniqueOrThrow({ where: { id: f.id } })), replayed: false };
  });
}

type FeeRow = Prisma.AjoLateFeeAssessmentGetPayload<Record<string, never>>;

export function toLateFeeView(f: FeeRow) {
  const owed = f.status === 'PAYABLE' ? f.feeKobo - f.paidKobo : 0n;
  return {
    id: f.id,
    installmentId: f.installmentId,
    membershipId: f.membershipId,
    status: f.status,
    feeKobo: f.feeKobo.toString(),
    fee: formatNaira(f.feeKobo),
    paidKobo: f.paidKobo.toString(),
    /** What the member owes for this fee right now: nothing while it is pending, because a pending fee is shown but not owed. */
    owedKobo: owed.toString(),
    capApplied: f.capApplied,
    calculation: f.calculation,
    notifiedAt: f.notifiedAt,
    payableAt: f.payableAt,
    waivedReason: f.waivedReason,
    createdAt: f.createdAt,
  };
}

export async function listLateFees(input: { associationId: number; groupId?: number; membershipId?: number; status?: string }) {
  const rows = await prisma.ajoLateFeeAssessment.findMany({
    where: { associationId: input.associationId, ...(input.membershipId ? { membershipId: input.membershipId } : {}), ...(input.groupId ? { installment: { membership: { groupId: input.groupId } } } : {}), ...(input.status ? { status: input.status as never } : {}) },
    orderBy: { id: 'desc' },
    take: 300,
  });
  return rows.map(toLateFeeView);
}
