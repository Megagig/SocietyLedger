/**
 * What every Ajo report shares (T10): the filters and what they mean, who may see which rows, the circles in play, names, the one place
 * that works out a payment's status, and the one query that adds up the group ledger.
 *
 * Definitions (printed under every report):
 *  - Money is counted on the day it was recorded in the group ledger, in the circle's own timezone.
 *  - Expected, outstanding and overdue are counted on the instalment's due date.
 *  - Only CONFIRMED, not-reversed money is received. A reported payment is never counted as received.
 */
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../../lib/prisma';
import { RuleError } from '../../finance/rule-error';
import { versionInForceOn } from '../ajo-risk';
import { businessDay, dayInZone, toCalendarDate } from '../ajo-schedule';
import { paymentStatus, spreadReported, type PaymentState } from '../ajo-status';
import type { AppliedFilters } from './report-types';

export const MAX_ROWS = 20_000;
export const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

export const iso = (d: Date): string => d.toISOString().slice(0, 10);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

export function assertUnderCap(rows: number): void {
  if (rows > MAX_ROWS) {
    throw new RuleError(`This report has more than ${MAX_ROWS.toLocaleString('en-NG')} rows. Narrow the dates or pick one circle.`, 400, 'REPORT_TOO_LARGE');
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------------------------------------------

const blank = (v: unknown) => (v === '' || v === null ? undefined : v);
const day = z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates look like 2026-10-31.').refine((v) => !Number.isNaN(date(v).getTime()), 'That date does not exist.').optional());
const idOf = z.preprocess(blank, z.coerce.number().int().positive().optional());

export const filterSchema = z.object({ groupId: idOf, from: day, to: day, membershipId: idOf, collectorUserId: idOf });
export type FilterInput = z.infer<typeof filterSchema>;

/** Who is asking. A collector who is not an officer sees only the people assigned to them. */
export interface ReportScope {
  userId: number;
  collectorOnly: boolean;
}

export interface GroupCtx {
  id: number;
  name: string;
  model: 'ROTATING_POT' | 'COLLECTOR_THRIFT';
  timezone: string;
  cutoffTime: string;
  contributionKobo: bigint;
  /** The first instant of `from` and the first instant after `to`, in this circle's own timezone. */
  startAt: Date;
  endAt: Date;
  /** The circle's business day today. */
  today: Date;
}

export interface PersonInfo {
  membershipId: number;
  groupId: number;
  memberId: number;
  name: string;
  phone: string | null;
  status: string;
}

export interface ReportContext {
  associationId: number;
  now: Date;
  scope: ReportScope;
  filters: AppliedFilters;
  /** Calendar dates (UTC midnight), inclusive. */
  fromDate: Date;
  toDate: Date;
  groups: GroupCtx[];
  /** Null means everyone in the circles; otherwise only these memberships (a member filter, or a collector's own people). */
  membershipIds: number[] | null;
  people: Map<number, PersonInfo>;
}

/** The instant a calendar date begins in a timezone. */
export function startOfDayIn(dateText: string, timeZone: string): Date {
  const [y, m, d] = dateText.split('-').map(Number);
  const wanted = Date.UTC(y, m - 1, d);
  let guess = wanted;
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    guess += wanted - shown;
  }
  return new Date(guess);
}

const nextDay = (dateText: string) => iso(new Date(date(dateText).getTime() + DAY_MS));

export async function buildContext(input: { associationId: number; query: unknown; scope: ReportScope; now?: Date }): Promise<ReportContext> {
  const now = input.now ?? new Date();
  const f = filterSchema.parse(input.query ?? {});

  const groupRows = await prisma.ajoGroup.findMany({
    where: { associationId: input.associationId, status: { not: 'DRAFT' }, ...(f.groupId ? { id: f.groupId } : {}) },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, model: true, timezone: true, cutoffTime: true, contributionKobo: true },
  });
  if (f.groupId && groupRows.length === 0) throw new RuleError('That circle was not found.', 404, 'GROUP_NOT_FOUND');

  // The default range is the running month in the circle's own timezone (the chosen circle's, else the first one's).
  const zone = groupRows[0]?.timezone ?? 'Africa/Lagos';
  const localToday = dayInZone(now, zone);
  const from = f.from ?? iso(new Date(Date.UTC(localToday.getUTCFullYear(), localToday.getUTCMonth(), 1)));
  const to = f.to ?? iso(new Date(Date.UTC(localToday.getUTCFullYear(), localToday.getUTCMonth() + 1, 0)));
  if (from > to) throw new RuleError('The start date is after the end date.', 400, 'INVALID_RANGE');
  if ((date(to).getTime() - date(from).getTime()) / DAY_MS + 1 > MAX_RANGE_DAYS) throw new RuleError('Pick a range of 12 months or less.', 400, 'RANGE_TOO_LONG');

  const groups: GroupCtx[] = groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    model: g.model,
    timezone: g.timezone,
    cutoffTime: g.cutoffTime,
    contributionKobo: g.contributionKobo,
    startAt: startOfDayIn(from, g.timezone),
    endAt: startOfDayIn(nextDay(to), g.timezone),
    today: businessDay(input.now ?? now, g.timezone, g.cutoffTime),
  }));

  // Who may be looked at. A collector who is not an officer sees only the people assigned to them in this range.
  let allowed: Set<number> | null = null;
  let collectorUserId = f.collectorUserId ?? null;
  if (input.scope.collectorOnly) {
    collectorUserId = input.scope.userId;
    const rows = await prisma.ajoCollectorAssignment.findMany({
      where: { associationId: input.associationId, collectorUserId: input.scope.userId, startsOn: { lte: date(to) }, OR: [{ endsOn: null }, { endsOn: { gte: date(from) } }], membership: { groupId: { in: groups.map((g) => g.id) } } },
      select: { membershipId: true },
    });
    allowed = new Set(rows.map((r) => r.membershipId));
  } else if (collectorUserId) {
    const rows = await prisma.ajoCollectorAssignment.findMany({
      where: { associationId: input.associationId, collectorUserId, startsOn: { lte: date(to) }, OR: [{ endsOn: null }, { endsOn: { gte: date(from) } }], membership: { groupId: { in: groups.map((g) => g.id) } } },
      select: { membershipId: true },
    });
    allowed = new Set(rows.map((r) => r.membershipId));
  }
  if (f.membershipId) allowed = allowed ? new Set([...allowed].filter((id) => id === f.membershipId)) : new Set([f.membershipId]);

  const memberships = await prisma.ajoMembership.findMany({
    where: { groupId: { in: groups.map((g) => g.id) }, ...(allowed ? { id: { in: [...allowed] } } : {}) },
    orderBy: { id: 'asc' },
    select: { id: true, groupId: true, memberId: true, status: true, member: { select: { firstName: true, lastName: true, phone: true } } },
  });
  if (f.membershipId && memberships.length === 0) throw new RuleError('That person is not in these circles.', 404, 'MEMBERSHIP_NOT_FOUND');
  const people = new Map<number, PersonInfo>(
    memberships.map((m) => [m.id, { membershipId: m.id, groupId: m.groupId, memberId: m.memberId, name: `${m.member.firstName} ${m.member.lastName}`.trim() || 'Member', phone: m.member.phone, status: m.status }]),
  );

  return {
    associationId: input.associationId,
    now,
    scope: input.scope,
    filters: { groupId: f.groupId ?? null, from, to, membershipId: f.membershipId ?? null, collectorUserId },
    fromDate: date(from),
    toDate: date(to),
    groups,
    membershipIds: allowed ? memberships.map((m) => m.id) : null,
    people,
  };
}

