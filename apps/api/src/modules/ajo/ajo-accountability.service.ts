/**
 * Officer and admin accountability (spec §16.7): what officers answer to, beyond what members see on the circle board.
 *
 *  - Separation of duties: for every payout, who prepared it, who approved it and who recorded it as paid. Where one person did the
 *    preparing and the approving (a single-admin group), it is flagged.
 *  - Confirmation backlog: payments waiting for an officer to confirm them, by age, against the 48-hour target members see.
 *  - Cash reconciliation (collector thrift): per collector per day, what was expected, collected, handed in and counted.
 *  - Exceptions: reversals, waivers, emergency position changes, rule changes, and voided or reversed payouts, each with its reason and
 *    who did it.
 *
 * Officers see real full names here. Everything is read from the records the rest of Ajo already keeps; nothing is written.
 */
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { formatNaira } from './ajo-collections';
import { CONFIRM_TARGET_HOURS } from './ajo-board.service';
import { csvCell } from './ajo-savings-statement';

const HOUR_MS = 3_600_000;
const k = (kobo: bigint) => kobo.toString();
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function namesOf(associationId: number, userIds: Array<number | null | undefined>): Promise<(id: number | null | undefined) => string | null> {
  const ids = [...new Set(userIds.filter((u): u is number => typeof u === 'number'))];
  const rows = ids.length ? await prisma.member.findMany({ where: { associationId, userId: { in: ids } }, select: { userId: true, firstName: true, lastName: true } }) : [];
  const map = new Map(rows.filter((r) => r.userId !== null).map((r) => [r.userId as number, `${r.firstName} ${r.lastName}`.trim()]));
  return (id) => (typeof id === 'number' ? map.get(id) ?? 'An officer' : null);
}

export const BACKLOG_BUCKETS = [
  { key: 'UNDER_24H', label: 'Under 24 hours', fromHours: 0 },
  { key: 'H24_TO_48', label: '24 to 48 hours', fromHours: 24 },
  { key: 'OVER_TARGET', label: 'Past the 48-hour target', fromHours: CONFIRM_TARGET_HOURS },
  { key: 'OVER_7D', label: 'Over 7 days', fromHours: 24 * 7 },
] as const;

/** Which age bucket a waiting payment is in. The last bucket that starts at or before its age. */
export function backlogBucket(ageHours: number): (typeof BACKLOG_BUCKETS)[number]['key'] {
  let found: (typeof BACKLOG_BUCKETS)[number]['key'] = BACKLOG_BUCKETS[0].key;
  for (const b of BACKLOG_BUCKETS) if (ageHours >= b.fromHours) found = b.key;
  return found;
}

