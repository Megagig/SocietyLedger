/**
 * Payouts report: scheduled, pending, paid and reversed payouts with their beneficiaries.
 *
 * A payout is counted on the day it was recorded as paid; one not yet paid is counted on the day it was prepared; a round still to be
 * prepared (rotating pot) is "Scheduled" on the round's due date. Only a payout recorded as paid moves money in the ledger, and the
 * "Paid out per the ledger" figure is that ledger total, so it can be checked against the group ledger.
 */
import prisma from '../../../lib/prisma';
import { dayInZone } from '../ajo-schedule';
import { assertUnderCap, iso, ledgerFigures, membersOf, userNames, type ReportContext } from './report-context';
import { count, money, type CircleBlock, type Column, type ReportBody, type Row } from './report-types';

export const PAYOUTS_COLUMNS: Column[] = [
  { key: 'circle', label: 'Circle', kind: 'text' },
  { key: 'date', label: 'Date', kind: 'date' },
  { key: 'turn', label: 'Round or cycle', kind: 'text' },
  { key: 'beneficiary', label: 'Beneficiary', kind: 'text' },
  { key: 'status', label: 'Status', kind: 'text' },
  { key: 'grossKobo', label: 'Gross', kind: 'money' },
  { key: 'feeKobo', label: 'Collector fee', kind: 'money' },
  { key: 'shortfallKobo', label: 'Shortfall', kind: 'money' },
  { key: 'netKobo', label: 'Net', kind: 'money' },
  { key: 'preparedBy', label: 'Prepared by', kind: 'text' },
  { key: 'approvedBy', label: 'Approved by', kind: 'text' },
  { key: 'paidBy', label: 'Recorded paid by', kind: 'text' },
  { key: 'reference', label: 'Bank reference', kind: 'text' },
];

const STATUS_TEXT: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  PREPARED: 'Prepared, awaiting approval',
  APPROVED: 'Approved, awaiting payment record',
  PAID: 'Paid',
  VOID: 'Cancelled',
  REVERSED: 'Paid, then reversed',
};

