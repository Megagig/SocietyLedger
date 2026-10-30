/**
 * Contributions report: what was expected, what has been paid toward it, what is outstanding, overdue or missed, and what the ledger says
 * was received in the dates. One row per instalment due in the range.
 */
import { STATUS_LABEL } from '../ajo-status';
import { assertUnderCap, iso, ledgerFigures, loadStandings, membersOf, type ReportContext } from './report-context';
import { count, money, metric, type CircleBlock, type Column, type ReportBody, type Row } from './report-types';

export const CONTRIBUTIONS_COLUMNS: Column[] = [
  { key: 'circle', label: 'Circle', kind: 'text' },
  { key: 'member', label: 'Member', kind: 'text' },
  { key: 'dueDate', label: 'Due date', kind: 'date' },
  { key: 'expectedKobo', label: 'Expected', kind: 'money' },
  { key: 'paidKobo', label: 'Paid', kind: 'money' },
  { key: 'toPayKobo', label: 'Still to pay', kind: 'money' },
  { key: 'status', label: 'Status', kind: 'text' },
  { key: 'daysLate', label: 'Days late', kind: 'int' },
];

export async function contributionsReport(ctx: ReportContext): Promise<ReportBody> {
  const blocks: CircleBlock[] = [];
  const rows: Row[] = [];

  for (const group of ctx.groups) {
    const standings = await loadStandings(ctx, group);
    assertUnderCap(rows.length + standings.length);

    let expected = 0n;
    let paid = 0n;
    let outstanding = 0n;
    let reported = 0n;
    let overdue = 0n;
    let missed = 0n;
    for (const s of standings) {
      const toPay = s.waived || s.amountKobo <= s.paidKobo ? 0n : s.amountKobo - s.paidKobo;
      rows.push({
        circle: group.name,
        member: ctx.people.get(s.membershipId)?.name ?? 'Member',
        dueDate: iso(s.dueDate),
        expectedKobo: s.waived ? '0' : s.amountKobo.toString(),
        paidKobo: s.paidKobo.toString(),
        toPayKobo: toPay.toString(),
        status: STATUS_LABEL[s.state.status],
        daysLate: s.state.daysLate,
      });
      if (s.waived) continue;
      expected += s.amountKobo;
      paid += s.paidKobo > s.amountKobo ? s.amountKobo : s.paidKobo;
      if (s.dueDate.getTime() <= group.today.getTime()) outstanding += toPay;
      reported += s.reportedKobo;
      if (s.state.status === 'OVERDUE') overdue += s.state.behindKobo;
      if (s.state.status === 'MISSED') missed += s.state.behindKobo;
    }

    const ledger = (await ledgerFigures({ associationId: ctx.associationId, groupId: group.id, timeZone: group.timezone, from: group.startAt, to: group.endAt, membershipIds: ctx.membershipIds ? membersOf(ctx, group.id) : null })).get('all');
    blocks.push({
      groupId: group.id,
      groupName: group.name,
      model: group.model,
      timezone: group.timezone,
      metrics: [
        money('expectedKobo', 'Expected', expected, 'Due in these dates; waived rounds left out'),
        money('paidKobo', 'Paid toward these', paid, 'Confirmed money only'),
        money('outstandingKobo', 'Outstanding', outstanding, 'Already due and not yet paid'),
        money('reportedKobo', 'Reported, awaiting confirmation', reported, 'Not counted as paid until an officer confirms'),
        money('overdueKobo', 'Overdue, in grace', overdue),
        money('missedKobo', 'Missed, past grace', missed),
        metric('collectionBps', 'Collected', 'percent', expected > 0n ? Number((paid * 10_000n) / expected) : null, 'Paid out of expected'),
        money('receivedKobo', 'Received in these dates', ledger?.contributions ?? 0n, 'From the group ledger, net of reversals'),
        count('instalments', 'Instalments', standings.length),
      ],
    });
  }
  return { blocks, columns: CONTRIBUTIONS_COLUMNS, rows };
}
