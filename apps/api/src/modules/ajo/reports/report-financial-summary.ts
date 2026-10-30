/**
 * Group financial summary: for each circle, what came in, what went out, what is owed, and how much cash has been counted. One row per
 * circle per month. Every money-in and money-out figure is a total of the group ledger, so it reconciles with it to the kobo.
 * This report is about the circle as a whole, so the person and collector filters do not apply to it.
 */
import prisma from '../../../lib/prisma';
import { ledgerFigures, netOf, type ReportContext } from './report-context';
import { count, money, type CircleBlock, type Column, type ReportBody, type Row } from './report-types';

export const FINANCIAL_SUMMARY_COLUMNS: Column[] = [
  { key: 'circle', label: 'Circle', kind: 'text' },
  { key: 'month', label: 'Month', kind: 'text' },
  { key: 'contributionsKobo', label: 'Contributions', kind: 'money' },
  { key: 'lateFeesKobo', label: 'Late fees paid', kind: 'money' },
  { key: 'adjustmentsKobo', label: 'Adjustments', kind: 'money' },
  { key: 'payoutsKobo', label: 'Payouts', kind: 'money' },
  { key: 'collectorFeesKobo', label: 'Collector fees', kind: 'money' },
  { key: 'netKobo', label: 'Net movement', kind: 'money' },
];

/** Every `YYYY-MM` from the first date's month to the last date's month. */
function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  while (y < to.getUTCFullYear() || (y === to.getUTCFullYear() && m <= to.getUTCMonth())) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

export async function financialSummaryReport(ctx: ReportContext): Promise<ReportBody> {
  const blocks: CircleBlock[] = [];
  const rows: Row[] = [];

  for (const group of ctx.groups) {
    const base = { associationId: ctx.associationId, groupId: group.id, timeZone: group.timezone };
    const monthly = await ledgerFigures({ ...base, from: group.startAt, to: group.endAt, byMonth: true });
    const inRange = await ledgerFigures({ ...base, from: group.startAt, to: group.endAt });
    const upToEnd = await ledgerFigures({ ...base, to: group.endAt });
    const period = inRange.get('all')!;

    for (const month of monthsBetween(ctx.fromDate, ctx.toDate)) {
      const f = monthly.get(month);
      rows.push({
        circle: group.name,
        month,
        contributionsKobo: (f?.contributions ?? 0n).toString(),
        lateFeesKobo: (f?.lateFees ?? 0n).toString(),
        adjustmentsKobo: (f?.adjustments ?? 0n).toString(),
        payoutsKobo: (f?.payouts ?? 0n).toString(),
        collectorFeesKobo: (f?.collectorFees ?? 0n).toString(),
        netKobo: (f ? netOf(f) : 0n).toString(),
      });
    }

    // What is owed: instalments already due and unpaid, payouts prepared or approved but not yet paid, and late fees not yet paid or waived.
    const owed = await prisma.ajoInstallment.aggregate({ where: { membership: { groupId: group.id }, status: { in: ['DUE', 'PARTIAL', 'OVERDUE'] }, dueDate: { lte: group.today } }, _sum: { amountKobo: true, paidKobo: true } });
    const outstanding = (owed._sum.amountKobo ?? 0n) - (owed._sum.paidKobo ?? 0n);
    const pending = await prisma.ajoPayout.aggregate({ where: { groupId: group.id, status: { in: ['PREPARED', 'APPROVED'] } }, _sum: { netKobo: true } });
    const fees = await prisma.ajoLateFeeAssessment.aggregate({ where: { status: { in: ['PENDING', 'PAYABLE'] }, installment: { membership: { groupId: group.id } } }, _sum: { feeKobo: true, paidKobo: true } });

    // Cash: what collectors collected and handed in on these days, and what an officer has actually counted.
    const handovers = await prisma.ajoCashHandover.findMany({ where: { groupId: group.id, forDate: { gte: ctx.fromDate, lte: ctx.toDate } }, select: { collectedKobo: true, countedKobo: true, reconciledAt: true } });
    const collected = handovers.reduce((a, h) => a + h.collectedKobo, 0n);
    const counted = handovers.reduce((a, h) => a + (h.reconciledAt ? h.countedKobo ?? 0n : 0n), 0n);
    const notCounted = handovers.filter((h) => !h.reconciledAt).length;
    const waiting = await prisma.ajoContribution.aggregate({ where: { groupId: group.id, status: { in: ['REPORTED', 'CASH_RECEIVED'] }, reversalOfId: null }, _sum: { amountKobo: true } });

    blocks.push({
      groupId: group.id,
      groupName: group.name,
      model: group.model,
      timezone: group.timezone,
      metrics: [
        money('contributionsKobo', 'Contributions', period.contributions, 'Net of reversals'),
        money('lateFeesKobo', 'Late fees paid', period.lateFees),
        money('adjustmentsKobo', 'Adjustments', period.adjustments),
        money('payoutsKobo', 'Payouts', period.payouts, 'Recorded as paid, net of reversals'),
        money('collectorFeesKobo', 'Collector fees', period.collectorFees),
        money('netKobo', 'Net movement in these dates', netOf(period)),
        money('balanceKobo', 'Recorded balance at the end', netOf(upToEnd.get('all')!), 'Everything recorded up to the end date, less everything paid out'),
        money('outstandingKobo', 'Owed by members, already due', outstanding),
        money('pendingPayoutsKobo', 'Payouts waiting to be paid', pending._sum.netKobo ?? 0n),
        money('lateFeesOwedKobo', 'Late fees not yet paid', (fees._sum.feeKobo ?? 0n) - (fees._sum.paidKobo ?? 0n)),
        money('cashCollectedKobo', 'Cash collected', collected),
        money('cashCountedKobo', 'Cash counted by an officer', counted, 'Only days an officer has counted'),
        count('daysNotCounted', 'Days not yet counted', notCounted),
        money('awaitingKobo', 'Reported or cash received, awaiting confirmation', waiting._sum.amountKobo ?? 0n, 'Not in the figures above until confirmed'),
      ],
    });
  }
  return { blocks, columns: FINANCIAL_SUMMARY_COLUMNS, rows };
}
