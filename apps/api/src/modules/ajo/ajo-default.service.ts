/**
 * Defaults and repayment plans (T6.3).
 *
 * A default is a rotating-pot participant whose payout has been recorded as paid and who then goes overdue past grace. Collector thrift has
 * none: a missed instalment there just means a smaller payout at the end. A daily job opens a case, and the group's rule decides what else
 * the system does on its own (the member's accepted rule version, as for every fee):
 *   NOTIFY_ADMIN    a case is opened and the admins are told; no plan is drafted
 *   REPAYMENT_PLAN  a case is opened and a plan is drafted and offered to the member; the admins are not pinged
 *   CASE_AND_PLAN   a case is opened, the admins are told, and a plan is drafted and offered
 *
 * Evidence is frozen when the case opens (a snapshot that is never edited) and everything after is a dated note in an append-only file.
 * A plan is a promise about timing; payments still go through the normal flow. The group decides how a case ends, with a written reason.
 * Nothing here ever deducts from other members' savings or from a guarantor, and membership status is never changed automatically.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { formatNaira } from './ajo-collections';
import { memberOfMembership, messageMember } from './ajo-messenger';
import { verificationState } from './ajo-dispute.service';
import { businessDay } from './ajo-schedule';
import { auditAjo, notifyPermissionHolders } from './ajo-support';
import { draftPlan, feeEligibleOn, trackPlan, type PlanLine } from './ajo-risk';
import { ruleVersionInForce } from './ajo-rules.service';

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const PROCEDURES = ['NOTIFY_ADMIN', 'REPAYMENT_PLAN', 'CASE_AND_PLAN'] as const;
export type Procedure = (typeof PROCEDURES)[number];
const OPEN_STATES: Array<'OPEN' | 'PLAN_AGREED'> = ['OPEN', 'PLAN_AGREED'];
export const MIN_NOTE = 5;
export const MIN_REASON = 10;

const kobo = (n: bigint) => n.toString();

/** What a member still owes in a group: overdue now, and still to come. Waived instalments are not owed. */
export async function memberOwes(db: Db, membershipId: number, today: Date) {
  const rows = await db.ajoInstallment.findMany({ where: { membershipId, status: { not: 'WAIVED' } }, orderBy: { dueDate: 'asc' } });
  const owing = rows.filter((r) => r.amountKobo > r.paidKobo);
  const overdue = owing.filter((r) => r.dueDate.getTime() < today.getTime());
  const sum = (xs: typeof owing) => xs.reduce((s, r) => s + (r.amountKobo - r.paidKobo), 0n);
  return { overdue, owing, overdueKobo: sum(overdue), stillToComeKobo: sum(owing) - sum(overdue), totalKobo: sum(owing) };
}

/** Everything confirmed against the member's instalments since a moment, net of reversals. How a plan's payments are counted. */
async function paidSince(db: Db, membershipId: number, since: Date): Promise<bigint> {
  const rows = await db.ajoContributionAllocation.findMany({ where: { installmentId: { not: null }, contribution: { membershipId, status: 'CONFIRMED', confirmedAt: { gte: since }, reversedBy: null } }, select: { amountKobo: true } });
  return rows.reduce((s, r) => s + r.amountKobo, 0n);
}

