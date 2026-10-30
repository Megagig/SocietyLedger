/**
 * Fees and revenue report: the group's own income from late fees (assessed, paid, waived, still owed) and the collector fee, and what the
 * group owes SocietyLedger (the platform levy), with the tier it is on. Late fees and the collector fee are the group's money and never
 * SocietyLedger's; the levy is SocietyLedger's and is never taken from a payout.
 */
import prisma from '../../../lib/prisma';
import { getHeldTier } from '../../../services/billing/tier-change.service';
import { formatNaira } from '../ajo-collections';
import { dayInZone } from '../ajo-schedule';
import { AJO_FAMILY } from '../ajo-access';
import { assertUnderCap, iso, ledgerFigures, membersOf, type ReportContext } from './report-context';
import { money, type CircleBlock, type Column, type ReportBody, type Row } from './report-types';

export const FEES_REVENUE_COLUMNS: Column[] = [
  { key: 'circle', label: 'Circle', kind: 'text' },
  { key: 'date', label: 'Date', kind: 'date' },
  { key: 'kind', label: 'Kind', kind: 'text' },
  { key: 'member', label: 'Member', kind: 'text' },
  { key: 'amountKobo', label: 'Amount', kind: 'money' },
  { key: 'paidKobo', label: 'Paid', kind: 'money' },
  { key: 'status', label: 'Status', kind: 'text' },
  { key: 'note', label: 'Note', kind: 'text' },
];

const FEE_STATUS: Record<string, string> = { PENDING: 'Not payable yet', PAYABLE: 'Payable', PAID: 'Paid', WAIVED: 'Waived' };
const LEVY_STATUS: Record<string, string> = { ACCRUED: 'Accrued', BILLED: 'On a checkout', PAID: 'Paid', WAIVED: 'Waived', VOID: 'Void' };
const LEVY_KIND: Record<string, string> = { CYCLE: 'Platform levy (cycle)', PARTICIPANT: 'Platform levy (participant)', CREDIT: 'Platform levy (credit)' };

