/**
 * Collector performance report: per collector and circle, the cash they recorded, how much of it an officer has confirmed, what is still
 * waiting, and what they handed in against what they collected. A collector who is not an officer sees only their own row.
 *
 * Cash is counted on its business day (after the circle's cutoff time it counts for the next day), the same day the collector's Today
 * screen uses. A handover is counted on the day it is for.
 */
import prisma from '../../../lib/prisma';
import { assertUnderCap, iso, userNames, type ReportContext } from './report-context';
import { count, money, type CircleBlock, type Column, type ReportBody, type Row } from './report-types';

export const COLLECTORS_COLUMNS: Column[] = [
  { key: 'circle', label: 'Circle', kind: 'text' },
  { key: 'collector', label: 'Collector', kind: 'text' },
  { key: 'savers', label: 'People assigned', kind: 'int' },
  { key: 'recordedKobo', label: 'Cash recorded', kind: 'money' },
  { key: 'confirmedKobo', label: 'Confirmed', kind: 'money' },
  { key: 'awaitingKobo', label: 'Awaiting confirmation', kind: 'money' },
  { key: 'targetKobo', label: 'Daily targets', kind: 'money' },
  { key: 'handedOverKobo', label: 'Handed in', kind: 'money' },
  { key: 'countedKobo', label: 'Counted by officer', kind: 'money' },
  { key: 'differenceKobo', label: 'Handed in less collected', kind: 'money' },
  { key: 'daysHandedOver', label: 'Days handed in', kind: 'int' },
  { key: 'unreconciledDays', label: 'Days not yet counted', kind: 'int' },
  { key: 'missingPayments', label: 'Missing from a handover', kind: 'int' },
];

interface Tally {
  savers: Set<number>;
  recorded: bigint;
  confirmed: bigint;
  awaiting: bigint;
  target: bigint;
  handedOver: bigint;
  counted: bigint;
  difference: bigint;
  days: number;
  unreconciled: number;
  missing: number;
}
const tally = (): Tally => ({ savers: new Set(), recorded: 0n, confirmed: 0n, awaiting: 0n, target: 0n, handedOver: 0n, counted: 0n, difference: 0n, days: 0, unreconciled: 0, missing: 0 });

export async function collectorsReport(ctx: ReportContext): Promise<ReportBody> {
  const blocks: CircleBlock[] = [];
  const rows: Row[] = [];
  const only = ctx.filters.collectorUserId;

  for (const group of ctx.groups) {
    const peopleIds = [...ctx.people.values()].filter((p) => p.groupId === group.id).map((p) => p.membershipId);
    const perCollector = new Map<number, Tally>();
    const of = (collectorUserId: number) => perCollector.get(collectorUserId) ?? perCollector.set(collectorUserId, tally()).get(collectorUserId)!;

    const assignments = await prisma.ajoCollectorAssignment.findMany({
      where: { associationId: ctx.associationId, membership: { groupId: group.id }, startsOn: { lte: ctx.toDate }, OR: [{ endsOn: null }, { endsOn: { gte: ctx.fromDate } }], ...(only ? { collectorUserId: only } : {}) },
      select: { collectorUserId: true, membershipId: true },
    });
    for (const a of assignments) if (!ctx.membershipIds || peopleIds.includes(a.membershipId)) of(a.collectorUserId).savers.add(a.membershipId);

    // Cash a collector recorded: counted unless it was turned down or later reversed.
    const cashWhere = { groupId: group.id, method: 'CASH' as const, collectorId: only ? only : { not: null }, status: { in: ['CASH_RECEIVED', 'CONFIRMED'] as Array<'CASH_RECEIVED' | 'CONFIRMED'> }, reversalOfId: null, businessDate: { gte: ctx.fromDate, lte: ctx.toDate }, ...(ctx.membershipIds ? { membershipId: { in: peopleIds } } : {}) };
    assertUnderCap(await prisma.ajoContribution.count({ where: cashWhere }));
    const cash = await prisma.ajoContribution.groupBy({ by: ['collectorId', 'status', 'missingFromHandover'], where: cashWhere, _sum: { amountKobo: true }, _count: { _all: true } });
    for (const c of cash) {
      if (c.collectorId === null) continue;
      const t = of(c.collectorId);
      const sum = c._sum.amountKobo ?? 0n;
      t.recorded += sum;
      if (c.status === 'CONFIRMED') t.confirmed += sum;
      else t.awaiting += sum;
      if (c.missingFromHandover) t.missing += c._count._all;
    }

    // Handovers are per collector per day for the whole circle; a collector scoped to their own people still sees their own days.
    const handovers = await prisma.ajoCashHandover.findMany({ where: { groupId: group.id, forDate: { gte: ctx.fromDate, lte: ctx.toDate }, ...(only ? { collectorUserId: only } : {}) }, orderBy: { forDate: 'asc' } });
    assertUnderCap(handovers.length);
    for (const h of handovers) {
      const t = of(h.collectorUserId);
      t.target += h.targetKobo ?? h.expectedKobo;
      t.handedOver += h.handedOverKobo;
      t.counted += h.countedKobo ?? 0n;
      t.difference += h.differenceKobo;
      t.days += 1;
      if (!h.reconciledAt) t.unreconciled += 1;
    }

    const who = await userNames(ctx.associationId, [...perCollector.keys()]);
    const sorted = [...perCollector.entries()].sort((a, b) => (who(a[0]) ?? '').localeCompare(who(b[0]) ?? '') || a[0] - b[0]);
    const sum = { savers: 0, recorded: 0n, confirmed: 0n, awaiting: 0n, handedOver: 0n, counted: 0n, difference: 0n, unreconciled: 0 };
    for (const [id, t] of sorted) {
      rows.push({
        circle: group.name,
        collector: who(id),
        savers: t.savers.size,
        recordedKobo: t.recorded.toString(),
        confirmedKobo: t.confirmed.toString(),
        awaitingKobo: t.awaiting.toString(),
        targetKobo: t.target.toString(),
        handedOverKobo: t.handedOver.toString(),
        countedKobo: t.counted.toString(),
        differenceKobo: t.difference.toString(),
        daysHandedOver: t.days,
        unreconciledDays: t.unreconciled,
        missingPayments: t.missing,
      });
      sum.savers += t.savers.size;
      sum.recorded += t.recorded;
      sum.confirmed += t.confirmed;
      sum.awaiting += t.awaiting;
      sum.handedOver += t.handedOver;
      sum.counted += t.counted;
      sum.difference += t.difference;
      sum.unreconciled += t.unreconciled;
    }
    blocks.push({
      groupId: group.id,
      groupName: group.name,
      model: group.model,
      timezone: group.timezone,
      metrics: [
        count('collectors', 'Collectors', sorted.length),
        count('savers', 'People assigned', sum.savers),
        money('recordedKobo', 'Cash recorded', sum.recorded, `Counted on its business day, ${iso(ctx.fromDate)} to ${iso(ctx.toDate)}`),
        money('confirmedKobo', 'Confirmed by an officer', sum.confirmed),
        money('awaitingKobo', 'Cash awaiting confirmation', sum.awaiting, 'Not counted as received yet'),
        money('handedOverKobo', 'Handed in', sum.handedOver),
        money('countedKobo', 'Counted by an officer', sum.counted),
        money('differenceKobo', 'Handed in less collected', sum.difference, 'Zero means the collector handed in all of it'),
        count('unreconciledDays', 'Days not yet counted', sum.unreconciled),
      ],
    });
  }
  return { blocks, columns: COLLECTORS_COLUMNS, rows };
}
