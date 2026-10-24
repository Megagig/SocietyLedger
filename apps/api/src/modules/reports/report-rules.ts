import { RuleError } from '../finance/rule-error';
import { OPEN_STATUSES } from '../finance/overdue-rules';

/**
 * The rules every report and every drill-down list shares, so a figure and the records behind it are worked out the same way and add up.
 * Pure: no database here.
 */

export type ReportPeriod = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'custom';

/** Nigeria has no daylight saving: Lagos is a fixed UTC+1, so "this month" starts at 00:00 there, not on the server's clock. */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** A custom range can't be longer than this (keeps a report quick and the figures meaningful). */
export const MAX_RANGE_DAYS = 366 * 5;

const startOfMonthLagos = (year: number, month: number) => new Date(Date.UTC(year, month, 1) - LAGOS_OFFSET_MS);
const endBefore = (next: Date) => new Date(next.getTime() - 1);

export type ReportRange = { startDate: Date; endDate: Date; label: string };

/** The start and end of a named period, as Lagos sees it. A custom period needs both dates, and the end can't be before the start. */
export function periodRange(period: ReportPeriod, custom: { startDate?: Date; endDate?: Date } = {}, now: Date = new Date()): ReportRange {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const year = lagos.getUTCFullYear();
  const month = lagos.getUTCMonth();

  if (period === 'custom') {
    const { startDate, endDate } = custom;
    if (!startDate || !endDate) throw new RuleError('Choose a start and an end date.', 400, 'RANGE_REQUIRED');
    if (endDate.getTime() < startDate.getTime()) throw new RuleError('The end date can’t be before the start date.', 400, 'RANGE_INVALID');
    if ((endDate.getTime() - startDate.getTime()) / 86_400_000 > MAX_RANGE_DAYS) throw new RuleError('Choose a range of five years or less.', 400, 'RANGE_TOO_LONG');
    return { startDate, endDate, label: `${dayLabel(startDate)} to ${dayLabel(endDate)}` };  }

  switch (period) {
    case 'last_month': {
      const start = startOfMonthLagos(year, month - 1);
      return { startDate: start, endDate: endBefore(startOfMonthLagos(year, month)), label: `${MONTHS[(month + 11) % 12]} ${month === 0 ? year - 1 : year}` };
    }
    case 'this_quarter': {
      const q = Math.floor(month / 3);
      return { startDate: startOfMonthLagos(year, q * 3), endDate: endBefore(startOfMonthLagos(year, q * 3 + 3)), label: `Q${q + 1} ${year}` };
    }
    case 'last_quarter': {
      const q = Math.floor(month / 3) - 1;
      const y = q < 0 ? year - 1 : year;
      const qq = q < 0 ? 3 : q;
      return { startDate: startOfMonthLagos(y, qq * 3), endDate: endBefore(startOfMonthLagos(y, qq * 3 + 3)), label: `Q${qq + 1} ${y}` };
    }
    case 'this_year':
      return { startDate: startOfMonthLagos(year, 0), endDate: endBefore(startOfMonthLagos(year + 1, 0)), label: `${year}` };
    case 'last_year':
      return { startDate: startOfMonthLagos(year - 1, 0), endDate: endBefore(startOfMonthLagos(year, 0)), label: `${year - 1}` };
    case 'this_month':
    default:
      return { startDate: startOfMonthLagos(year, month), endDate: endBefore(startOfMonthLagos(year, month + 1)), label: `${MONTHS[month]} ${year}` };
  }
}

/** A calendar month in Lagos, counted from this one: 0 is this month, 1 the month before, and so on. */
export function monthRange(monthsAgo: number, now: Date = new Date()): ReportRange & { shortLabel: string; year: number } {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const total = lagos.getUTCFullYear() * 12 + lagos.getUTCMonth() - monthsAgo;
  const year = Math.floor(total / 12);
  const month = total % 12;
  return {
    startDate: startOfMonthLagos(year, month),
    endDate: endBefore(startOfMonthLagos(year, month + 1)),
    label: `${MONTHS[month]} ${year}`,
    shortLabel: MONTHS[month]!.slice(0, 3),
    year,
  };
}

/** The period just before this one, the same length, for "compared with last time". */
export function previousRange(range: Pick<ReportRange, 'startDate' | 'endDate'>): { startDate: Date; endDate: Date } {
  const length = range.endDate.getTime() - range.startDate.getTime();
  const endDate = new Date(range.startDate.getTime() - 1);
  return { startDate: new Date(endDate.getTime() - length), endDate };
}

function dayLabel(d: Date): string {
  const lagos = new Date(d.getTime() + LAGOS_OFFSET_MS);
  return `${lagos.getUTCDate()} ${MONTHS[lagos.getUTCMonth()]!.slice(0, 3)} ${lagos.getUTCFullYear()}`;
}

