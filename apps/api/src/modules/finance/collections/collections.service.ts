import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../../lib/prisma';
import { RuleError } from '../rule-error';
import { allowsSelfPayment } from '../payment-recording.service';
import { PURPOSE_INCLUDE, purposeOf } from '../charge-purpose';
import { FILTER_LABELS, SETTLEMENT_LABELS, matchesSearch, matchesSettlement, settle, type SettlementFilter } from './settlement';
import type { CollectionExport, Cell } from './collection-export';

/**
 * The four "who has paid" screens (levy campaign, donations, penalties, member ledgers) as one table each, for the exports, and a member's
 * open debts for the Record payment dialog. Status always comes from the money (`settle`), so the screens and the files agree.
 */
export type CollectionScreen = 'levy-campaign' | 'donations' | 'penalties' | 'member-ledger';

export interface CollectionQuery {
  screen: CollectionScreen;
  id?: number;
  status: SettlementFilter;
  search?: string;
  /** Donations only: one allocation (fund). */
  allocationId?: number;
}

const toNumber = (value: Decimal | number | string) => new Decimal(value).toNumber();
const sumPaid = (payments: Array<{ amountPaid: Decimal | number | string }>) => payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
const lastPaid = (payments: Array<{ paymentDate: Date }>) =>
  payments.length === 0 ? null : new Date(Math.max(...payments.map((p) => p.paymentDate.getTime()))).toISOString().slice(0, 10);

const CHARGE_COLUMNS = (whatHeader: string) => [
  { header: 'Member no.', width: 12 },
  { header: 'Member', width: 26 },
  { header: whatHeader, width: 24 },
  { header: 'Amount', width: 14, money: true },
  { header: 'Paid', width: 14, money: true },
  { header: 'Balance', width: 14, money: true },
  { header: 'Status', width: 11 },
  { header: 'Last payment', width: 13 },
];

function filterLine(query: CollectionQuery): string {
  const parts = [`Showing: ${FILTER_LABELS[query.status]}`];
  if (query.search?.trim()) parts.push(`search: "${query.search.trim()}"`);
  return parts.join(', ');
}

interface ChargeRow {
  memberNumber: string;
  memberName: string;
  what: string;
  amount: number;
  paid: number;
  balance: number;
  status: ReturnType<typeof settle>['status'];
  last: string | null;
}

function toCells(rows: ChargeRow[]): Cell[][] {
  return rows.map((r) => [r.memberNumber, r.memberName, r.what, r.amount, r.paid, r.balance, SETTLEMENT_LABELS[r.status], r.last ?? '']);
}

function totals(rows: ChargeRow[]) {
  const amount = rows.reduce((sum, r) => sum + r.amount, 0);
  const paid = rows.reduce((sum, r) => sum + r.paid, 0);
  return [
    { label: 'People listed', value: rows.length },
    { label: 'Expected', value: amount, money: true },
    { label: 'Paid', value: paid, money: true },
    { label: 'Outstanding', value: Math.max(amount - paid, 0), money: true },
  ];
}