async function procedureFor(membershipId: number, groupId: number): Promise<Procedure> {
  const inForce = await ruleVersionInForce(prisma, membershipId);
  const fallback = inForce ? null : await prisma.ajoGroupRuleVersion.findFirst({ where: { groupId }, orderBy: { version: 'desc' }, select: { defaultProcedure: true } });
  const p = inForce?.rules.defaultProcedure ?? fallback?.defaultProcedure;
  return (PROCEDURES as readonly string[]).includes(p ?? '') ? (p as Procedure) : 'CASE_AND_PLAN';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Opening a case
// ---------------------------------------------------------------------------------------------------------------------------------

export interface OpenCaseInput {
  associationId: number;
  membershipId: number;
  /** The officer opening it by hand; null when the job opens it. */
  actorUserId: number | null;
  now?: Date;
}

/** Open a case for someone who was paid and then stopped paying. One case is open per person at a time. */
export async function openCase(input: OpenCaseInput) {
  const now = input.now ?? new Date();
  const opened = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ajo-case:' + input.membershipId}))`;
    const m = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, include: { group: true, member: { select: { firstName: true, lastName: true } } } });
    if (!m) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
    if (m.group.model !== 'ROTATING_POT') throw new RuleError('Only a rotating pot has defaults. In collector thrift a missed instalment just means a smaller payout at the end.', 409, 'NOT_A_ROTATING_POT');
    const existing = await tx.ajoDefaultCase.findFirst({ where: { membershipId: m.id, status: { in: OPEN_STATES } } });
    if (existing) return { case: existing, created: false, procedure: (existing.procedure ?? 'CASE_AND_PLAN') as Procedure, name: '', groupName: m.group.name };

    const payout = await tx.ajoPayout.findFirst({ where: { membershipId: m.id, status: 'PAID' }, orderBy: { id: 'desc' } });
    if (!payout) throw new RuleError('This person has not been paid out yet, so this is not a default. A late payer who has not been paid is handled by late fees and reminders.', 409, 'NOT_AFTER_PAYOUT');
    const today = businessDay(now, m.group.timezone, m.group.cutoffTime);
    const owes = await memberOwes(tx, m.id, today);
    if (owes.totalKobo <= 0n) throw new RuleError('This person owes nothing more, so there is nothing to open a case about.', 409, 'NOTHING_OWED');

    const procedure = await procedureFor(m.id, m.groupId);
    const name = `${m.member.firstName} ${m.member.lastName}`.trim();
    const snapshot = {
      takenAt: now.toISOString(),
      group: { id: m.groupId, name: m.group.name },
      member: { membershipId: m.id, name },
      procedure,
      payout: { id: payout.id, round: payout.round, netKobo: kobo(payout.netKobo), paidAt: payout.paidAt?.toISOString() ?? null, paidReference: payout.paidReference },
      overdue: owes.overdue.map((r) => ({ installmentId: r.id, dueDate: r.dueDate.toISOString().slice(0, 10), amountKobo: kobo(r.amountKobo), paidKobo: kobo(r.paidKobo) })),
      outstanding: { overdueKobo: kobo(owes.overdueKobo), stillToComeKobo: kobo(owes.stillToComeKobo), totalKobo: kobo(owes.totalKobo) },
    };
    const created = await tx.ajoDefaultCase.create({ data: { associationId: input.associationId, groupId: m.groupId, membershipId: m.id, outstandingKobo: owes.totalKobo, procedure, snapshot, openedBy: input.actorUserId } });
    await tx.ajoCaseEvent.create({ data: { associationId: input.associationId, caseId: created.id, kind: 'OPENED', note: input.actorUserId ? 'Opened by an officer.' : `Opened automatically: paid out in round ${payout.round ?? ''} and now overdue past grace. Outstanding ${formatNaira(owes.totalKobo)}.`, actorUserId: input.actorUserId } });
    // An automatic opening has no signed-in user to attribute; the case file's own OPENED event is its record.
    if (input.actorUserId) await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_DEFAULT_CASE_OPENED', tableName: 'ajo_default_cases', recordId: created.id, newValues: { membershipId: m.id, procedure, outstandingKobo: owes.totalKobo.toString(), automatic: input.actorUserId === null } });
    return { case: created, created: true, procedure, name, groupName: m.group.name };
  });

  if (opened.created) {
    const told = opened.procedure !== 'REPAYMENT_PLAN';
    if (told) {
      await notifyPermissionHolders(input.associationId, 'ajo.manage', { pushType: 'ajo.default_case', entityId: opened.case.id, title: 'A default case was opened', message: `${opened.name} was paid out in ${opened.groupName} and is now overdue past grace. ${formatNaira(opened.case.outstandingKobo)} is outstanding.` }, input.actorUserId ?? undefined);
    }
    if (opened.procedure !== 'NOTIFY_ADMIN') await proposePlan({ associationId: input.associationId, caseId: opened.case.id, actorUserId: input.actorUserId, now });
  }
  return { caseId: opened.case.id, created: opened.created, procedure: opened.procedure };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------------------------------------------------------------