/** "2026-10" for a moment, in Lagos. */
export function monthKey(d: Date): string {
  const lagos = new Date(d.getTime() + LAGOS_OFFSET_MS);
  return `${lagos.getUTCFullYear()}-${String(lagos.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthName(key: string): string {
  return MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
}

// ---------------------------------------------------------------- grouping over time

export type GroupBy = 'month' | 'quarter' | 'year';

/** The group a moment belongs to, as Lagos sees it: "2026-10", "2026-Q4" or "2026". */
export function groupKey(d: Date, groupBy: GroupBy): string {
  const key = monthKey(d);
  if (groupBy === 'month') return key;
  if (groupBy === 'year') return key.slice(0, 4);
  return `${key.slice(0, 4)}-Q${Math.floor((Number(key.slice(5, 7)) - 1) / 3) + 1}`;
}

export function groupLabel(key: string, groupBy: GroupBy): string {
  if (groupBy === 'month') return monthName(key);
  if (groupBy === 'year') return key;
  return key.slice(5);
}

/** The first and last moment of a group, so a row can open the charges raised in it. */
export function groupRange(key: string, groupBy: GroupBy): { startDate: Date; endDate: Date } {
  const year = Number(key.slice(0, 4));
  if (groupBy === 'year') return { startDate: startOfMonthLagos(year, 0), endDate: endBefore(startOfMonthLagos(year + 1, 0)) };
  if (groupBy === 'quarter') {
    const q = Number(key.slice(6)) - 1;
    return { startDate: startOfMonthLagos(year, q * 3), endDate: endBefore(startOfMonthLagos(year, q * 3 + 3)) };
  }
  const m = Number(key.slice(5, 7)) - 1;
  return { startDate: startOfMonthLagos(year, m), endDate: endBefore(startOfMonthLagos(year, m + 1)) };
}

// ---------------------------------------------------------------- which charges count

/**
 * A charge counts as money the association expects only if it was not voided (a replaced or mistaken charge) and not waived (forgiven).
 * Without this, a voided or forgiven charge would stay "owed" in every report for ever.
 */
export const COUNTED_CHARGE = { isVoided: false, status: { not: 'waived' } } as const;

/** Charges still owing something: counted, and not yet paid in full. */
export const OWING_CHARGE = { isVoided: false, status: { in: [...OPEN_STATUSES] } } as const;

// ---------------------------------------------------------------- aging

export type AgingBucketKey = 'notYetDue' | 'current' | 'days31to60' | 'days61to90' | 'over90';
export const AGING_BUCKETS: Array<{ key: AgingBucketKey; range: string; minDays: number; maxDays: number | null }> = [
  { key: 'notYetDue', range: 'Not yet due', minDays: 0, maxDays: 0 },
  { key: 'current', range: '1-30 days overdue', minDays: 1, maxDays: 30 },
  { key: 'days31to60', range: '31-60 days overdue', minDays: 31, maxDays: 60 },
  { key: 'days61to90', range: '61-90 days overdue', minDays: 61, maxDays: 90 },
  { key: 'over90', range: '90+ days overdue', minDays: 91, maxDays: null },
];

const DAY_MS = 86_400_000;

/** How many whole days a charge is past its due date. A charge with no due date, or not yet due, is 0: it is not overdue. */
export function daysOverdue(dueDate: Date | null, asOf: Date): number {
  if (!dueDate || dueDate.getTime() >= asOf.getTime()) return 0;
  return Math.max(1, Math.floor((asOf.getTime() - dueDate.getTime()) / DAY_MS));
}

/** Which bucket a charge falls in. Same rule as the overdue list: overdue means the due date has passed. */
export function agingBucketOf(dueDate: Date | null, asOf: Date): AgingBucketKey {
  const days = daysOverdue(dueDate, asOf);
  if (days === 0) return 'notYetDue';
  if (days <= 30) return 'current';
  if (days <= 60) return 'days31to60';
  if (days <= 90) return 'days61to90';
  return 'over90';
}

/**
 * The charges behind a bucket, as a database filter. It is the exact opposite of agingBucketOf, so the list under a bucket's figure
 * holds the same charges that were added up to make it.
 */
export function agingWhere(key: AgingBucketKey, asOf: Date) {
  const b = AGING_BUCKETS.find((x) => x.key === key);
  if (!b) throw new RuleError('Unknown aging bucket.', 400, 'BAD_BUCKET');
  if (key === 'notYetDue') return { OR: [{ dueDate: null }, { dueDate: { gte: asOf } }] };
  // A charge due a moment ago is 1 day overdue (never 0), so the first bucket reaches right up to now (exclusive).
  const newest = b.minDays <= 1 ? { lt: asOf } : { lte: new Date(asOf.getTime() - b.minDays * DAY_MS) };
  const oldest = b.maxDays === null ? {} : { gt: new Date(asOf.getTime() - (b.maxDays + 1) * DAY_MS) };
  return { dueDate: { ...newest, ...oldest } };
}

// ---------------------------------------------------------------- numbers

export const percent = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