export async function payoutsReport(ctx: ReportContext): Promise<ReportBody> {
  const blocks: CircleBlock[] = [];
  const rows: Array<Row & { _at: number }> = [];

  for (const group of ctx.groups) {
    const ids = membersOf(ctx, group.id);
    const filterMembers = ctx.membershipIds ? { membershipId: { in: ids } } : {};
    const where = {
      groupId: group.id,
      ...filterMembers,
      OR: [{ paidAt: { gte: group.startAt, lt: group.endAt } }, { paidAt: null, preparedAt: { gte: group.startAt, lt: group.endAt } }],
    };
    assertUnderCap(rows.length + (await prisma.ajoPayout.count({ where })));
    const payouts = await prisma.ajoPayout.findMany({ where, orderBy: [{ id: 'asc' }] });
    const who = await userNames(ctx.associationId, payouts.flatMap((p) => [p.preparedBy, p.approvedBy, p.paidRecordedBy]));
    const nameOf = (membershipId: number) => ctx.people.get(membershipId)?.name ?? 'Member';
    const mine: Array<Row & { _at: number }> = [];

    const m = { pendingCount: 0, pendingKobo: 0n, paidCount: 0, paidKobo: 0n, reversedCount: 0, reversedKobo: 0n, voided: 0, fees: 0n };
    const paidPeople = new Set<number>();
    for (const p of payouts) {
      const basis = p.paidAt ?? p.preparedAt;
      mine.push({
        _at: basis.getTime(),
        circle: group.name,
        date: iso(dayInZone(basis, group.timezone)),
        turn: p.round !== null ? `Round ${p.round}${p.sequence > 1 ? ` (extra payout ${p.sequence})` : ''}` : `Cycle ${p.cycleNo}`,
        beneficiary: nameOf(p.membershipId),
        status: STATUS_TEXT[p.status] ?? p.status,
        grossKobo: p.grossKobo.toString(),
        feeKobo: p.collectorFeeKobo.toString(),
        shortfallKobo: p.shortfallKobo.toString(),
        netKobo: p.netKobo.toString(),
        preparedBy: who(p.preparedBy),
        approvedBy: who(p.approvedBy),
        paidBy: who(p.paidRecordedBy),
        reference: p.paidReference,
      });
      if (p.status === 'PREPARED' || p.status === 'APPROVED') {
        m.pendingCount += 1;
        m.pendingKobo += p.netKobo;
      } else if (p.status === 'PAID') {
        m.paidCount += 1;
        m.paidKobo += p.netKobo;
        m.fees += p.collectorFeeKobo;
        paidPeople.add(p.membershipId);
      } else if (p.status === 'REVERSED') {
        m.reversedCount += 1;
        m.reversedKobo += p.netKobo;
      } else if (p.status === 'VOID') m.voided += 1;
    }

    // A rotating pot's rounds that fall in the dates and have no payout yet: the pot they should bring in, and who is due it.
    let scheduledCount = 0;
    let scheduledPot = 0n;
    if (group.model === 'ROTATING_POT') {
      const slots = await prisma.ajoPayoutSlot.findMany({ where: { groupId: group.id }, select: { membershipId: true, position: true, shareNo: true } });
      // Round N is the Nth due date. A round whose instalments were all waived still has its date (it only brings in nothing), so the
      // dates are counted with the waived ones in and the pot is added up without them.
      const dueDates = await prisma.ajoInstallment.groupBy({ by: ['dueDate'], where: { membership: { groupId: group.id } }, orderBy: { dueDate: 'asc' } });
      const potRows = await prisma.ajoInstallment.groupBy({ by: ['dueDate'], where: { membership: { groupId: group.id }, status: { not: 'WAIVED' } }, _sum: { amountKobo: true } });
      const potOn = new Map(potRows.map((p) => [iso(p.dueDate), p._sum.amountKobo ?? 0n]));
      const taken = await prisma.ajoPayout.findMany({ where: { groupId: group.id, status: { in: ['PREPARED', 'APPROVED', 'PAID'] } }, select: { membershipId: true, round: true } });
      const done = new Set(taken.map((t) => `${t.membershipId}:${t.round}`));
      for (const s of slots) {
        const round = dueDates[s.position - 1];
        if (!round || round.dueDate < ctx.fromDate || round.dueDate > ctx.toDate) continue;
        if (ids.length && !ids.includes(s.membershipId)) continue;
        if (ctx.membershipIds && !ids.includes(s.membershipId)) continue;
        if (done.has(`${s.membershipId}:${s.position}`)) continue;
        const pot = potOn.get(iso(round.dueDate)) ?? 0n;
        scheduledCount += 1;
        scheduledPot += pot;
        mine.push({
          _at: round.dueDate.getTime(),
          circle: group.name,
          date: iso(round.dueDate),
          turn: `Round ${s.position}`,
          beneficiary: nameOf(s.membershipId),
          status: STATUS_TEXT.SCHEDULED,
          grossKobo: pot.toString(),
          feeKobo: '0',
          shortfallKobo: '0',
          netKobo: pot.toString(),
          preparedBy: null,
          approvedBy: null,
          paidBy: null,
          reference: null,
        });
      }
    }

    mine.sort((a, b) => a._at - b._at);
    rows.push(...mine);

    const ledger = (await ledgerFigures({ associationId: ctx.associationId, groupId: group.id, timeZone: group.timezone, from: group.startAt, to: group.endAt, membershipIds: ctx.membershipIds ? ids : null })).get('all');
    blocks.push({
      groupId: group.id,
      groupName: group.name,
      model: group.model,
      timezone: group.timezone,
      metrics: [
        count('scheduledCount', 'Scheduled, not yet prepared', scheduledCount),
        money('scheduledKobo', 'Expected pot of those rounds', scheduledPot, 'What the round should bring in'),
        count('pendingCount', 'Waiting to be paid', m.pendingCount, 'Prepared or approved'),
        money('pendingKobo', 'Amount waiting', m.pendingKobo),
        count('paidCount', 'Paid', m.paidCount),
        money('paidKobo', 'Paid', m.paidKobo, 'Recorded as paid in these dates'),
        count('reversedCount', 'Reversed after payment', m.reversedCount),
        money('reversedKobo', 'Amount reversed', m.reversedKobo),
        count('voided', 'Cancelled', m.voided),
        money('feesKobo', 'Collector fees on paid payouts', m.fees),
        count('beneficiaries', 'People paid', paidPeople.size),
        money('ledgerPaidKobo', 'Paid out per the ledger', ledger?.payouts ?? 0n, 'Net of reversals; the figure to check against the ledger'),
      ],
    });
  }
  return { blocks, columns: PAYOUTS_COLUMNS, rows: rows.map(({ _at, ...r }) => r) };
}
