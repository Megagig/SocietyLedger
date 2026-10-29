/**
 * Collector-thrift cycles (spec §16.5), the part that touches the database. The rules themselves are in ajo-cycle.ts.
 *
 *  - A saver chooses one amount (at least the group's smallest) and it stays the same for the whole cycle.
 *  - A few days before the cycle ends they choose to withdraw or continue. No answer means withdraw.
 *  - When the cycle is over and every withdrawing saver has been paid, the admin starts the next cycle. A continuing saver's savings, less
 *    that cycle's collector fee (one of their contributions), go into the next cycle; a withdrawing saver leaves the group.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { formatNaira } from './ajo-collections';
import { carryForward, checkSaverAmount, cycleStartOf, effectiveChoice, isPromptOpen, nextCycleStart, promptOpensOn, type CycleChoice } from './ajo-cycle';
import { ensureCycle } from './ajo-cycle-data';
import { recordEntry, type LedgerDb } from './ajo-ledger.service';
import { payableForSaver } from './ajo-payout.service';
import { businessDay, groupDates, toCalendarDate, type Frequency } from './ajo-schedule';
import { syncMembershipSchedule } from './ajo-schedule.service';
import { auditAjo, notifyUser } from './ajo-support';

type Db = Prisma.TransactionClient | typeof prisma;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const k = (kobo: bigint) => kobo.toString();
const bad = (message: string, code: string, status: 400 | 404 | 409 = 400) => new RuleError(message, status, code);
const LOCK = (groupId: number) => `ajo-payout:${groupId}`;

async function loadSaver(db: Db, associationId: number, membershipId: number) {
  const membership = await db.ajoMembership.findFirst({ where: { id: membershipId, associationId }, include: { group: true, member: { select: { firstName: true, lastName: true, userId: true } } } });
  if (!membership) throw bad('That membership was not found.', 'MEMBERSHIP_NOT_FOUND', 404);
  if (membership.group.model !== 'COLLECTOR_THRIFT') throw bad('Only a collector-thrift saver has a savings cycle. A rotating pot has fixed amounts and rounds.', 'NOT_COLLECTOR_THRIFT');
  return membership;
}

/** Has the cycle begun for this saver? Once an installment is due, or any money is recorded, the amount is fixed for the rest of the cycle. */
async function amountIsLocked(db: Db, membershipId: number, cycleNo: number, today: Date): Promise<boolean> {
  const touched = await db.ajoInstallment.count({ where: { membershipId, cycleNo, OR: [{ dueDate: { lte: today } }, { paidKobo: { gt: 0n } }, { contributions: { some: {} } }] } });
  return touched > 0;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The amount
// ---------------------------------------------------------------------------------------------------------------------------------

/** Set what a collector-thrift saver pays each time. Allowed until the cycle has begun for them; after that it stays the same. */
export async function setSaverAmount(input: { associationId: number; membershipId: number; amountKobo: bigint; actorUserId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const result = await prisma.$transaction(async (tx) => {
    const m = await loadSaver(tx, input.associationId, input.membershipId);
    const group = m.group;
    if (group.status === 'COMPLETED' || group.status === 'CANCELLED') throw bad('This group is closed, so amounts cannot change.', 'GROUP_CLOSED', 409);
    const problem = checkSaverAmount(input.amountKobo, group.contributionKobo, formatNaira);
    if (problem) throw bad(problem, 'INVALID_AMOUNT');

    const cycle = await ensureCycle(tx, { id: m.id, associationId: m.associationId, groupId: group.id }, group.cycleNo, group.contributionKobo);
    if (cycle.amountKobo === input.amountKobo) return { amountKobo: cycle.amountKobo, changed: false };
    const today = businessDay(now, group.timezone, group.cutoffTime);
    if (await amountIsLocked(tx, m.id, group.cycleNo, today)) {
      throw bad('The amount stays the same for the whole cycle, so it can only be changed before the cycle begins for you. You can choose a new amount when this cycle ends, if you continue.', 'AMOUNT_LOCKED', 409);
    }
    await tx.ajoMembershipCycle.update({ where: { id: cycle.id }, data: { amountKobo: input.amountKobo } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_SAVER_AMOUNT_SET', tableName: 'ajo_membership_cycles', recordId: cycle.id, oldValues: { amountKobo: k(cycle.amountKobo) }, newValues: { cycleNo: group.cycleNo, amountKobo: k(input.amountKobo) } });
    // Anything already planned for the cycle (not yet due, nothing paid) is re-priced to the new amount.
    if (group.status === 'ACTIVE' && m.status === 'ACTIVE') await syncMembershipSchedule(tx, { groupId: group.id, membershipId: m.id, now });
    return { amountKobo: input.amountKobo, changed: true };
  });
  return { membershipId: input.membershipId, amountKobo: k(result.amountKobo), changed: result.changed };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Withdraw or continue
// ---------------------------------------------------------------------------------------------------------------------------------

/** What the saver sees: their cycle, whether they may still decide, and what happens if they do not. */
export async function getCycleView(input: { associationId: number; membershipId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const m = await loadSaver(prisma, input.associationId, input.membershipId);
  const group = m.group;
  const cycle = await prisma.ajoMembershipCycle.findUnique({ where: { membershipId_cycleNo: { membershipId: m.id, cycleNo: group.cycleNo } } });
  const amount = cycle?.amountKobo ?? group.contributionKobo;
  const today = businessDay(now, group.timezone, group.cutoffTime);
  const choice = (cycle?.choice ?? 'PENDING') as CycleChoice;
  const standing = await prisma.ajoPayout.count({ where: { membershipId: m.id, cycleNo: group.cycleNo, round: null, status: { in: ['PREPARED', 'APPROVED', 'PAID'] } } });
  const locked = group.status === 'ACTIVE' ? await amountIsLocked(prisma, m.id, group.cycleNo, today) : false;
  const endsOn = group.endsOn;
  const open = endsOn !== null && group.status === 'ACTIVE' && m.status === 'ACTIVE' && isPromptOpen(endsOn, today);
  return {
    membershipId: m.id,
    groupId: group.id,
    cycleNo: group.cycleNo,
    amountKobo: k(amount),
    minAmountKobo: k(group.contributionKobo),
    carriedKobo: k(cycle?.carriedKobo ?? 0n),
    startsOn: iso(cycleStartOf(group)),
    endsOn: endsOn ? iso(endsOn) : null,
    promptOpensOn: endsOn ? iso(promptOpensOn(endsOn)) : null,
    canChangeAmount: !locked && group.status !== 'COMPLETED' && group.status !== 'CANCELLED',
    canDecide: open && standing === 0,
    choice,
    effectiveChoice: effectiveChoice(choice),
    nextAmountKobo: cycle?.nextAmountKobo ? k(cycle.nextAmountKobo) : null,
    decidedVia: cycle?.choiceVia ?? null,
    decidedAt: cycle?.choiceAt ?? null,
    payoutStarted: standing > 0,
    ifNoAnswer: 'If you do not answer, your savings are paid out to you.',
  };
}

/** Record the saver's answer. They can change it until their payout is prepared or the next cycle starts. */
export async function decideCycleEnd(input: { associationId: number; membershipId: number; choice: 'WITHDRAW' | 'CONTINUE'; nextAmountKobo?: bigint; actorUserId: number; viaOfficer: boolean; now?: Date }) {
  const now = input.now ?? new Date();
  await prisma.$transaction(async (tx) => {
    const found = await loadSaver(tx, input.associationId, input.membershipId);
    // The same lock the payouts take, so an answer and a payout being prepared cannot cross.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK(found.groupId)}))`;
    const m = await loadSaver(tx, input.associationId, input.membershipId);
    const group = m.group;
    if (group.status !== 'ACTIVE' || m.status !== 'ACTIVE') throw bad('Only a current saver in a running group can answer this.', 'NOT_ACTIVE', 409);
    if (!group.endsOn) throw bad('This group has no end date yet.', 'NO_CYCLE', 409);
    const today = businessDay(now, group.timezone, group.cutoffTime);
    if (!isPromptOpen(group.endsOn, today)) throw bad(`You can choose from ${iso(promptOpensOn(group.endsOn))}, three days before this cycle ends.`, 'TOO_EARLY', 409);
    const standing = await tx.ajoPayout.count({ where: { membershipId: m.id, cycleNo: group.cycleNo, round: null, status: { in: ['PREPARED', 'APPROVED', 'PAID'] } } });
    if (standing > 0) throw bad('Your payout has already been started, so it cannot be changed now.', 'PAYOUT_ALREADY_STARTED', 409);

    const cycle = await ensureCycle(tx, { id: m.id, associationId: m.associationId, groupId: group.id }, group.cycleNo, group.contributionKobo);
    let next: bigint | null = null;
    if (input.choice === 'CONTINUE') {
      next = input.nextAmountKobo ?? cycle.amountKobo;
      const problem = checkSaverAmount(next, group.contributionKobo, formatNaira);
      if (problem) throw bad(problem, 'INVALID_AMOUNT');
    }
    await tx.ajoMembershipCycle.update({ where: { id: cycle.id }, data: { choice: input.choice, choiceAt: now, choiceBy: input.actorUserId, choiceVia: input.viaOfficer ? 'officer' : 'member', nextAmountKobo: next } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_CYCLE_CHOICE', tableName: 'ajo_membership_cycles', recordId: cycle.id, oldValues: { choice: cycle.choice }, newValues: { cycleNo: group.cycleNo, choice: input.choice, nextAmountKobo: next === null ? null : k(next), via: input.viaOfficer ? 'officer' : 'member' } });
  });
  return getCycleView({ associationId: input.associationId, membershipId: input.membershipId, now });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The officer's view, and starting the next cycle
// ---------------------------------------------------------------------------------------------------------------------------------

/** Where the running cycle stands: who continues, who withdraws, and who has said nothing (so withdraws). */
export async function getGroupCycle(input: { associationId: number; groupId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const group = await prisma.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId } });
  if (!group) throw bad('That group was not found.', 'GROUP_NOT_FOUND', 404);
  if (group.model !== 'COLLECTOR_THRIFT') throw bad('Only a collector-thrift scheme has savings cycles.', 'NOT_COLLECTOR_THRIFT');
  const today = businessDay(now, group.timezone, group.cutoffTime);
  const memberships = await prisma.ajoMembership.findMany({ where: { groupId: group.id, status: { in: ['ACTIVE', 'LEFT'] } }, orderBy: { id: 'asc' }, select: { id: true, status: true, member: { select: { firstName: true, lastName: true } } } });
  const rows = await prisma.ajoMembershipCycle.findMany({ where: { groupId: group.id, cycleNo: group.cycleNo } });
  const byMembership = new Map(rows.map((r) => [r.membershipId, r]));
  const paid = await prisma.ajoInstallment.groupBy({ by: ['membershipId'], where: { membership: { groupId: group.id }, cycleNo: group.cycleNo }, _sum: { paidKobo: true } });
  const savedOwn = new Map(paid.map((p) => [p.membershipId, p._sum.paidKobo ?? 0n]));

  const people = memberships
    .filter((m) => m.status === 'ACTIVE')
    .map((m) => {
      const c = byMembership.get(m.id);
      const choice = (c?.choice ?? 'PENDING') as CycleChoice;
      return {
        membershipId: m.id,
        name: `${m.member.firstName} ${m.member.lastName}`.trim(),
        amountKobo: k(c?.amountKobo ?? group.contributionKobo),
        savedKobo: k((savedOwn.get(m.id) ?? 0n) + (c?.carriedKobo ?? 0n)),
        choice,
        effectiveChoice: effectiveChoice(choice),
        nextAmountKobo: c?.nextAmountKobo ? k(c.nextAmountKobo) : null,
        decidedVia: c?.choiceVia ?? null,
      };
    });
  const continuing = people.filter((p) => p.effectiveChoice === 'CONTINUE').length;
  const cycleOver = group.endsOn !== null && today.getTime() > toCalendarDate(group.endsOn).getTime();
  return {
    groupId: group.id,
    cycleNo: group.cycleNo,
    startsOn: iso(cycleStartOf(group)),
    endsOn: group.endsOn ? iso(group.endsOn) : null,
    promptOpensOn: group.endsOn ? iso(promptOpensOn(group.endsOn)) : null,
    promptOpen: group.endsOn !== null && isPromptOpen(group.endsOn, today),
    cycleOver,
    counts: { continuing, withdrawing: people.length - continuing, noAnswer: people.filter((p) => p.choice === 'PENDING').length },
    people,
    canStartNext: group.status === 'ACTIVE' && cycleOver && continuing > 0,
  };
}

/**
 * Start the next cycle. Needs the cycle to be over and every withdrawing saver to have been paid, so nobody leaves the group with money
 * still owed to them. Continuing savers pay this cycle's fee out of their savings (written to the ledger) and carry the rest forward.
 */
export async function startNextCycle(input: { associationId: number; groupId: number; actorUserId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const summary = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK(input.groupId)}))`;
      const group = await tx.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId } });
      if (!group) throw bad('That group was not found.', 'GROUP_NOT_FOUND', 404);
      if (group.model !== 'COLLECTOR_THRIFT') throw bad('Only a collector-thrift scheme has savings cycles.', 'NOT_COLLECTOR_THRIFT');
      if (group.status !== 'ACTIVE') throw bad('Only a running group can start another cycle.', 'INVALID_GROUP_STATE', 409);
      const today = businessDay(now, group.timezone, group.cutoffTime);
      if (!group.endsOn || today.getTime() <= toCalendarDate(group.endsOn).getTime()) throw bad('The cycle is not over yet.', 'CYCLE_NOT_FINISHED', 409);

      const active = await tx.ajoMembership.findMany({ where: { groupId: group.id, status: 'ACTIVE' }, select: { id: true, associationId: true, member: { select: { firstName: true, lastName: true, userId: true } } } });
      const cycles = new Map<number, Awaited<ReturnType<typeof ensureCycle>>>();
      for (const m of active) cycles.set(m.id, await ensureCycle(tx, { id: m.id, associationId: m.associationId, groupId: group.id }, group.cycleNo, group.contributionKobo));
      const continuing = active.filter((m) => effectiveChoice(cycles.get(m.id)?.choice as CycleChoice) === 'CONTINUE');
      const leaving = active.filter((m) => !continuing.includes(m));
      if (continuing.length === 0) throw bad('Nobody is continuing, so there is no next cycle. Pay everyone out and complete the group instead.', 'NOBODY_CONTINUING', 409);

      // Nobody leaves with money still owed to them, and nobody's payout is half done.
      const unpaid: string[] = [];
      for (const m of leaving) {
        const p = await payableForSaver(tx, { associationId: input.associationId, groupId: group.id, membershipId: m.id, now });
        if (p.canPay || p.standing) unpaid.push(`${p.name}: ${p.standing ? 'payout waiting to be approved or paid' : formatNaira(p.netKobo)}`);
      }
      if (unpaid.length > 0) throw bad(`These savers are withdrawing and still have money to be paid: ${unpaid.join('; ')}. Pay them first, then start the next cycle.`, 'WITHDRAWALS_NOT_PAID', 409);

      // Continuing savers: settle this cycle's fee out of their savings, and carry the rest.
      const confirmedBy = new Map((await tx.ajoInstallment.groupBy({ by: ['membershipId'], where: { membership: { groupId: group.id }, cycleNo: group.cycleNo }, _sum: { paidKobo: true } })).map((g) => [g.membershipId, g._sum.paidKobo ?? 0n]));
      const nextNo = group.cycleNo + 1;
      const start = nextCycleStart({ cycleStart: cycleStartOf(group), frequency: group.frequency as Frequency, cycleLength: group.cycleLength as number, intervalCount: group.intervalCount, intervalUnit: group.intervalUnit, today });
      const { endsOn } = groupDates({ model: 'COLLECTOR_THRIFT', frequency: group.frequency as Frequency, intervalCount: group.intervalCount, intervalUnit: group.intervalUnit, startDate: start, cycleLength: group.cycleLength, rounds: null });

      await tx.ajoGroup.update({ where: { id: group.id }, data: { cycleNo: nextNo, cycleStartsOn: start, endsOn } });

      const told: Array<{ userId: number; amountKobo: bigint; carriedKobo: bigint; feeKobo: bigint }> = [];
      for (const m of continuing) {
        const cur = cycles.get(m.id) as NonNullable<ReturnType<typeof cycles.get>>;
        const carry = carryForward({ carriedInKobo: cur.carriedKobo, confirmedKobo: confirmedBy.get(m.id) ?? 0n, feeType: group.collectorFeeType, feeValue: group.collectorFeeValue, amountKobo: cur.amountKobo });
        if (carry.feeKobo > 0n) {
          await recordEntry(tx as unknown as LedgerDb, { associationId: input.associationId, groupId: group.id, membershipId: m.id, type: 'FEE', direction: 'DEBIT', amountKobo: carry.feeKobo, refType: 'cycle_fee', refId: cur.id, idempotencyKey: `ajo:cyclefee:${cur.id}`, createdBy: input.actorUserId });
        }
        await tx.ajoMembershipCycle.update({ where: { id: cur.id }, data: { feeSettledKobo: carry.feeKobo } });
        const nextAmount = cur.nextAmountKobo ?? cur.amountKobo;
        await tx.ajoMembershipCycle.create({ data: { associationId: input.associationId, groupId: group.id, membershipId: m.id, cycleNo: nextNo, amountKobo: nextAmount, carriedKobo: carry.carriedKobo } });
        await syncMembershipSchedule(tx, { groupId: group.id, membershipId: m.id, now });
        if (m.member.userId) told.push({ userId: m.member.userId, amountKobo: nextAmount, carriedKobo: carry.carriedKobo, feeKobo: carry.feeKobo });
      }
      // Savers who withdrew have been paid; they leave the group.
      for (const m of leaving) await tx.ajoMembership.update({ where: { id: m.id }, data: { status: 'LEFT', leftAt: now } });

      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_CYCLE_STARTED', tableName: 'ajo_groups', recordId: group.id, oldValues: { cycleNo: group.cycleNo }, newValues: { cycleNo: nextNo, startsOn: iso(start), endsOn: iso(endsOn), continuing: continuing.length, withdrawn: leaving.length } });
      return { group, nextNo, start, endsOn, continuing: continuing.length, withdrawn: leaving.length, told };
    },
    { timeout: 60_000 },
  );

  for (const t of summary.told) {
    await notifyUser(input.associationId, t.userId, { pushType: 'ajo.cycle_started', entityId: input.groupId, title: 'A new savings cycle has started', message: `${summary.group.name} cycle ${summary.nextNo} runs to ${iso(summary.endsOn)}. You pay ${formatNaira(t.amountKobo)} each time and bring ${formatNaira(t.carriedKobo)} forward${t.feeKobo > 0n ? ` (after the collector fee of ${formatNaira(t.feeKobo)} for the last cycle)` : ''}.` });
  }
  return { groupId: input.groupId, cycleNo: summary.nextNo, startsOn: iso(summary.start), endsOn: iso(summary.endsOn), continuing: summary.continuing, withdrawn: summary.withdrawn };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Asking
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Once a day: tell each saver, once, that their cycle is about to end and what happens if they do not answer. Safe to run repeatedly:
 * the question is marked asked before it is sent, so a rerun, or two servers, never ask twice.
 */
export async function runCycleEndPrompts(now: Date = new Date()): Promise<{ asked: number }> {
  // Only groups whose cycle ends soon or ended recently: a group whose cycle is long over is waiting on an admin, not on a question.
  const recent = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const groups = await prisma.ajoGroup.findMany({ where: { model: 'COLLECTOR_THRIFT', status: 'ACTIVE', endsOn: { gte: recent } } });
  let asked = 0;
  for (const group of groups) {
    const today = businessDay(now, group.timezone, group.cutoffTime);
    if (!group.endsOn || !isPromptOpen(group.endsOn, today)) continue;
    // Savers who have not been asked and have not already answered. Nobody else is touched, so a daily run over many groups stays cheap.
    const people = await prisma.ajoMembership.findMany({
      where: { groupId: group.id, status: 'ACTIVE', NOT: { cycles: { some: { cycleNo: group.cycleNo, OR: [{ promptedAt: { not: null } }, { choice: { not: 'PENDING' } }] } } } },
      select: { id: true, associationId: true, member: { select: { userId: true } } },
    });
    for (const m of people) {
      const cycle = await ensureCycle(prisma, { id: m.id, associationId: m.associationId, groupId: group.id }, group.cycleNo, group.contributionKobo);
      if (cycle.promptedAt || cycle.choice !== 'PENDING' || !m.member.userId) continue;
      const claimed = await prisma.ajoMembershipCycle.updateMany({ where: { id: cycle.id, promptedAt: null }, data: { promptedAt: now } });
      if (claimed.count !== 1) continue;
      asked += 1;
      await notifyUser(group.associationId, m.member.userId, { pushType: 'ajo.cycle_ending', entityId: group.id, title: 'Your savings cycle is ending', message: `Your ${group.name} cycle ends on ${iso(group.endsOn)}. Choose whether to withdraw your savings or continue. If you do not answer, your savings are paid out to you.` });
    }
  }
  return { asked };
}