/** Draft a plan for the case's outstanding amount and offer it to the member. An earlier unagreed proposal is replaced. */
export async function proposePlan(input: { associationId: number; caseId: number; actorUserId: number | null; periods?: number; now?: Date }) {
  const now = input.now ?? new Date();
  const made = await prisma.$transaction(async (tx) => {
    const c = await tx.ajoDefaultCase.findFirst({ where: { id: input.caseId, associationId: input.associationId }, include: { group: true, membership: { select: { id: true } } } });
    if (!c) throw new RuleError('That case was not found.', 404, 'CASE_NOT_FOUND');
    if (!(OPEN_STATES as string[]).includes(c.status)) throw new RuleError('This case is closed.', 409, 'CASE_CLOSED');
    const today = businessDay(now, c.group.timezone, c.group.cutoffTime);
    const owes = await memberOwes(tx, c.membershipId, today);
    if (owes.totalKobo <= 0n) throw new RuleError('This person owes nothing now, so there is nothing to repay.', 409, 'NOTHING_OWED');
    const lines = draftPlan({ outstandingKobo: owes.totalKobo, frequency: c.group.frequency, intervalCount: c.group.intervalCount, intervalUnit: c.group.intervalUnit, from: today, periods: input.periods ?? owes.owing.length });
    await tx.ajoRepaymentPlan.updateMany({ where: { caseId: c.id, status: 'PROPOSED' }, data: { status: 'CANCELLED', cancelReason: 'Replaced by a new proposal.' } });
    const plan = await tx.ajoRepaymentPlan.create({ data: { associationId: input.associationId, caseId: c.id, status: 'PROPOSED', schedule: lines as unknown as Prisma.InputJsonValue, proposedBy: input.actorUserId, outstandingKobo: owes.totalKobo } });
    await tx.ajoCaseEvent.create({ data: { associationId: input.associationId, caseId: c.id, kind: 'PLAN_PROPOSED', note: `A plan of ${lines.length} payment${lines.length === 1 ? '' : 's'} covering ${formatNaira(owes.totalKobo)} was offered.`, actorUserId: input.actorUserId } });
    if (input.actorUserId) await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_PLAN_PROPOSED', tableName: 'ajo_repayment_plans', recordId: plan.id, newValues: { caseId: c.id, payments: lines.length, outstandingKobo: owes.totalKobo.toString() } });
    return { plan, lines, groupName: c.group.name, membershipId: c.membershipId, total: owes.totalKobo };
  });
  const target = await memberOfMembership(made.membershipId);
  if (target) {
    await messageMember({ associationId: input.associationId, member: target.member, title: 'A repayment plan is offered', message: `${made.groupName}: you owe ${formatNaira(made.total)}. A plan has been drawn up so you can pay it in ${made.lines.length} payment${made.lines.length === 1 ? '' : 's'}, starting ${made.lines[0].dueDate}. Speak to your officer to agree it.`, pushType: 'ajo.plan_offered', entityId: made.plan.id, kind: 'system', sms: true });
  }
  return { planId: made.plan.id, schedule: made.lines };
}

