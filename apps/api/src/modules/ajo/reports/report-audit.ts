/**
 * Audit and activity report: what was approved, changed, reversed or waived, by whom, when and why, newest first. It is built from the
 * records Ajo already keeps (confirmations, payouts, waivers, rule versions, order changes, default case events, cash counts, report
 * exports), so it adds nothing to write and cannot disagree with them.
 *
 * Routine payment records are not repeated here: every one of them is in the member ledger. Free-text notes and claims are left out;
 * the reasons officers had to give for a change are shown.
 */
import prisma from '../../../lib/prisma';
import { formatNaira } from '../ajo-collections';
import { assertUnderCap, MAX_ROWS, userNames, membersOf, type ReportContext } from './report-context';
import { count, type CircleBlock, type Column, type ReportBody, type Row } from './report-types';

export const AUDIT_COLUMNS: Column[] = [
  { key: 'circle', label: 'Circle', kind: 'text' },
  { key: 'at', label: 'When', kind: 'datetime' },
  { key: 'event', label: 'Event', kind: 'text' },
  { key: 'what', label: 'What happened', kind: 'text' },
  { key: 'by', label: 'By', kind: 'text' },
  { key: 'reason', label: 'Reason', kind: 'text' },
];

type Kind = 'confirmation' | 'selfConfirmation' | 'reversal' | 'rejection' | 'payout' | 'payoutVoidOrReversal' | 'approval' | 'waiver' | 'rules' | 'order' | 'caseEvent' | 'cash' | 'export';
interface Ev {
  at: Date;
  kind: Kind;
  event: string;
  what: string;
  by: number | null;
  reason: string | null;
}

const CASE_EVENT: Record<string, string> = {
  OPENED: 'Default case opened',
  NOTE: 'Note added to a default case',
  MEMBER_RESPONSE: 'Member responded to a default case',
  PLAN_PROPOSED: 'Repayment plan proposed',
  PLAN_AGREED: 'Repayment plan agreed',
  PLAN_CANCELLED: 'Repayment plan cancelled',
  PLAN_MISSED: 'Repayment plan date missed',
  PLAN_COMPLETED: 'Repayment plan completed',
  CLOSED: 'Default case closed',
};

