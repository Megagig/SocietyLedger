/**
 * The Ajo schedule engine (T3.4): pure functions, no database. Given a group's settings it answers "which dates, and how much", and given
 * what already exists it answers "what must be added or removed", never touching an installment that has money against it.
 *
 * Dates are calendar dates with no time of day, held as UTC midnight (that is how `@db.Date` columns come back). A "business day" is the
 * calendar date in the group's own timezone, moved to the next day when the payment arrives after the group's cutoff time.
 */

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CUSTOM';
export type IntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS';
/** A group's own step, used only when its frequency is CUSTOM ("every 2 weeks"). Ignored for every other frequency. */
export interface CustomInterval {
  intervalCount?: number | null;
  intervalUnit?: IntervalUnit | null;
}

export const FREQUENCIES: readonly Frequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'CUSTOM'];
export const MAX_INTERVAL_COUNT = 60;

/** The step as a count of days or months: every frequency is one of these. Calendar months are counted from the start day, never as 30 days. */
export function stepOf(frequency: Frequency, custom: CustomInterval = {}): { count: number; unit: 'DAYS' | 'MONTHS' } {
  switch (frequency) {
    case 'DAILY': return { count: 1, unit: 'DAYS' };
    case 'WEEKLY': return { count: 7, unit: 'DAYS' };
    case 'MONTHLY': return { count: 1, unit: 'MONTHS' };
    case 'QUARTERLY': return { count: 3, unit: 'MONTHS' };
    case 'ANNUALLY': return { count: 12, unit: 'MONTHS' };
    case 'CUSTOM': {
      const n = custom.intervalCount ?? 0;
      if (!Number.isInteger(n) || n < 1 || n > MAX_INTERVAL_COUNT || !custom.intervalUnit) throw new RangeError('A custom schedule needs a whole number of days, weeks or months.');
      return custom.intervalUnit === 'WEEKS' ? { count: n * 7, unit: 'DAYS' } : { count: n, unit: custom.intervalUnit };
    }
  }
}

/** About how many days one period lasts (a month as 30), for judging how often a group asks for money. */
export const periodDays = (frequency: Frequency, custom: CustomInterval = {}): number => { const s = stepOf(frequency, custom); return s.unit === 'DAYS' ? s.count : s.count * 30; };

/** The cadence in plain words, for screens and messages: "every day", "every 2 weeks", "every 3 months". */
export function describeCadence(frequency: Frequency, custom: CustomInterval = {}): string {
  switch (frequency) {
    case 'DAILY': return 'every day';
    case 'WEEKLY': return 'every week';
    case 'MONTHLY': return 'every month';
    case 'QUARTERLY': return 'every 3 months';
    case 'ANNUALLY': return 'every year';
    case 'CUSTOM': {
      const n = custom.intervalCount ?? 0;
      const unit = (custom.intervalUnit ?? 'DAYS').toLowerCase();
      return n === 1 ? `every ${unit.replace(/s$/, '')}` : `every ${n} ${unit}`;
    }
  }
}
export type GroupModel = 'COLLECTOR_THRIFT' | 'ROTATING_POT';

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight of a given calendar date. */
export function calendarDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