export const membersOf = (ctx: ReportContext, groupId: number): number[] => [...ctx.people.values()].filter((p) => p.groupId === groupId).map((p) => p.membershipId);

/** Officers and collectors are logins, not members; find the member record that carries their name. */
export async function userNames(associationId: number, userIds: Array<number | null | undefined>): Promise<(id: number | null | undefined) => string | null> {
  const ids = [...new Set(userIds.filter((u): u is number => typeof u === 'number'))];
  const rows = ids.length ? await prisma.member.findMany({ where: { associationId, userId: { in: ids } }, select: { userId: true, firstName: true, lastName: true } }) : [];
  const map = new Map(rows.filter((r) => r.userId !== null).map((r) => [r.userId as number, `${r.firstName} ${r.lastName}`.trim()]));
  return (id) => (typeof id === 'number' ? map.get(id) ?? 'An officer' : null);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The group ledger, added up
// ---------------------------------------------------------------------------------------------------------------------------------

export interface LedgerFigures {
  contributions: bigint;
  lateFees: bigint;
  payouts: bigint;
  collectorFees: bigint;
  adjustments: bigint;
}
export const emptyFigures = (): LedgerFigures => ({ contributions: 0n, lateFees: 0n, payouts: 0n, collectorFees: 0n, adjustments: 0n });

/** Money in at the group (contributions, late fees) minus money out (payouts, collector fee), plus adjustments. */
export const netOf = (f: LedgerFigures): bigint => f.contributions + f.lateFees + f.adjustments - f.payouts - f.collectorFees;

/**
 * The ledger for one circle between two instants (either may be open), as net figures: a reversal takes its original away, so a payment
 * that was undone counts for nothing. With `byMonth`, one entry per month in the circle's timezone.
 */
export async function ledgerFigures(input: { associationId: number; groupId: number; timeZone: string; from?: Date | null; to?: Date | null; membershipIds?: number[] | null; byMonth?: boolean }): Promise<Map<string, LedgerFigures>> {
  const where = Prisma.sql`e.association_id = ${input.associationId} AND e.group_id = ${input.groupId}
    ${input.from ? Prisma.sql`AND e.created_at >= ${input.from}` : Prisma.empty}
    ${input.to ? Prisma.sql`AND e.created_at < ${input.to}` : Prisma.empty}
    ${input.membershipIds ? (input.membershipIds.length ? Prisma.sql`AND e.membership_id IN (${Prisma.join(input.membershipIds)})` : Prisma.sql`AND FALSE`) : Prisma.empty}`;
  const monthExpr = input.byMonth ? Prisma.sql`to_char(x.at AT TIME ZONE ${input.timeZone}, 'YYYY-MM')` : Prisma.sql`'all'`;

  const rows = await prisma.$queryRaw<Array<{ month: string; bucket: string; net: bigint }>>(Prisma.sql`
    WITH x AS (
      SELECT e.amount_kobo AS amt, e.created_at AS at,
        CASE WHEN e.type::text = 'REVERSAL' THEN o.type::text ELSE e.type::text END AS t,
        CASE WHEN e.type::text = 'REVERSAL' THEN o.ref_type ELSE e.ref_type END AS r,
        CASE WHEN e.type::text = 'REVERSAL' THEN o.direction::text ELSE e.direction::text END AS d,
        CASE WHEN e.type::text = 'REVERSAL' THEN -1 ELSE 1 END AS s
      FROM ajo_ledger_entries e
      LEFT JOIN ajo_ledger_entries o ON o.id = e.reversal_of_id
      WHERE ${where}
    )
    SELECT ${monthExpr} AS month,
      CASE WHEN x.t = 'CONTRIBUTION' THEN 'contributions'
           WHEN x.t = 'FEE' AND x.r = 'late_fee' THEN 'lateFees'
           WHEN x.t = 'PAYOUT' THEN 'payouts'
           WHEN x.t = 'FEE' THEN 'collectorFees'
           ELSE 'adjustments' END AS bucket,
      SUM(x.s * x.amt * CASE WHEN x.t = 'ADJUSTMENT' AND x.d = 'DEBIT' THEN -1 ELSE 1 END)::bigint AS net
    FROM x
    GROUP BY 1, 2`);

  const out = new Map<string, LedgerFigures>();
  for (const r of rows) {
    const f = out.get(r.month) ?? emptyFigures();
    f[r.bucket as keyof LedgerFigures] = BigInt(r.net);
    out.set(r.month, f);
  }
  if (!input.byMonth && !out.has('all')) out.set('all', emptyFigures());
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Where each instalment stands
// ---------------------------------------------------------------------------------------------------------------------------------

export interface Standing {
  installmentId: number;
  membershipId: number;
  dueDate: Date;
  amountKobo: bigint;
  paidKobo: bigint;
  waived: boolean;
  reportedKobo: bigint;
  state: PaymentState;
  /** Falls inside the report's date range (earlier unpaid ones are loaded only so reported money is spread the way confirming it would). */
  inRange: boolean;
}

/**
 * The status of every instalment due in the report's range for a circle, worked out with `paymentStatus` (the same function the board
 * and the officer screens use), so a report can never call something paid that the board calls reported.
 */
export async function loadStandings(ctx: ReportContext, group: GroupCtx): Promise<Standing[]> {
  const ids = membersOf(ctx, group.id);
  if (ids.length === 0) return [];

  const inRangeCount = await prisma.ajoInstallment.count({ where: { membershipId: { in: ids }, dueDate: { gte: ctx.fromDate, lte: ctx.toDate } } });
  assertUnderCap(inRangeCount);

  const rows = await prisma.ajoInstallment.findMany({
    where: { membershipId: { in: ids }, dueDate: { lte: ctx.toDate }, OR: [{ dueDate: { gte: ctx.fromDate } }, { status: { in: ['DUE', 'PARTIAL', 'OVERDUE'] } }] },
    orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    select: { id: true, membershipId: true, dueDate: true, amountKobo: true, paidKobo: true, status: true },
  });

  const versions = await prisma.ajoGroupRuleVersion.findMany({ where: { groupId: group.id }, orderBy: { version: 'asc' }, select: { id: true, version: true, effectiveFrom: true, graceDays: true } });
  const graceOf = new Map(versions.map((v) => [v.id, v.graceDays]));
  const fallbackGrace = versions[0]?.graceDays ?? 3;
  const acceptances = await prisma.ajoRuleAcceptance.findMany({ where: { membershipId: { in: ids } }, select: { membershipId: true, ruleVersionId: true, acceptedAt: true } });
  const acceptedBy = new Map<number, Array<{ ruleVersionId: number; acceptedAt: Date }>>();
  for (const a of acceptances) acceptedBy.set(a.membershipId, [...(acceptedBy.get(a.membershipId) ?? []), { ruleVersionId: a.ruleVersionId, acceptedAt: a.acceptedAt }]);

  const waiting = await prisma.ajoContribution.groupBy({ by: ['membershipId'], where: { membershipId: { in: ids }, status: { in: ['REPORTED', 'CASH_RECEIVED'] } }, _sum: { amountKobo: true } });
  const waitingBy = new Map(waiting.map((w) => [w.membershipId, w._sum.amountKobo ?? 0n]));

  const disputes = await prisma.ajoDispute.findMany({ where: { membershipId: { in: ids }, status: 'OPEN' }, select: { installmentId: true, contribution: { select: { installmentId: true } } } });
  const disputed = new Set<number>();
  for (const d of disputes) {
    const target = d.installmentId ?? d.contribution?.installmentId ?? null;
    if (target !== null) disputed.add(target);
  }

  // Which day the confirmed payment that finished an instalment counted for, to tell "paid on time" from "paid late".
  const paidIds = rows.filter((r) => r.paidKobo >= r.amountKobo && r.status !== 'WAIVED').map((r) => r.id);
  const allocations = paidIds.length
    ? await prisma.ajoContributionAllocation.findMany({ where: { installmentId: { in: paidIds }, contribution: { status: 'CONFIRMED', reversedBy: { is: null } } }, select: { installmentId: true, contribution: { select: { businessDate: true, confirmedAt: true } } } })
    : [];
  const completed = new Map<number, Date>();
  for (const a of allocations) {
    if (a.installmentId === null) continue;
    const when = a.contribution.businessDate ?? (a.contribution.confirmedAt ? dayInZone(a.contribution.confirmedAt, group.timezone) : null);
    if (!when) continue;
    const have = completed.get(a.installmentId);
    if (!have || when.getTime() > have.getTime()) completed.set(a.installmentId, when);
  }

  const versionRefs = versions.map((v) => ({ id: v.id, version: v.version, effectiveFrom: v.effectiveFrom }));
  const out: Standing[] = [];
  for (const id of ids) {
    const mine = rows.filter((r) => r.membershipId === id);
    if (mine.length === 0) continue;
    const spread = spreadReported(mine.map((r) => ({ amountKobo: r.amountKobo, paidKobo: r.paidKobo, waived: r.status === 'WAIVED' })), waitingBy.get(id) ?? 0n);
    const nearest = mine.find((r) => r.dueDate.getTime() >= toCalendarDate(group.today).getTime())?.id ?? null;
    mine.forEach((r, n) => {
      const versionId = versionInForceOn(r.dueDate, versionRefs, acceptedBy.get(id) ?? []);
      const state = paymentStatus(
        { dueDate: r.dueDate, amountKobo: r.amountKobo, paidKobo: r.paidKobo, reportedKobo: spread[n] ?? 0n, waived: r.status === 'WAIVED', completedOn: r.paidKobo >= r.amountKobo ? completed.get(r.id) ?? null : null, disputed: disputed.has(r.id), graceDays: versionId !== null ? graceOf.get(versionId) ?? fallbackGrace : fallbackGrace, isCurrentRound: r.id === nearest },
        group.today,
      );
      out.push({ installmentId: r.id, membershipId: id, dueDate: r.dueDate, amountKobo: r.amountKobo, paidKobo: r.paidKobo, waived: r.status === 'WAIVED', reportedKobo: spread[n] ?? 0n, state, inRange: r.dueDate.getTime() >= ctx.fromDate.getTime() });
    });
  }
  return out.filter((s) => s.inRange);
}