export async function auditReport(ctx: ReportContext): Promise<ReportBody> {
  const blocks: CircleBlock[] = [];
  const all: Array<{ group: string; ev: Ev }> = [];
  const restricted = ctx.membershipIds !== null;
  const take = MAX_ROWS + 1;

  const exportsRows = restricted
    ? []
    : await prisma.auditLog.findMany({
        where: { associationId: ctx.associationId, action: 'AJO_REPORT_EXPORTED', createdAt: { gte: ctx.groups.reduce((a, g) => (g.startAt < a ? g.startAt : a), ctx.groups[0]?.startAt ?? ctx.now), lt: ctx.groups.reduce((a, g) => (g.endAt > a ? g.endAt : a), ctx.groups[0]?.endAt ?? ctx.now) } },
        orderBy: { id: 'desc' },
        take,
        select: { userId: true, createdAt: true, newValues: true },
      });

  const perGroup: Array<{ group: (typeof ctx.groups)[number]; evs: Ev[] }> = [];
  for (const group of ctx.groups) {
    const ids = membersOf(ctx, group.id);
    const range = { gte: group.startAt, lt: group.endAt };
    const mem = restricted ? { membershipId: { in: ids.length ? ids : [-1] } } : {};
    const nameOf = (id: number) => ctx.people.get(id)?.name ?? 'a member';
    const evs: Ev[] = [];

    const confirmed = await prisma.ajoContribution.findMany({ where: { groupId: group.id, reversalOfId: null, confirmedAt: range, ...mem }, orderBy: { confirmedAt: 'desc' }, take, select: { amountKobo: true, method: true, membershipId: true, confirmedAt: true, confirmedBy: true, selfConfirmed: true } });
    for (const c of confirmed) {
      evs.push({ at: c.confirmedAt as Date, kind: c.selfConfirmed ? 'selfConfirmation' : 'confirmation', event: 'Payment confirmed', what: `${formatNaira(c.amountKobo)} ${c.method === 'CASH' ? 'cash' : 'transfer'} from ${nameOf(c.membershipId)} was confirmed${c.selfConfirmed ? ' by the person who recorded it' : ''}`, by: c.confirmedBy, reason: null });
    }
    const rejected = await prisma.ajoContribution.findMany({ where: { groupId: group.id, rejectedAt: range, ...mem }, take, select: { amountKobo: true, membershipId: true, rejectedAt: true, rejectedBy: true, reason: true } });
    for (const c of rejected) evs.push({ at: c.rejectedAt as Date, kind: 'rejection', event: 'Payment turned down', what: `${formatNaira(c.amountKobo)} reported by ${nameOf(c.membershipId)} was turned down`, by: c.rejectedBy, reason: c.reason });
    const reversals = await prisma.ajoContribution.findMany({ where: { groupId: group.id, reversalOfId: { not: null }, createdAt: range, ...mem }, take, select: { amountKobo: true, membershipId: true, createdAt: true, recordedBy: true, confirmedBy: true, reason: true } });
    for (const c of reversals) evs.push({ at: c.createdAt, kind: 'reversal', event: 'Payment reversed', what: `A payment of ${formatNaira(c.amountKobo)} from ${nameOf(c.membershipId)} was reversed`, by: c.recordedBy ?? c.confirmedBy, reason: c.reason });

    const payouts = await prisma.ajoPayout.findMany({ where: { groupId: group.id, OR: [{ preparedAt: range }, { approvedAt: range }, { paidAt: range }, { voidedAt: range }, { reversedAt: range }], ...mem }, take });
    const inR = (d: Date | null) => d !== null && d >= group.startAt && d < group.endAt;
    for (const p of payouts) {
      const turn = p.round !== null ? `round ${p.round}` : `cycle ${p.cycleNo}`;
      const amount = formatNaira(p.netKobo);
      if (inR(p.preparedAt)) evs.push({ at: p.preparedAt, kind: 'payout', event: 'Payout prepared', what: `A payout of ${amount} to ${nameOf(p.membershipId)} for ${turn} was prepared`, by: p.preparedBy, reason: null });
      if (inR(p.approvedAt)) evs.push({ at: p.approvedAt as Date, kind: 'payout', event: 'Payout approved', what: `The payout of ${amount} to ${nameOf(p.membershipId)} was approved${p.selfApprovalConfirmed ? ' by the person who prepared it' : ''}`, by: p.approvedBy, reason: p.approvalNote });
      if (inR(p.paidAt)) evs.push({ at: p.paidAt as Date, kind: 'payout', event: 'Payout recorded as paid', what: `The payout of ${amount} to ${nameOf(p.membershipId)} was recorded as paid`, by: p.paidRecordedBy, reason: null });
      if (inR(p.voidedAt)) evs.push({ at: p.voidedAt as Date, kind: 'payoutVoidOrReversal', event: p.failed ? 'Payout failed' : 'Payout cancelled', what: `The payout of ${amount} to ${nameOf(p.membershipId)} was ${p.failed ? 'marked as failed' : 'cancelled'}`, by: p.voidedBy, reason: p.voidReason });
      if (inR(p.reversedAt)) evs.push({ at: p.reversedAt as Date, kind: 'payoutVoidOrReversal', event: 'Payout reversed', what: `The payout of ${amount} to ${nameOf(p.membershipId)} was reversed after it was recorded as paid`, by: p.reversedBy, reason: p.reverseReason });
    }

    const approvals = await prisma.ajoMembership.findMany({ where: { groupId: group.id, approvedAt: range, ...(restricted ? { id: { in: ids.length ? ids : [-1] } } : {}) }, take, select: { id: true, approvedAt: true, approvedBy: true } });
    for (const a of approvals) evs.push({ at: a.approvedAt as Date, kind: 'approval', event: 'Member approved', what: `${nameOf(a.id)} was approved to join`, by: a.approvedBy, reason: null });

    const waivers = await prisma.ajoLateFeeAssessment.findMany({ where: { status: 'WAIVED', waivedAt: range, installment: { membership: { groupId: group.id, ...(restricted ? { id: { in: ids.length ? ids : [-1] } } : {}) } } }, take, select: { feeKobo: true, waivedAt: true, waivedBy: true, waivedReason: true, installment: { select: { membershipId: true } } } });
    for (const w of waivers) evs.push({ at: w.waivedAt as Date, kind: 'waiver', event: 'Late fee waived', what: `A late fee of ${formatNaira(w.feeKobo)} for ${nameOf(w.installment.membershipId)} was waived`, by: w.waivedBy, reason: w.waivedReason });

    if (!restricted) {
      const versions = await prisma.ajoGroupRuleVersion.findMany({ where: { groupId: group.id, createdAt: range }, take, select: { version: true, effectiveFrom: true, createdAt: true, createdBy: true } });
      for (const v of versions) evs.push({ at: v.createdAt, kind: 'rules', event: v.version === 1 ? 'Rules set' : 'Rules changed', what: `Rules version ${v.version} was published, applying from ${v.effectiveFrom.toISOString().slice(0, 10)}`, by: v.createdBy, reason: null });
      const orders = await prisma.ajoPayoutOrderEvent.findMany({ where: { groupId: group.id, createdAt: range }, take, select: { type: true, reason: true, requestedBy: true, approvedBy: true, createdAt: true } });
      for (const o of orders) evs.push({ at: o.createdAt, kind: 'order', event: o.type === 'DRAW' ? 'Payout order drawn' : o.type === 'ADMIN_SET' ? 'Payout order set by the admin' : o.type === 'SWAP' ? 'Payout positions swapped' : 'Emergency change to the payout order', what: o.type === 'DRAW' ? 'The payout order was drawn and recorded' : o.type === 'ADMIN_SET' ? 'The admin placed every share by hand and gave a reason' : o.type === 'SWAP' ? 'Two payout positions were swapped' : 'A member was moved to a different payout position', by: o.approvedBy ?? o.requestedBy, reason: o.reason });
    }

    const caseEvents = await prisma.ajoCaseEvent.findMany({ where: { createdAt: range, defaultCase: { groupId: group.id, ...(restricted ? { membershipId: { in: ids.length ? ids : [-1] } } : {}) } }, take, select: { kind: true, actorUserId: true, createdAt: true, defaultCase: { select: { membershipId: true } } } });
    for (const e of caseEvents) evs.push({ at: e.createdAt, kind: 'caseEvent', event: CASE_EVENT[e.kind] ?? e.kind, what: `${CASE_EVENT[e.kind] ?? e.kind} for ${nameOf(e.defaultCase.membershipId)}`, by: e.actorUserId, reason: null });

    if (!restricted) {
      const counts = await prisma.ajoCashHandover.findMany({ where: { groupId: group.id, reconciledAt: range }, take, select: { forDate: true, countedKobo: true, handedOverKobo: true, reconciledAt: true, reconciledBy: true, reconcileNote: true } });
      for (const h of counts) {
        const diff = (h.countedKobo ?? 0n) - h.handedOverKobo;
        evs.push({ at: h.reconciledAt as Date, kind: 'cash', event: 'Cash counted', what: `Cash for ${h.forDate.toISOString().slice(0, 10)} was counted at ${formatNaira(h.countedKobo ?? 0n)} against ${formatNaira(h.handedOverKobo)} handed in${diff === 0n ? '' : ` (difference ${formatNaira(diff)})`}`, by: h.reconciledBy, reason: null });
      }
    }
    perGroup.push({ group, evs });
  }

  // Report exports are recorded against the association, with the circle (if one was chosen) in the entry.
  const exportEvents: Array<{ groupId: number | null; ev: Ev }> = exportsRows.map((e) => {
    const v = (e.newValues ?? {}) as { report?: string; format?: string; from?: string; to?: string; groupId?: number | null };
    return { groupId: typeof v.groupId === 'number' ? v.groupId : null, ev: { at: e.createdAt, kind: 'export', event: 'Report exported', what: `The ${(v.report ?? 'a').replace(/-/g, ' ')} report was exported as ${String(v.format ?? 'a file').toUpperCase()}${v.from && v.to ? ` for ${v.from} to ${v.to}` : ''}`, by: e.userId, reason: null } };
  });

  const total = perGroup.reduce((a, g) => a + g.evs.length, 0) + exportEvents.length;
  assertUnderCap(total);

  const who = await userNames(ctx.associationId, [...perGroup.flatMap((g) => g.evs.map((e) => e.by)), ...exportEvents.map((e) => e.ev.by)]);
  const rows: Row[] = [];
  for (const { group, evs } of perGroup) {
    const mine = [...evs, ...exportEvents.filter((e) => e.groupId === group.id).map((e) => e.ev)].sort((a, b) => b.at.getTime() - a.at.getTime());
    for (const e of mine) all.push({ group: group.name, ev: e });
    const n = (...kinds: Kind[]) => mine.filter((e) => kinds.includes(e.kind)).length;
    blocks.push({
      groupId: group.id,
      groupName: group.name,
      model: group.model,
      timezone: group.timezone,
      metrics: [
        count('events', 'Events', mine.length),
        count('confirmations', 'Payments confirmed', n('confirmation', 'selfConfirmation')),
        count('selfConfirmations', 'Confirmed by the person who recorded them', n('selfConfirmation'), 'Allowed only for a sole reconciler, with a note'),
        count('reversals', 'Payments reversed', n('reversal')),
        count('rejections', 'Payments turned down', n('rejection')),
        count('payoutEvents', 'Payout steps', n('payout')),
        count('payoutsUndone', 'Payouts cancelled, failed or reversed', n('payoutVoidOrReversal')),
        count('waivers', 'Late fees waived', n('waiver')),
        count('rulesChanged', 'Rule changes', n('rules')),
        count('orderChanges', 'Payout order changes', n('order')),
        count('caseEvents', 'Default case steps', n('caseEvent')),
        count('cashCounts', 'Cash counts', n('cash')),
      ],
    });
  }
  // Exports with no circle (all circles) are listed once, under "All circles".
  for (const e of exportEvents.filter((x) => x.groupId === null)) all.push({ group: 'All circles', ev: e.ev });

  all.sort((a, b) => b.ev.at.getTime() - a.ev.at.getTime());
  for (const { group, ev } of all) rows.push({ circle: group, at: ev.at.toISOString(), event: ev.event, what: ev.what, by: who(ev.by), reason: ev.reason });
  return { blocks, columns: AUDIT_COLUMNS, rows };
}