/** Strip any time of day: the calendar date a Date falls on in UTC. */
export function toCalendarDate(date: Date): Date {
  return calendarDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

const daysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/**
 * The date `n` periods after `start`. Monthly dates are always counted from the start date's own day of the month and clamped to the
 * month's last day, so 31 Jan → 28 Feb → 31 Mar. Each date comes from the anchor, never from the previous date (which would drift to the 28th).
 */
export function addPeriods(start: Date, frequency: Frequency, n: number, custom: CustomInterval = {}): Date {
  const base = toCalendarDate(start);
  const step = stepOf(frequency, custom);
  if (step.unit === 'DAYS') return new Date(base.getTime() + n * step.count * DAY_MS);
  const totalMonths = base.getUTCFullYear() * 12 + base.getUTCMonth() + n * step.count;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths - year * 12;
  return calendarDate(year, month, Math.min(base.getUTCDate(), daysInMonth(year, month)));
}

/** The first `count` due dates, starting on `start`. */
export function dueDates(start: Date, frequency: Frequency, count: number, custom: CustomInterval = {}): Date[] {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('A schedule needs at least one period.');
  return Array.from({ length: count }, (_, i) => addPeriods(start, frequency, i, custom));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Timezone and cutoff
// ---------------------------------------------------------------------------------------------------------------------------------

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const CUTOFF = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isValidCutoff = (cutoff: string): boolean => CUTOFF.test(cutoff);

function zoneParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** The calendar date it is, right now, in the group's timezone. */
export function dayInZone(instant: Date, timeZone: string): Date {
  const p = zoneParts(instant, timeZone);
  return calendarDate(p.year, p.month - 1, p.day);
}

/**
 * The date a payment counts for: the calendar date in the group's timezone, or the next day if it arrived after the cutoff time.
 * A payment exactly at the cutoff still counts for that day.
 */
export function businessDay(instant: Date, timeZone: string, cutoff: string): Date {
  if (!isValidCutoff(cutoff)) throw new RangeError('The cutoff time must look like 18:00.');
  const p = zoneParts(instant, timeZone);
  const [h, m] = cutoff.split(':').map(Number);
  const day = calendarDate(p.year, p.month - 1, p.day);
  const afterCutoff = p.hour * 60 + p.minute > h * 60 + m;
  return afterCutoff ? new Date(day.getTime() + DAY_MS) : day;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The shape of a group's schedule
// ---------------------------------------------------------------------------------------------------------------------------------

export interface GroupShape extends CustomInterval {
  model: GroupModel;
  frequency: Frequency;
  startDate: Date;
  /** Collector thrift: periods in the cycle. */
  cycleLength: number | null;
  /** Rotating pot: rounds (the total number of shares). */
  rounds: number | null;
}

export interface GroupDates {
  dates: Date[];
  endsOn: Date;
}

/** Every due date for the whole group, and the last one. The count comes from the cycle (collector thrift) or the rounds (rotating pot). */
export function groupDates(shape: GroupShape): GroupDates {
  const count = shape.model === 'COLLECTOR_THRIFT' ? shape.cycleLength : shape.rounds;
  if (!count) throw new RangeError(shape.model === 'COLLECTOR_THRIFT' ? 'A collector-thrift group needs a cycle length.' : 'A rotating pot needs its rounds set.');
  const dates = dueDates(shape.startDate, shape.frequency, count, shape);
  return { dates, endsOn: dates[dates.length - 1] };
}

/** What one person pays on each due date. In a rotating pot a person with N shares pays N times the contribution in every round. */
export function installmentAmount(model: GroupModel, contributionKobo: bigint, shares: number): bigint {
  if (model === 'COLLECTOR_THRIFT') return contributionKobo;
  if (!Number.isInteger(shares) || shares < 1) throw new RangeError('Shares must be a whole number of at least 1.');
  return contributionKobo * BigInt(shares);
}

export interface WantedInstallment {
  dueDate: Date;
  amountKobo: bigint;
}

/**
 * What one membership should owe. A late joiner (collector thrift) owes only from `from` onwards, so the cycle still ends where it ends
 * for everyone. Dates before `from` are simply not wanted; they are never back-filled with arrears.
 */
export function wantedInstallments(input: { dates: Date[]; amountKobo: bigint; from?: Date | null }): WantedInstallment[] {
  const from = input.from ? toCalendarDate(input.from).getTime() : null;
  return input.dates.filter((d) => from === null || d.getTime() >= from).map((dueDate) => ({ dueDate, amountKobo: input.amountKobo }));
}

export interface ExistingInstallment {
  id: number;
  dueDate: Date;
  amountKobo: bigint;
  paidKobo: bigint;
  /** Any contribution row (reported, received or confirmed) points at this installment. */
  hasContributions: boolean;
}

export interface ScheduleDiff {
  toCreate: WantedInstallment[];
  /** Ids that are safe to delete: unpaid, untouched by any contribution. */
  toDelete: number[];
  /** Unpaid, untouched installments whose amount no longer matches. */
  toUpdate: Array<{ id: number; amountKobo: bigint }>;
}

const untouched = (e: ExistingInstallment) => e.paidKobo === 0n && !e.hasContributions;

/**
 * Compare what should exist with what does. An installment with any money or any contribution against it is never deleted or changed, so
 * regenerating can neither duplicate a row nor move a paid one. Running it again on its own result gives an empty diff.
 */
export function diffSchedule(wanted: WantedInstallment[], existing: ExistingInstallment[]): ScheduleDiff {
  const key = (d: Date) => toCalendarDate(d).getTime();
  const have = new Map(existing.map((e) => [key(e.dueDate), e]));
  const want = new Map(wanted.map((w) => [key(w.dueDate), w]));

  const toCreate = wanted.filter((w) => !have.has(key(w.dueDate)));
  const toDelete = existing.filter((e) => !want.has(key(e.dueDate)) && untouched(e)).map((e) => e.id);
  const toUpdate = existing
    .filter((e) => want.has(key(e.dueDate)) && untouched(e) && want.get(key(e.dueDate))!.amountKobo !== e.amountKobo)
    .map((e) => ({ id: e.id, amountKobo: want.get(key(e.dueDate))!.amountKobo }));
  return { toCreate, toDelete, toUpdate };
}