/** The plan counts as agreed only when an officer records the member's agreement (with a note on how) or the member accepts it themselves. */
export async function agreePlan(input: { associationId: number; planId: number; actorUserId: number; actorCanManage: boolean; note?: string; now?: Date }) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const plan = await tx.ajoRepaymentPlan.findFirst({ where: { id: input.planId, associationId: input.associationId }, include: { defaultCase: { include: { group: true, membership: { include: { member: { select: { userId: true } } } } } } } });
    if (!plan) throw new RuleError('That plan was not found.', 404, 'PLAN_NOT_FOUND');
    if (plan.status === 'ACTIVE') return { planId: plan.id, status: plan.status, replayed: true };
    if (plan.status !== 'PROPOSED') throw new RuleError(`A ${plan.status.toLowerCase()} plan cannot be agreed.`, 409, 'INVALID_PLAN_STATE');
    const c = plan.defaultCase;
    if (!(OPEN_STATES as string[]).includes(c.status)) throw new RuleError('This case is closed.', 409, 'CASE_CLOSED');

    const own = c.membership.member.userId !== null && c.membership.member.userId === input.actorUserId;
    if (!own && !input.actorCanManage) throw new RuleError('That plan was not found.', 404, 'PLAN_NOT_FOUND');
    const via = own ? 'app' : 'officer';
    const note = (input.note ?? '').trim();
    if (via === 'officer' && note.length < MIN_NOTE) throw new RuleError('Say how the member agreed (for example "agreed in person on the phone"), so the record shows where it came from.', 400, 'NOTE_REQUIRED');

    const today = businessDay(now, c.group.timezone, c.group.cutoffTime);
    const owes = await memberOwes(tx, c.membershipId, today);
    await tx.ajoRepaymentPlan.updateMany({ where: { caseId: c.id, id: { not: plan.id }, status: { in: ['ACTIVE', 'PROPOSED'] } }, data: { status: 'CANCELLED', cancelReason: 'Replaced by a newly agreed plan.' } });
    const won = await tx.ajoRepaymentPlan.updateMany({ where: { id: plan.id, status: 'PROPOSED' }, data: { status: 'ACTIVE', agreedBy: input.actorUserId, agreedAt: now, agreedVia: via, agreedNote: note || null, covers: owes.overdue.map((r) => r.id) } });
    if (won.count !== 1) throw new RuleError('This plan was just changed by someone else.', 409, 'INVALID_PLAN_STATE');
    await tx.ajoDefaultCase.update({ where: { id: c.id }, data: { status: 'PLAN_AGREED' } });
    await tx.ajoCaseEvent.create({ data: { associationId: input.associationId, caseId: c.id, kind: 'PLAN_AGREED', note: `Agreed ${via === 'app' ? 'by the member in the app' : `on the member's behalf: ${note}`}.`, actorUserId: input.actorUserId } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_PLAN_AGREED', tableName: 'ajo_repayment_plans', recordId: plan.id, newValues: { via, note: note || null } });
    return { planId: plan.id, status: 'ACTIVE' as const, replayed: false };
  });
}