export async function feesRevenueReport(ctx: ReportContext): Promise<ReportBody> {
  const blocks: CircleBlock[] = [];
  const rows: Array<Row & { _at: number }> = [];

  for (const group of ctx.groups) {
    const ids = membersOf(ctx, group.id);
    const nameOf = (id: number | null) => (id === null ? null : ctx.people.get(id)?.name ?? 'Member');
    const range = { gte: group.startAt, lt: group.endAt };
    const mine: Array<Row & { _at: number }> = [];

    const feeWhere = { installment: { membership: { groupId: group.id, ...(ctx.membershipIds ? { id: { in: ids.length ? ids : [-1] } } : {}) } }, createdAt: range };
    const fees = await prisma.ajoLateFeeAssessment.findMany({ where: feeWhere, include: { installment: { select: { membershipId: true } } }, orderBy: { id: 'asc' } });
    for (const f of fees) {
      mine.push({
        _at: f.createdAt.getTime(),
        circle: group.name,
        date: iso(dayInZone(f.createdAt, group.timezone)),
        kind: 'Late fee',
        member: nameOf(f.installment.membershipId),
        amountKobo: f.feeKobo.toString(),
        paidKobo: f.paidKobo.toString(),
        status: FEE_STATUS[f.status] ?? f.status,
        note: f.status === 'WAIVED' ? f.waivedReason : f.capApplied ? 'The cap limited this fee' : null,
      });
    }

    const feePayouts = ctx.membershipIds ? [] : await prisma.ajoPayout.findMany({ where: { groupId: group.id, status: 'PAID', collectorFeeKobo: { gt: 0 }, paidAt: range }, orderBy: { id: 'asc' } });
    for (const p of feePayouts) {
      mine.push({
        _at: (p.paidAt ?? p.preparedAt).getTime(),
        circle: group.name,
        date: iso(dayInZone(p.paidAt ?? p.preparedAt, group.timezone)),
        kind: 'Collector fee',
        member: nameOf(p.membershipId),
        amountKobo: p.collectorFeeKobo.toString(),
        paidKobo: p.collectorFeeKobo.toString(),
        status: 'Taken from the payout',
        note: p.round !== null ? `Payout for round ${p.round}` : `Payout for cycle ${p.cycleNo}`,
      });
    }

    const levies = ctx.membershipIds ? [] : await prisma.ajoLevyAssessment.findMany({ where: { groupId: group.id, accruedAt: range }, orderBy: { id: 'asc' } });
    for (const l of levies) {
      mine.push({
        _at: l.accruedAt.getTime(),
        circle: group.name,
        date: iso(dayInZone(l.accruedAt, group.timezone)),
        kind: LEVY_KIND[l.kind] ?? 'Platform levy',
        member: nameOf(l.membershipId),
        amountKobo: l.amountKobo.toString(),
        paidKobo: l.status === 'PAID' ? l.amountKobo.toString() : '0',
        status: LEVY_STATUS[l.status] ?? l.status,
        note: l.calculation,
      });
    }

    mine.sort((a, b) => a._at - b._at);
    assertUnderCap(rows.length + mine.length);
    rows.push(...mine);

    const ledger = (await ledgerFigures({ associationId: ctx.associationId, groupId: group.id, timeZone: group.timezone, from: group.startAt, to: group.endAt, membershipIds: ctx.membershipIds ? ids : null })).get('all')!;
    const assessed = fees.reduce((a, f) => a + f.feeKobo, 0n);
    const waived = fees.filter((f) => f.status === 'WAIVED').reduce((a, f) => a + f.feeKobo, 0n);
    const owedNow = await prisma.ajoLateFeeAssessment.aggregate({ where: { status: { in: ['PENDING', 'PAYABLE'] }, installment: { membership: { groupId: group.id, ...(ctx.membershipIds ? { id: { in: ids.length ? ids : [-1] } } : {}) } } }, _sum: { feeKobo: true, paidKobo: true } });
    const levyOf = (status: string) => levies.filter((l) => l.status === status).reduce((a, l) => a + l.amountKobo, 0n);

    blocks.push({
      groupId: group.id,
      groupName: group.name,
      model: group.model,
      timezone: group.timezone,
      metrics: [
        money('lateFeesAssessedKobo', 'Late fees assessed', assessed, 'Assessed in these dates'),
        money('lateFeesPaidKobo', 'Late fees paid', ledger.lateFees, 'From the group ledger, net of reversals'),
        money('lateFeesWaivedKobo', 'Late fees waived', waived),
        money('lateFeesOwedKobo', 'Late fees still owed', (owedNow._sum.feeKobo ?? 0n) - (owedNow._sum.paidKobo ?? 0n), 'Not payable yet or payable, as of today'),
        money('collectorFeesKobo', 'Collector fees', ledger.collectorFees, 'The collector\'s fee, taken from payouts'),
        money('levyAccruedKobo', 'Platform levy accrued', levies.filter((l) => l.status !== 'VOID').reduce((a, l) => a + l.amountKobo, 0n), 'What the group owes SocietyLedger'),
        money('levyPaidKobo', 'Platform levy paid', levyOf('PAID')),
        money('levyWaivedKobo', 'Platform levy waived', levyOf('WAIVED')),
      ],
    });
  }

  const notes: string[] = [];
  const tier = await getHeldTier(ctx.associationId, AJO_FAMILY, ctx.now);
  if (tier) notes.push(`Ajo tier: ${tier.name}, ${formatNaira(BigInt(tier.priceMonthlyKobo))} a month. Late fees and the collector fee belong to the group; the platform levy belongs to SocietyLedger.`);
  return { blocks, columns: FEES_REVENUE_COLUMNS, rows: rows.map(({ _at, ...r }) => r), notes };
}