export async function getAccountability(input: { associationId: number; groupId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const group = await prisma.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId } });
  if (!group) throw new RuleError('That circle was not found.', 404, 'GROUP_NOT_FOUND');

  const [payouts, waiting, handovers, reversals, waivers, orderEvents, versions] = await Promise.all([
    prisma.ajoPayout.findMany({ where: { groupId: group.id, status: { in: ['PREPARED', 'APPROVED', 'PAID', 'VOID', 'REVERSED'] } }, orderBy: { id: 'desc' }, take: 100, include: { membership: { select: { member: { select: { firstName: true, lastName: true } } } } } }),
    prisma.ajoContribution.findMany({ where: { groupId: group.id, status: { in: ['REPORTED', 'CASH_RECEIVED'] }, reversalOfId: null }, orderBy: { createdAt: 'asc' }, take: 500, include: { membership: { select: { member: { select: { firstName: true, lastName: true } } } } } }),
    group.model === 'COLLECTOR_THRIFT' ? prisma.ajoCashHandover.findMany({ where: { groupId: group.id }, orderBy: [{ forDate: 'desc' }, { id: 'desc' }], take: 60 }) : Promise.resolve([]),
    prisma.ajoContribution.findMany({ where: { groupId: group.id, status: 'REVERSED' }, orderBy: { createdAt: 'desc' }, take: 50, include: { reversalOf: { select: { amountKobo: true, membership: { select: { member: { select: { firstName: true, lastName: true } } } } } } } }),
    prisma.ajoLateFeeAssessment.findMany({ where: { status: 'WAIVED', installment: { membership: { groupId: group.id } } }, orderBy: { waivedAt: 'desc' }, take: 50, include: { installment: { select: { membership: { select: { member: { select: { firstName: true, lastName: true } } } } } } } }),
    prisma.ajoPayoutOrderEvent.findMany({ where: { groupId: group.id, type: { in: ['SWAP', 'EXCEPTION'] } }, orderBy: { id: 'desc' }, take: 50 }),
    prisma.ajoGroupRuleVersion.findMany({ where: { groupId: group.id, version: { gt: 1 } }, orderBy: { version: 'desc' }, take: 20 }),
  ]);

  const who = await namesOf(input.associationId, [
    ...payouts.flatMap((p) => [p.preparedBy, p.approvedBy, p.paidRecordedBy, p.voidedBy, p.reversedBy]),
    ...handovers.flatMap((h) => [h.collectorUserId, h.reconciledBy]),
    ...reversals.map((r) => r.recordedBy ?? r.confirmedBy),
    ...waivers.map((w) => w.waivedBy),
    ...orderEvents.flatMap((e) => [e.requestedBy, e.approvedBy]),
    ...versions.map((v) => v.createdBy),
  ]);
  const nameOf = (m: { member: { firstName: string; lastName: string } }) => `${m.member.firstName} ${m.member.lastName}`.trim();

  // ---- separation of duties
  const separation = payouts
    .filter((p) => p.status !== 'VOID')
    .map((p) => {
      const sameHands = p.approvedBy !== null && p.approvedBy === p.preparedBy;
      return {
        id: p.id,
        recipient: nameOf(p.membership),
        round: p.round,
        cycleNo: p.round === null ? p.cycleNo : null,
        netKobo: k(p.netKobo),
        status: p.status,
        preparedBy: who(p.preparedBy),
        approvedBy: who(p.approvedBy),
        recordedPaidBy: who(p.paidRecordedBy),
        preparedAt: p.preparedAt,
        approvedAt: p.approvedAt,
        paidAt: p.paidAt,
        /** One person prepared and approved it. Allowed for a group with a single admin, and confirmed with a note, but shown. */
        singleAdminApproval: sameHands || p.selfApprovalConfirmed,
        sameRecorder: p.paidRecordedBy !== null && (p.paidRecordedBy === p.preparedBy || p.paidRecordedBy === p.approvedBy),
      };
    });

  // ---- confirmation backlog
  const aged = waiting.map((c) => ({ c, ageHours: Math.max(0, Math.floor((now.getTime() - c.createdAt.getTime()) / HOUR_MS)) }));
  const buckets = BACKLOG_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: aged.filter((a) => backlogBucket(a.ageHours) === b.key).length }));
  const backlog = {
    total: waiting.length,
    targetHours: CONFIRM_TARGET_HOURS,
    pastTarget: aged.filter((a) => a.ageHours >= CONFIRM_TARGET_HOURS).length,
    oldestHours: aged.length ? Math.max(...aged.map((a) => a.ageHours)) : null,
    buckets,
    oldest: aged.slice(0, 20).map(({ c, ageHours }) => ({ id: c.id, member: nameOf(c.membership), amountKobo: k(c.amountKobo), method: c.method, status: c.status, ageHours, receivedAt: c.receivedAt })),
  };

  // ---- cash, per collector per day
  const cash = handovers.map((h) => ({
    id: h.id,
    date: iso(h.forDate),
    collector: who(h.collectorUserId),
    expectedKobo: k(h.expectedKobo),
    collectedKobo: k(h.collectedKobo),
    handedOverKobo: k(h.handedOverKobo),
    countedKobo: h.countedKobo === null ? null : k(h.countedKobo),
    /** Handed over less collected (the collector's own difference); and, once counted, counted less handed over. */
    differenceKobo: k(h.differenceKobo),
    countDifferenceKobo: h.countedKobo === null ? null : k(h.countedKobo - h.handedOverKobo),
    reconciled: h.reconciledAt !== null,
    reconciledBy: who(h.reconciledBy),
    reconciledAt: h.reconciledAt,
  }));

  // ---- exceptions, newest first
  type Exception = { at: Date; kind: 'REVERSAL' | 'WAIVER' | 'ORDER_CHANGE' | 'RULES' | 'PAYOUT_VOIDED' | 'PAYOUT_REVERSED'; text: string; reason: string | null; by: string | null };
  const exceptions: Exception[] = [
    ...reversals.map((r): Exception => ({ at: r.createdAt, kind: 'REVERSAL', text: `A payment of ${formatNaira(r.reversalOf?.amountKobo ?? r.amountKobo)}${r.reversalOf ? ` from ${nameOf(r.reversalOf.membership)}` : ''} was reversed`, reason: r.reason, by: who(r.recordedBy ?? r.confirmedBy) })),
    ...waivers.map((w): Exception => ({ at: w.waivedAt ?? w.createdAt, kind: 'WAIVER', text: `A late fee of ${formatNaira(w.feeKobo)} for ${nameOf(w.installment.membership)} was waived`, reason: w.waivedReason, by: who(w.waivedBy) })),
    ...orderEvents.map((e): Exception => {
      const d = e.detail as { a?: { from: number }; b?: { from: number }; from?: number; to?: number };
      return { at: e.createdAt, kind: 'ORDER_CHANGE', text: e.type === 'SWAP' ? `Payout positions ${d.a?.from} and ${d.b?.from} were swapped` : `An emergency exception moved a member from position ${d.from} to ${d.to}`, reason: e.reason, by: who(e.approvedBy ?? e.requestedBy) };
    }),
    ...versions.map((v): Exception => ({ at: v.createdAt, kind: 'RULES', text: `Rules version ${v.version} was published, applying from ${iso(v.effectiveFrom)}`, reason: null, by: who(v.createdBy) })),
    ...payouts.filter((p) => p.status === 'VOID' && p.voidedAt).map((p): Exception => ({ at: p.voidedAt as Date, kind: 'PAYOUT_VOIDED', text: `A payout of ${formatNaira(p.netKobo)} to ${nameOf(p.membership)} was voided`, reason: p.voidReason, by: who(p.voidedBy) })),
    ...payouts.filter((p) => p.status === 'REVERSED' && p.reversedAt).map((p): Exception => ({ at: p.reversedAt as Date, kind: 'PAYOUT_REVERSED', text: `A payout of ${formatNaira(p.netKobo)} to ${nameOf(p.membership)} was reversed after it was recorded as paid`, reason: p.reverseReason, by: who(p.reversedBy) })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 100);

  return {
    groupId: group.id,
    groupName: group.name,
    model: group.model,
    timezone: group.timezone,
    separation: { payouts: separation, flaggedCount: separation.filter((s) => s.singleAdminApproval || s.sameRecorder).length },
    backlog,
    cash: group.model === 'COLLECTOR_THRIFT' ? cash : null,
    exceptions: exceptions.map((e) => ({ at: e.at, kind: e.kind, text: e.text, reason: e.reason, by: e.by })),
  };
}

