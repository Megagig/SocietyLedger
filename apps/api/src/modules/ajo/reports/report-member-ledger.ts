/**
 * Member ledger report: every entry in the group ledger for the people in the report, with a running balance for each person.
 * Credits are money in (contributions, fees paid); debits are money out (payouts, collector fee) and the opposite of a reversed entry.
 * The totals are plain sums of those entries, so they match the ledger to the kobo.
 */
import prisma from '../../../lib/prisma';
import { assertUnderCap, membersOf, userNames, type ReportContext } from './report-context';
import { count, money, type CircleBlock, type Column, type ReportBody, type Row } from './report-types';

export const MEMBER_LEDGER_COLUMNS: Column[] = [
  { key: 'circle', label: 'Circle', kind: 'text' },
  { key: 'member', label: 'Member', kind: 'text' },
  { key: 'at', label: 'Recorded', kind: 'datetime' },
  { key: 'entry', label: 'Entry', kind: 'text' },
  { key: 'reference', label: 'For', kind: 'text' },
  { key: 'creditKobo', label: 'Money in', kind: 'money' },
  { key: 'debitKobo', label: 'Money out', kind: 'money' },
  { key: 'balanceKobo', label: 'Balance', kind: 'money' },
  { key: 'reason', label: 'Reason', kind: 'text' },
  { key: 'by', label: 'Recorded by', kind: 'text' },
];

const TYPE_LABEL: Record<string, string> = { CONTRIBUTION: 'Contribution', REVERSAL: 'Reversal', FEE: 'Fee', PAYOUT: 'Payout', ADJUSTMENT: 'Adjustment' };

/** What an entry is about, in words. */
function referenceText(refType: string, refId: number | null): string {
  const n = refId === null ? '' : ` #${refId}`;
  if (refType === 'contribution') return `Payment${n}`;
  if (refType === 'late_fee') return `Late fee paid with payment${n}`;
  if (refType === 'payout') return `Payout${n}`;
  return refType.replace(/_/g, ' ');
}

export async function memberLedgerReport(ctx: ReportContext): Promise<ReportBody> {
  const blocks: CircleBlock[] = [];
  const rows: Row[] = [];

  for (const group of ctx.groups) {
    const ids = membersOf(ctx, group.id);
    const inRange = { associationId: ctx.associationId, groupId: group.id, membershipId: { in: ids }, createdAt: { gte: group.startAt, lt: group.endAt } };
    assertUnderCap(rows.length + (ids.length ? await prisma.ajoLedgerEntry.count({ where: inRange }) : 0));

    const entries = ids.length ? await prisma.ajoLedgerEntry.findMany({ where: inRange, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }) : [];
    const openingRows = ids.length
      ? await prisma.ajoLedgerEntry.groupBy({ by: ['membershipId', 'direction'], where: { associationId: ctx.associationId, groupId: group.id, membershipId: { in: ids }, createdAt: { lt: group.startAt } }, _sum: { amountKobo: true } })
      : [];
    const opening = new Map<number, bigint>();
    for (const o of openingRows) {
      if (o.membershipId === null) continue;
      const sum = o._sum.amountKobo ?? 0n;
      opening.set(o.membershipId, (opening.get(o.membershipId) ?? 0n) + (o.direction === 'CREDIT' ? sum : -sum));
    }

    const who = await userNames(ctx.associationId, entries.map((e) => e.createdBy));
    const nameOf = (id: number | null) => (id === null ? 'Member' : ctx.people.get(id)?.name ?? 'Member');

    // Group each person's entries together, people in name order, each person's entries in time order, so the running balance reads down.
    const byPerson = new Map<number, typeof entries>();
    for (const e of entries) if (e.membershipId !== null) byPerson.set(e.membershipId, [...(byPerson.get(e.membershipId) ?? []), e]);
    // A person with an opening balance but no entry in the dates still belongs in the totals, though they have no row to show.
    const people = [...new Set([...byPerson.keys(), ...opening.keys()])].sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || a - b);

    let credits = 0n;
    let debits = 0n;
    let openingTotal = 0n;
    for (const id of people) {
      let balance = opening.get(id) ?? 0n;
      openingTotal += balance;
      for (const e of byPerson.get(id) ?? []) {
        const isCredit = e.direction === 'CREDIT';
        balance += isCredit ? e.amountKobo : -e.amountKobo;
        if (isCredit) credits += e.amountKobo;
        else debits += e.amountKobo;
        rows.push({
          circle: group.name,
          member: nameOf(id),
          at: e.createdAt.toISOString(),
          entry: e.type === 'REVERSAL' ? `Reversal of ${referenceText(e.refType, e.refId).toLowerCase()}` : TYPE_LABEL[e.type] ?? e.type,
          reference: referenceText(e.refType, e.refId),
          creditKobo: isCredit ? e.amountKobo.toString() : '0',
          debitKobo: isCredit ? '0' : e.amountKobo.toString(),
          balanceKobo: balance.toString(),
          reason: e.reason,
          by: who(e.createdBy),
        });
      }
    }

    blocks.push({
      groupId: group.id,
      groupName: group.name,
      model: group.model,
      timezone: group.timezone,
      metrics: [
        money('openingKobo', 'Balance before these dates', openingTotal),
        money('creditKobo', 'Money in', credits),
        money('debitKobo', 'Money out', debits),
        money('closingKobo', 'Balance at the end', openingTotal + credits - debits, 'Recorded in, less recorded out'),
        count('entries', 'Entries', entries.length),
      ],
    });
  }
  return { blocks, columns: MEMBER_LEDGER_COLUMNS, rows };
}