export async function cancelPlan(input: { associationId: number; planId: number; actorUserId: number; reason: string }) {
  const reason = (input.reason ?? '').trim();
  if (reason.length < MIN_REASON) throw new RuleError(`Give a reason of at least ${MIN_REASON} characters.`, 400, 'REASON_REQUIRED');
  return prisma.$transaction(async (tx) => {
    const plan = await tx.ajoRepaymentPlan.findFirst({ where: { id: input.planId, associationId: input.associationId } });
    if (!plan) throw new RuleError('That plan was not found.', 404, 'PLAN_NOT_FOUND');
    if (plan.status === 'CANCELLED') return { planId: plan.id, replayed: true };
    if (plan.status !== 'ACTIVE' && plan.status !== 'PROPOSED') throw new RuleError(`A ${plan.status.toLowerCase()} plan cannot be cancelled.`, 409, 'INVALID_PLAN_STATE');
    await tx.ajoRepaymentPlan.update({ where: { id: plan.id }, data: { status: 'CANCELLED', cancelReason: reason } });
    // With no plan standing, the case goes back to being open: late fees on the covered instalments resume.
    if (plan.status === 'ACTIVE') await tx.ajoDefaultCase.updateMany({ where: { id: plan.caseId, status: 'PLAN_AGREED' }, data: { status: 'OPEN' } });
    await tx.ajoCaseEvent.create({ data: { associationId: input.associationId, caseId: plan.caseId, kind: 'PLAN_CANCELLED', note: reason, actorUserId: input.actorUserId } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_PLAN_CANCELLED', tableName: 'ajo_repayment_plans', recordId: plan.id, newValues: { reason } });
    return { planId: plan.id, replayed: false };
  });
}

/**
 * The instalments a kept plan protects from new late fees: those unpaid when it was agreed, for as long as the member keeps to its dates.
 * A plan that has been broken or cancelled protects nothing.
 */
export async function planShield(db: Db, membershipId: number, today: Date): Promise<Set<number>> {
  const plan = await db.ajoRepaymentPlan.findFirst({ where: { status: 'ACTIVE', defaultCase: { membershipId } }, orderBy: { id: 'desc' } });
  if (!plan || !plan.agreedAt) return new Set();
  const tracking = trackPlan(plan.schedule as unknown as PlanLine[], await paidSince(db, membershipId, plan.agreedAt), today);
  return tracking.onTrack ? new Set(((plan.covers as number[] | null) ?? []).map(Number)) : new Set();
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Notes, closing, reading
// ---------------------------------------------------------------------------------------------------------------------------------

export async function addCaseNote(input: { associationId: number; caseId: number; actorUserId: number; note: string; fromMember?: boolean }) {
  const note = (input.note ?? '').trim();
  if (note.length < MIN_NOTE) throw new RuleError('Write a note of at least 5 characters.', 400, 'NOTE_REQUIRED');
  return prisma.$transaction(async (tx) => {
    const c = await tx.ajoDefaultCase.findFirst({ where: { id: input.caseId, associationId: input.associationId }, select: { id: true, status: true } });
    if (!c) throw new RuleError('That case was not found.', 404, 'CASE_NOT_FOUND');
    if (!(OPEN_STATES as string[]).includes(c.status)) throw new RuleError('This case is closed, and its file is not added to.', 409, 'CASE_CLOSED');
    const event = await tx.ajoCaseEvent.create({ data: { associationId: input.associationId, caseId: c.id, kind: input.fromMember ? 'MEMBER_RESPONSE' : 'NOTE', note, actorUserId: input.actorUserId } });
    if (input.fromMember) await tx.ajoDefaultCase.update({ where: { id: c.id }, data: { memberResponse: note } });
    return { eventId: event.id };
  });
}

/** The group decides how it ends, outside the app. An admin records the outcome with a written reason. */
export async function closeCase(input: { associationId: number; caseId: number; actorUserId: number; outcome: 'RESOLVED' | 'CLOSED_UNRESOLVED'; reason: string; now?: Date }) {
  const reason = (input.reason ?? '').trim();
  if (reason.length < MIN_REASON) throw new RuleError(`Give a reason of at least ${MIN_REASON} characters. It stays on the record.`, 400, 'REASON_REQUIRED');
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const c = await tx.ajoDefaultCase.findFirst({ where: { id: input.caseId, associationId: input.associationId } });
    if (!c) throw new RuleError('That case was not found.', 404, 'CASE_NOT_FOUND');
    if (c.status === input.outcome) return { caseId: c.id, status: c.status, replayed: true };
    if (!(OPEN_STATES as string[]).includes(c.status)) throw new RuleError('This case is already closed, and a closed case is not changed.', 409, 'CASE_CLOSED');
    await tx.ajoRepaymentPlan.updateMany({ where: { caseId: c.id, status: { in: ['ACTIVE', 'PROPOSED'] } }, data: { status: 'CANCELLED', cancelReason: 'The case was closed.' } });
    await tx.ajoDefaultCase.update({ where: { id: c.id }, data: { status: input.outcome, resolution: reason, closedAt: now, closedBy: input.actorUserId } });
    await tx.ajoCaseEvent.create({ data: { associationId: input.associationId, caseId: c.id, kind: 'CLOSED', note: `${input.outcome === 'RESOLVED' ? 'Resolved' : 'Closed unresolved'}: ${reason}`, actorUserId: input.actorUserId } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_DEFAULT_CASE_CLOSED', tableName: 'ajo_default_cases', recordId: c.id, oldValues: { status: c.status }, newValues: { status: input.outcome, reason } });
    return { caseId: c.id, status: input.outcome, replayed: false };
  });
}

/** The job's check on every agreed plan: a missed date is recorded once and the admins are told; a plan fully paid ends the case. */
export async function trackPlans(now: Date, groupIds?: number[]): Promise<{ missed: number; completed: number }> {
  const plans = await prisma.ajoRepaymentPlan.findMany({ where: { status: 'ACTIVE', ...(groupIds ? { defaultCase: { groupId: { in: groupIds } } } : {}) }, include: { defaultCase: { include: { group: true, membership: { include: { member: { select: { firstName: true, lastName: true } } } } } } } });
  let missed = 0;
  let completed = 0;
  for (const plan of plans) {
    const c = plan.defaultCase;
    const today = businessDay(now, c.group.timezone, c.group.cutoffTime);
    const owes = await memberOwes(prisma, c.membershipId, today);
    if (owes.totalKobo <= 0n) {
      completed++;
      await prisma.$transaction(async (tx) => {
        await tx.ajoRepaymentPlan.updateMany({ where: { id: plan.id, status: 'ACTIVE' }, data: { status: 'COMPLETED' } });
        await tx.ajoDefaultCase.updateMany({ where: { id: c.id, status: { in: OPEN_STATES } }, data: { status: 'RESOLVED', resolution: 'Paid in full.', closedAt: now } });
        await tx.ajoCaseEvent.createMany({ data: [{ associationId: c.associationId, caseId: c.id, kind: 'PLAN_COMPLETED', note: 'The plan was paid in full.', dedupeKey: `plan:${plan.id}:completed` }, { associationId: c.associationId, caseId: c.id, kind: 'CLOSED', note: 'Resolved automatically: paid in full.', dedupeKey: `case:${c.id}:closed-auto` }], skipDuplicates: true });
      });
      continue;
    }
    const tracking = trackPlan(plan.schedule as unknown as PlanLine[], plan.agreedAt ? await paidSince(prisma, c.membershipId, plan.agreedAt) : 0n, today);
    for (const date of tracking.missed) {
      const made = await prisma.ajoCaseEvent.createMany({ data: [{ associationId: c.associationId, caseId: c.id, kind: 'PLAN_MISSED', note: `The payment due on ${date} was not made. ${formatNaira(tracking.behindKobo)} is behind.`, dedupeKey: `plan:${plan.id}:missed:${date}` }], skipDuplicates: true });
      if (made.count === 1) {
        missed++;
        await notifyPermissionHolders(c.associationId, 'ajo.manage', { pushType: 'ajo.plan_missed', entityId: c.id, title: 'A repayment plan date was missed', message: `${c.membership.member.firstName} ${c.membership.member.lastName} missed the payment due on ${date} in ${c.group.name}.` });
      }
    }
  }
  return { missed, completed };
}

/** Find people who were paid out and then stopped paying, and open their cases. Safe to run any number of times. */
export async function detectDefaults(now: Date, groups: Array<{ id: number; associationId: number; timezone: string; cutoffTime: string }>): Promise<number> {
  let opened = 0;
  for (const g of groups) {
    const today = businessDay(now, g.timezone, g.cutoffTime);
    const paid = await prisma.ajoPayout.findMany({ where: { groupId: g.id, status: 'PAID' }, select: { membershipId: true }, distinct: ['membershipId'] });
    for (const { membershipId } of paid) {
      const m = await prisma.ajoMembership.findUnique({ where: { id: membershipId }, select: { status: true } });
      if (m?.status !== 'ACTIVE') continue;
      if (await prisma.ajoDefaultCase.findFirst({ where: { membershipId, status: { in: OPEN_STATES } }, select: { id: true } })) continue;
      const check = await verificationState(prisma, membershipId);
      if (check.pending) continue;
      const inForce = await ruleVersionInForce(prisma, membershipId);
      const graceDays = inForce?.rules.graceDays ?? 3;
      const owes = await memberOwes(prisma, membershipId, today);
      const lastEnd = check.lastCheckEndedAt ? businessDay(check.lastCheckEndedAt, g.timezone, g.cutoffTime) : null;
      const shield = await planShield(prisma, membershipId, today);
      const late = owes.overdue.some((r) => !shield.has(r.id) && today.getTime() >= feeEligibleOn({ dueDate: r.dueDate, graceDays, lastCheckEndedOn: lastEnd }).getTime());
      if (!late) continue;
      try {
        const r = await openCase({ associationId: g.associationId, membershipId, actorUserId: null, now });
        if (r.created) opened++;
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
      }
    }
  }
  return opened;
}

type CaseRow = Prisma.AjoDefaultCaseGetPayload<{ include: { plans: true; events: true; membership: { select: { id: true; member: { select: { firstName: true; lastName: true } } } } } }>;

export async function toCaseView(c: CaseRow, today: Date, withEvents: boolean) {
  const owes = await memberOwes(prisma, c.membershipId, today);
  return {
    id: c.id,
    groupId: c.groupId,
    membershipId: c.membershipId,
    member: `${c.membership.member.firstName} ${c.membership.member.lastName}`.trim(),
    status: c.status,
    procedure: c.procedure,
    openedAt: c.openedAt,
    closedAt: c.closedAt,
    resolution: c.resolution,
    memberResponse: c.memberResponse,
    /** What was outstanding when the case opened (frozen), and what is outstanding now. */
    outstandingAtOpeningKobo: kobo(c.outstandingKobo),
    outstandingNowKobo: kobo(owes.totalKobo),
    outstandingNow: formatNaira(owes.totalKobo),
    snapshot: c.snapshot,
    plans: c.plans.map((p) => ({ id: p.id, status: p.status, schedule: p.schedule, agreedAt: p.agreedAt, agreedVia: p.agreedVia, outstandingKobo: kobo(p.outstandingKobo), cancelReason: p.cancelReason })),
    ...(withEvents ? { events: c.events.map((e) => ({ id: e.id, kind: e.kind, note: e.note, createdAt: e.createdAt })) } : {}),
  };
}

const caseInclude = { plans: { orderBy: { id: 'asc' as const } }, events: { orderBy: { id: 'asc' as const } }, membership: { select: { id: true, member: { select: { firstName: true, lastName: true } } } } };

export async function listCases(input: { associationId: number; groupId?: number; membershipId?: number; status?: string; now?: Date }) {
  const rows = await prisma.ajoDefaultCase.findMany({ where: { associationId: input.associationId, ...(input.groupId ? { groupId: input.groupId } : {}), ...(input.membershipId ? { membershipId: input.membershipId } : {}), ...(input.status ? { status: input.status as never } : {}) }, orderBy: { id: 'desc' }, include: caseInclude, take: 100 });
  const now = input.now ?? new Date();
  const out = [];
  for (const c of rows) {
    const g = await prisma.ajoGroup.findUniqueOrThrow({ where: { id: c.groupId }, select: { timezone: true, cutoffTime: true } });
    out.push(await toCaseView(c, businessDay(now, g.timezone, g.cutoffTime), false));
  }
  return out;
}

export async function getCase(input: { associationId: number; caseId: number; now?: Date }) {
  const c = await prisma.ajoDefaultCase.findFirst({ where: { id: input.caseId, associationId: input.associationId }, include: caseInclude });
  if (!c) throw new RuleError('That case was not found.', 404, 'CASE_NOT_FOUND');
  const g = await prisma.ajoGroup.findUniqueOrThrow({ where: { id: c.groupId }, select: { timezone: true, cutoffTime: true } });
  const view = await toCaseView(c, businessDay(input.now ?? new Date(), g.timezone, g.cutoffTime), true);
  // A guarantor is a recorded consent only; the officer sees the contact with that said plainly.
  const guarantor = await prisma.ajoMembership.findUnique({ where: { id: c.membershipId }, select: { guarantorAgreement: { select: { name: true, phone: true, relationship: true, acceptedAt: true } } } });
  return { ...view, guarantor: guarantor?.guarantorAgreement ? { ...guarantor.guarantorAgreement, note: 'This is a record that the guarantor agreed to be named. It is not a legal guarantee, and nothing is ever taken from them by SocietyLedger.' } : null };
}