type Accountability = Awaited<ReturnType<typeof getAccountability>>;

/** The accountability report as a CSV for the group's own meetings or auditors. Cells cannot run as spreadsheet formulas. */
export function accountabilityCsv(a: Accountability, now: Date): string {
  const lines: string[] = [];
  const row = (...cols: Array<string | number | null | undefined>) => lines.push(cols.map(csvCell).join(','));
  row('Accountability report', a.groupName);
  row('Generated', now.toISOString());
  lines.push('');
  row('Payouts: who prepared, approved and recorded', 'Flagged');
  row('Recipient', 'Round or cycle', 'Amount', 'Status', 'Prepared by', 'Approved by', 'Recorded as paid by', 'One person prepared and approved', 'Recorder also prepared or approved');
  for (const p of a.separation.payouts) row(p.recipient, p.round !== null ? `Round ${p.round}` : `Cycle ${p.cycleNo}`, formatNaira(BigInt(p.netKobo)), p.status, p.preparedBy, p.approvedBy, p.recordedPaidBy, p.singleAdminApproval ? 'Yes' : 'No', p.sameRecorder ? 'Yes' : 'No');
  lines.push('');
  row('Payments waiting for confirmation', a.backlog.total, `Target ${a.backlog.targetHours} hours`, `Past target ${a.backlog.pastTarget}`);
  for (const b of a.backlog.buckets) row(b.label, b.count);
  row('Member', 'Amount', 'Method', 'Waiting (hours)');
  for (const w of a.backlog.oldest) row(w.member, formatNaira(BigInt(w.amountKobo)), w.method, w.ageHours);
  if (a.cash) {
    lines.push('');
    row('Cash by collector and day');
    row('Date', 'Collector', 'Expected', 'Collected', 'Handed in', 'Counted', 'Difference', 'Reconciled by');
    for (const c of a.cash) row(c.date, c.collector, formatNaira(BigInt(c.expectedKobo)), formatNaira(BigInt(c.collectedKobo)), formatNaira(BigInt(c.handedOverKobo)), c.countedKobo === null ? 'Not counted' : formatNaira(BigInt(c.countedKobo)), formatNaira(BigInt(c.differenceKobo)), c.reconciledBy);
  }
  lines.push('');
  row('Exceptions');
  row('When', 'What', 'Reason', 'By');
  for (const e of a.exceptions) row(e.at.toISOString(), e.text, e.reason, e.by);
  return `﻿${lines.join('\r\n')}\r\n`;
}
