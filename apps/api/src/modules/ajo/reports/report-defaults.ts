/**
 * Defaults and arrears report: who is behind (overdue or missed instalments due in the dates, as of today), their unpaid late fees, and
 * the post-payout default cases, repayment plans and disputes around them. The words are Overdue, Missed and Behind by; never "defaulter".
 */
import prisma from '../../../lib/prisma';
import { assertUnderCap, iso, loadStandings, membersOf, type ReportContext } from './report-context';
import { count, money, type CircleBlock, type Column, type ReportBody, type Row } from './report-types';

export const DEFAULTS_COLUMNS: Column[] = [
  { key: 'circle', label: 'Circle', kind: 'text' },
  { key: 'member', label: 'Member', kind: 'text' },
  { key: 'phone', label: 'Phone', kind: 'text' },
  { key: 'standing', label: 'Standing', kind: 'text' },
  { key: 'instalments', label: 'Instalments behind', kind: 'int' },
  { key: 'behindKobo', label: 'Behind by', kind: 'money' },
  { key: 'oldestDue', label: 'Oldest due date', kind: 'date' },
  { key: 'daysLate', label: 'Days late', kind: 'int' },
  { key: 'feesKobo', label: 'Unpaid late fees', kind: 'money' },
  { key: 'caseStatus', label: 'Default case', kind: 'text' },
  { key: 'plan', label: 'Repayment plan', kind: 'text' },
  { key: 'disputes', label: 'Open disputes', kind: 'int' },
];

const CASE_TEXT: Record<string, string> = { OPEN: 'Open', PLAN_AGREED: 'Plan agreed', RESOLVED: 'Resolved', CLOSED_UNRESOLVED: 'Closed, unresolved' };
const PLAN_TEXT: Record<string, string> = { PROPOSED: 'Proposed, not agreed yet', ACTIVE: 'Agreed, being kept', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

export async function defaultsReport(ctx: ReportContext): Promise<ReportBody> {
  const blocks: CircleBlock[] = [];
  const rows: Row[] = [];

  for (const group of ctx.groups) {
    const ids = membersOf(ctx, group.id);
    const standings = (await loadStandings(ctx, group)).filter((s) => !s.waived && (s.state.status === 'OVERDUE' || s.state.status === 'MISSED'));

    const behind = new Map<number, { count: number; kobo: bigint; oldest: Date; days: number; missed: boolean }>();
    let missedKobo = 0n;
    let overdueKobo = 0n;
    for (const s of standings) {
      const have = behind.get(s.membershipId) ?? { count: 0, kobo: 0n, oldest: s.dueDate, days: 0, missed: false };
      have.count += 1;
      have.kobo += s.state.behindKobo;
      if (s.dueDate < have.oldest) have.oldest = s.dueDate;
      have.days = Math.max(have.days, s.state.daysLate);
      if (s.state.status === 'MISSED') {
        have.missed = true;
        missedKobo += s.state.behindKobo;
      } else overdueKobo += s.state.behindKobo;
      behind.set(s.membershipId, have);
    }

    const memberFilter = ids.length ? { in: ids } : { in: [-1] };
    const fees = await prisma.ajoLateFeeAssessment.findMany({ where: { status: { in: ['PENDING', 'PAYABLE'] }, installment: { membershipId: memberFilter, membership: { groupId: group.id } } }, select: { feeKobo: true, paidKobo: true, installment: { select: { membershipId: true } } } });
    const feesBy = new Map<number, bigint>();
    let feesTotal = 0n;
    for (const f of fees) {
      const owed = f.feeKobo > f.paidKobo ? f.feeKobo - f.paidKobo : 0n;
      feesBy.set(f.installment.membershipId, (feesBy.get(f.installment.membershipId) ?? 0n) + owed);
      feesTotal += owed;
    }

    const cases = await prisma.ajoDefaultCase.findMany({ where: { groupId: group.id, membershipId: memberFilter }, orderBy: { id: 'desc' }, include: { plans: { orderBy: { id: 'desc' }, take: 1 } } });
    const openCases = cases.filter((c) => c.status === 'OPEN' || c.status === 'PLAN_AGREED');
    const caseBy = new Map<number, (typeof cases)[number]>();
    for (const c of openCases) if (!caseBy.has(c.membershipId)) caseBy.set(c.membershipId, c);
    const opened = cases.filter((c) => c.openedAt >= group.startAt && c.openedAt < group.endAt).length;
    const closed = cases.filter((c) => c.closedAt && c.closedAt >= group.startAt && c.closedAt < group.endAt).length;
    const plansActive = openCases.filter((c) => c.plans[0]?.status === 'ACTIVE').length;

    const disputes = await prisma.ajoDispute.findMany({ where: { membershipId: memberFilter, membership: { groupId: group.id } }, select: { membershipId: true, status: true, resolvedAt: true } });
    const openDisputes = new Map<number, number>();
    for (const d of disputes) if (d.status === 'OPEN') openDisputes.set(d.membershipId, (openDisputes.get(d.membershipId) ?? 0) + 1);
    const decided = disputes.filter((d) => d.status !== 'OPEN' && d.resolvedAt && d.resolvedAt >= group.startAt && d.resolvedAt < group.endAt).length;

    const people = [...new Set([...behind.keys(), ...caseBy.keys()])].sort((a, b) => (ctx.people.get(a)?.name ?? '').localeCompare(ctx.people.get(b)?.name ?? '') || a - b);
    assertUnderCap(rows.length + people.length);
    for (const id of people) {
      const b = behind.get(id);
      const c = caseBy.get(id);
      const p = ctx.people.get(id);
      rows.push({
        circle: group.name,
        member: p?.name ?? 'Member',
        phone: p?.phone ?? null,
        standing: b ? (b.missed ? 'Missed' : 'Overdue') : 'Up to date',
        instalments: b?.count ?? 0,
        behindKobo: (b?.kobo ?? 0n).toString(),
        oldestDue: b ? iso(b.oldest) : null,
        daysLate: b?.days ?? 0,
        feesKobo: (feesBy.get(id) ?? 0n).toString(),
        caseStatus: c ? CASE_TEXT[c.status] ?? c.status : null,
        plan: c?.plans[0] ? PLAN_TEXT[c.plans[0].status] ?? c.plans[0].status : null,
        disputes: openDisputes.get(id) ?? 0,
      });
    }

    let totalBehind = 0n;
    for (const v of behind.values()) totalBehind += v.kobo;
    blocks.push({
      groupId: group.id,
      groupName: group.name,
      model: group.model,
      timezone: group.timezone,
      metrics: [
        count('membersBehind', 'People behind', behind.size, 'As of today, on instalments due in these dates'),
        count('instalmentsBehind', 'Instalments behind', standings.length),
        money('behindKobo', 'Total behind', totalBehind),
        money('overdueKobo', 'Overdue, in grace', overdueKobo),
        money('missedKobo', 'Missed, past grace', missedKobo),
        money('feesKobo', 'Unpaid late fees', feesTotal, 'Pending or payable, not yet paid or waived'),
        count('openCases', 'Open default cases', openCases.length),
        count('plansActive', 'Repayment plans being kept', plansActive),
        count('casesOpened', 'Cases opened in these dates', opened),
        count('casesClosed', 'Cases closed in these dates', closed),
        count('disputesOpen', 'Open disputes', [...openDisputes.values()].reduce((a, n) => a + n, 0)),
        count('disputesDecided', 'Disputes decided in these dates', decided),
      ],
    });
  }
  return { blocks, columns: DEFAULTS_COLUMNS, rows };
}