export const collectionsService = {
  /** Everything an export needs for one screen, already filtered and searched. */
  async build(associationId: number, query: CollectionQuery): Promise<CollectionExport> {
    const association = await prisma.association.findUnique({ where: { id: associationId }, select: { name: true } });
    const base = { association: association?.name ?? 'Association', generatedAt: new Date(), filterLine: filterLine(query) };

    if (query.screen === 'levy-campaign') {
      if (!query.id) throw new RuleError('Choose a campaign.', 400, 'CAMPAIGN_REQUIRED');
      const campaign = await prisma.levyCampaign.findFirst({
        where: { id: query.id, associationId },
        include: {
          assignments: {
            include: {
              member: { select: { memberId: true, firstName: true, lastName: true } },
              transaction: { include: { payments: { select: { amountPaid: true, paymentDate: true } } } },
            },
            orderBy: { member: { lastName: 'asc' } },
          },
        },
      });
      if (!campaign) throw new RuleError('Campaign not found.', 404, 'NOT_FOUND');
      const everyone: ChargeRow[] = campaign.assignments.map((a) => {
        const paid = sumPaid(a.transaction?.payments ?? []);
        const s = settle(a.amount, paid);
        return {
          memberNumber: a.member.memberId,
          memberName: `${a.member.firstName} ${a.member.lastName}`,
          what: campaign.name,
          amount: toNumber(a.amount),
          paid: paid.toNumber(),
          balance: s.balance.toNumber(),
          status: s.status,
          last: lastPaid(a.transaction?.payments ?? []),
        };
      });
      const rows = everyone.filter((r) => matchesSettlement(r.status, query.status) && matchesSearch(query.search, r.memberName, r.memberNumber));
      return {
        ...base,
        title: `Levy campaign: ${campaign.name}`,
        summary: [{ label: 'Campaign target', value: toNumber(campaign.targetAmount), money: true }, ...totals(rows)],
        columns: CHARGE_COLUMNS('Levy'),
        rows: toCells(rows),
      };
    }

    if (query.screen === 'donations') {
      const records = await prisma.donationRecord.findMany({
        where: { transaction: { associationId, isVoided: false }, ...(query.allocationId ? { allocationId: query.allocationId } : {}) },
        include: {
          allocation: { select: { name: true } },
          transaction: { include: { member: { select: { memberId: true, firstName: true, lastName: true } }, payments: { select: { amountPaid: true, paymentDate: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
      const everyone: ChargeRow[] = records.map((d) => {
        const paid = sumPaid(d.transaction.payments);
        const s = settle(d.transaction.amount, paid);
        return {
          memberNumber: d.isAnonymous ? '' : d.transaction.member.memberId,
          memberName: d.isAnonymous ? 'Anonymous' : `${d.transaction.member.firstName} ${d.transaction.member.lastName}`,
          what: d.allocation?.name ?? 'General donation',
          amount: toNumber(d.transaction.amount),
          paid: paid.toNumber(),
          balance: s.balance.toNumber(),
          status: s.status,
          last: lastPaid(d.transaction.payments),
        };
      });
      const rows = everyone.filter((r) => matchesSettlement(r.status, query.status) && matchesSearch(query.search, r.memberName, r.memberNumber));
      return { ...base, title: 'Donations and pledges', summary: totals(rows), columns: CHARGE_COLUMNS('Fund'), rows: toCells(rows) };
    }

    if (query.screen === 'penalties') {
      const charges = await prisma.transaction.findMany({
        where: { associationId, isVoided: false, category: { type: 'penalty' } },
        include: {
          category: { select: { name: true } },
          member: { select: { memberId: true, firstName: true, lastName: true } },
          payments: { select: { amountPaid: true, paymentDate: true } },
          ...PURPOSE_INCLUDE,
        },
        orderBy: { createdAt: 'desc' },
      });
      const everyone: ChargeRow[] = charges.map((t) => {
        const paid = sumPaid(t.payments);
        const s = settle(t.amount, paid);
        return {
          memberNumber: t.member.memberId,
          memberName: `${t.member.firstName} ${t.member.lastName}`,
          what: purposeOf(t) ? `${t.category.name} · ${purposeOf(t)}` : t.category.name,
          amount: toNumber(t.amount),
          paid: paid.toNumber(),
          balance: s.balance.toNumber(),
          status: s.status,
          last: lastPaid(t.payments),
        };
      });
      const rows = everyone.filter((r) => matchesSettlement(r.status, query.status) && matchesSearch(query.search, r.memberName, r.memberNumber));
      return { ...base, title: 'Penalties and fines', summary: totals(rows), columns: CHARGE_COLUMNS('Penalty'), rows: toCells(rows) };
    }

    // Member ledgers: the running balance on each member's ledger, the same figure the screen shows.
    const members = await memberBalances(associationId, { search: query.search, status: query.status });
    const owing = members.filter((m) => m.balance > 0);
    return {
      ...base,
      title: 'Member ledgers',
      summary: [
        { label: 'Members listed', value: members.length },
        { label: 'Members owing', value: owing.length },
        { label: 'Total outstanding', value: owing.reduce((sum, m) => sum + m.balance, 0), money: true },
      ],
      columns: [
        { header: 'Member no.', width: 12 },
        { header: 'Member', width: 30 },
        { header: 'Status', width: 12 },
        { header: 'Balance', width: 16, money: true },
      ],
      rows: members.map((m) => [m.memberNumber, m.name, m.balance > 0 ? 'Owing' : m.balance < 0 ? 'In credit' : 'Clear', m.balance]),
    };
  },

  /** A member's open debts, for the Record payment dialog, and whether this officer may record them. */
  async openCharges(associationId: number, memberId: number, actorUserId: number) {
    const member = await prisma.member.findFirst({ where: { id: memberId, associationId }, select: { id: true, memberId: true, firstName: true, lastName: true, userId: true } });
    if (!member) throw new RuleError('Member not found.', 404, 'NOT_FOUND');
    const charges = await prisma.transaction.findMany({
      where: { associationId, memberId, isVoided: false },
      include: {
        category: { select: { name: true, type: true } },
        payments: { select: { amountPaid: true } },
        ...PURPOSE_INCLUDE,
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
    const selfOk = await allowsSelfPayment(associationId);
    const canRecord = selfOk || member.userId !== actorUserId;
    const open = charges
      .map((t) => {
        const paid = sumPaid(t.payments);
        const s = settle(t.amount, paid);
        const kind = t.levyAssignment ? 'levy' : t.donationRecord ? 'pledge' : t.category.type === 'penalty' ? 'penalty' : 'charge';
        return {
          transactionId: t.id,
          kind,
          label: purposeOf(t) ?? t.category.name,
          category: t.category.name,
          purpose: purposeOf(t),
          amount: toNumber(t.amount),
          paid: paid.toNumber(),
          balance: s.balance.toNumber(),
          status: s.status,
          dueDate: t.dueDate,
        };
      })
      .filter((c) => c.balance > 0);
    return {
      member: { id: member.id, memberNumber: member.memberId, name: `${member.firstName} ${member.lastName}` },
      canRecord,
      reason: canRecord ? null : 'Another officer needs to record your payment.',
      charges: open,
      totalOwed: open.reduce((sum, c) => sum + c.balance, 0),
    };
  },
};

/** Every member's latest ledger balance, searched and filtered. Owing = balance above zero; cleared = zero or in credit. */
export async function memberBalances(associationId: number, options: { search?: string; status?: SettlementFilter }) {
  const members = await prisma.member.findMany({
    where: { associationId },
    select: { id: true, memberId: true, firstName: true, lastName: true, email: true, status: true },
    orderBy: { lastName: 'asc' },
  });
  const matching = members.filter((m) => matchesSearch(options.search, `${m.firstName} ${m.lastName}`, m.memberId, m.email));
  const latest = matching.length === 0 ? [] : await prisma.memberFinancialLedger.findMany({
    where: { associationId, memberId: { in: matching.map((m) => m.id) } },
    orderBy: [{ memberId: 'asc' }, { createdAt: 'desc' }],
    distinct: ['memberId'],
    select: { memberId: true, runningBalance: true },
  });
  const balanceOf = new Map(latest.map((row) => [row.memberId, Number(row.runningBalance)]));
  const filter = options.status ?? 'all';
  return matching
    .map((m) => ({ ...m, name: `${m.firstName} ${m.lastName}`, memberNumber: m.memberId, balance: balanceOf.get(m.id) ?? 0 }))
    .filter((m) => (filter === 'all' ? true : filter === 'paid' ? m.balance <= 0 : m.balance > 0));
}
