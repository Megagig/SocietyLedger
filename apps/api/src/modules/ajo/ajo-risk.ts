/**
 * The pure rules of defaults and risk (T6): no database and no clock. Everything that decides a date, a fee, a reminder, a score or a plan
 * lives here so it can be tested without a database; the services only gather the facts and write the results.
 *
 * All dates are calendar dates (UTC midnight, as a date column returns them) in the group's own timezone.
 */
import { formatNaira } from './ajo-collections';
import { roundHalfUp } from './ajo-payout-calc';
import { addPeriods, periodDays, toCalendarDate, type CustomInterval, type Frequency } from './ajo-schedule';

const DAY_MS = 24 * 60 * 60 * 1000;
export const addDays = (date: Date, n: number): Date => new Date(toCalendarDate(date).getTime() + n * DAY_MS);
const iso = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------------------------------------------------------------
// Overdue, grace, and when a fee may be assessed
// ---------------------------------------------------------------------------------------------------------------------------------

/** A late fee that has been assessed is shown to the member first; it can only become payable after this notice window. */
export const FEE_NOTICE_HOURS = 48;

/** Overdue once the due date has passed. `today` is the group's business day. */
export const isOverdue = (dueDate: Date, today: Date): boolean => toCalendarDate(today).getTime() > toCalendarDate(dueDate).getTime();

/** The last day of grace: the due date plus the group's grace days. */
export const graceEndsOn = (dueDate: Date, graceDays: number): Date => addDays(dueDate, graceDays);

/**
 * The first day a late fee may be assessed: the day after grace ends, or one full day after the last verification or dispute about this
 * member ended, whichever is later. Counting the days a check lasted would need a start and end for every check; this is simple, and a
 * member whose claim was turned down always gets a clear day to pay.
 */
export function feeEligibleOn(input: { dueDate: Date; graceDays: number; lastCheckEndedOn?: Date | null }): Date {
  const afterGrace = addDays(graceEndsOn(input.dueDate, input.graceDays), 1);
  if (!input.lastCheckEndedOn) return afterGrace;
  const afterCheck = addDays(input.lastCheckEndedOn, 1);
  return afterCheck.getTime() > afterGrace.getTime() ? afterCheck : afterGrace;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Which rule version applies
// ---------------------------------------------------------------------------------------------------------------------------------

export interface VersionRef {
  id: number;
  version: number;
  effectiveFrom: Date;
}

export interface AcceptanceRef {
  ruleVersionId: number;
  acceptedAt: Date;
}

/**
 * The rule version that bound this member on an instalment's due date: the highest version they had accepted by the end of that day, and
 * that was already in effect then. A fee is never worked out from a version they accepted later, or never accepted: null means no fee.
 */
export function versionInForceOn(dueDate: Date, versions: VersionRef[], acceptances: AcceptanceRef[]): number | null {
  const endOfDay = addDays(dueDate, 1).getTime() - 1;
  const byId = new Map(versions.map((v) => [v.id, v]));
  let best: VersionRef | null = null;
  for (const a of acceptances) {
    const v = byId.get(a.ruleVersionId);
    if (!v) continue;
    if (a.acceptedAt.getTime() > endOfDay || v.effectiveFrom.getTime() > endOfDay) continue;
    if (!best || v.version > best.version) best = v;
  }
  return best?.id ?? null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The late fee
// ---------------------------------------------------------------------------------------------------------------------------------

export interface LateFeeRule {
  lateFeeType: 'NONE' | 'FIXED' | 'PERCENT';
  /** Kobo for FIXED, basis points for PERCENT. */
  lateFeeValue: bigint;
  /** Most that one missed instalment can cost, in kobo. */
  lateFeeCapKobo: bigint | null;
}

export interface LateFee {
  feeKobo: bigint;
  capApplied: boolean;
  rawKobo: bigint;
  /** Stored with the assessment and shown to the member. */
  calculation: { type: string; value: string; basisKobo: string; rawKobo: string; capKobo: string | null };
  text: string;
}

const percent = (bps: bigint) => `${Number(bps) / 100}%`;

/** The fee for one missed instalment. The basis is the instalment's scheduled amount. Null when the rules have no late fee. */
export function lateFeeFor(rule: LateFeeRule, installmentKobo: bigint): LateFee | null {
  if (rule.lateFeeType === 'NONE' || rule.lateFeeValue <= 0n || installmentKobo <= 0n) return null;
  const rawKobo = rule.lateFeeType === 'FIXED' ? rule.lateFeeValue : roundHalfUp(installmentKobo * rule.lateFeeValue, 10_000n);
  const capApplied = rule.lateFeeCapKobo !== null && rawKobo > rule.lateFeeCapKobo;
  const feeKobo = capApplied ? (rule.lateFeeCapKobo as bigint) : rawKobo;
  if (feeKobo <= 0n) return null;
  const how = rule.lateFeeType === 'FIXED' ? `a fixed late fee of ${formatNaira(rule.lateFeeValue)}` : `a late fee of ${percent(rule.lateFeeValue)} of the ${formatNaira(installmentKobo)} contribution, which is ${formatNaira(rawKobo)}`;
  return {
    feeKobo,
    capApplied,
    rawKobo,
    calculation: { type: rule.lateFeeType, value: rule.lateFeeValue.toString(), basisKobo: installmentKobo.toString(), rawKobo: rawKobo.toString(), capKobo: rule.lateFeeCapKobo?.toString() ?? null },
    text: `Your group’s rules say ${how}${capApplied ? `, held to the group’s limit of ${formatNaira(rule.lateFeeCapKobo as bigint)} for each missed contribution` : ''}. Late fee: ${formatNaira(feeKobo)}.`,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------------------------------------------------------------

export type ReminderKind = 'UPCOMING' | 'OVERDUE' | 'GRACE_ENDING';

export interface ReminderInstallment {
  id: number;
  dueDate: Date;
  remainingKobo: bigint;
}

export interface PlannedReminder {
  kind: ReminderKind;
  installmentIds: number[];
  /** Unique per reminded item: a second run finds it and sends nothing. */
  dedupeKey: string;
}

/** "2027-W09": the ISO year and week, so a daily group's once-a-week reminder is keyed to a week. */
export function isoWeekKey(date: Date): string {
  const d = new Date(toCalendarDate(date).getTime());
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** An overdue instalment older than this (past its grace) is no longer chased by reminders: it is for the officers now. */
const REMINDER_WINDOW_AFTER_GRACE_DAYS = 7;

/**
 * What to remind one member about today.
 *   weekly and monthly groups: the day before it is due, the day after, and (only when the rules have a late fee) the last day of grace;
 *   daily groups: no "upcoming", and a single overdue message at most once a week, because the collector calls every day.
 * Paid instalments are never reminded about. Whether to remind at all (verification pending, a dispute, reminders off) is decided by the caller.
 */
export function planReminders(input: CustomInterval & { today: Date; frequency: Frequency; graceDays: number; hasLateFee: boolean; membershipId: number; installments: ReminderInstallment[] }): PlannedReminder[] {
  const today = toCalendarDate(input.today);
  const owing = input.installments.filter((i) => i.remainingKobo > 0n).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.id - b.id);
  const recentlyOverdue = (i: ReminderInstallment) => isOverdue(i.dueDate, today) && today.getTime() <= addDays(graceEndsOn(i.dueDate, input.graceDays), REMINDER_WINDOW_AFTER_GRACE_DAYS).getTime();

  // A group that asks for money more often than weekly (daily, or every few days) would be nagged every day, so it gets one overdue message a week.
  if (periodDays(input.frequency, input) < 7) {
    const overdue = owing.filter(recentlyOverdue);
    return overdue.length ? [{ kind: 'OVERDUE', installmentIds: overdue.map((i) => i.id), dedupeKey: `w:${input.membershipId}:${isoWeekKey(today)}` }] : [];
  }

  const out: PlannedReminder[] = [];
  const tomorrow = addDays(today, 1).getTime();
  for (const i of owing) {
    if (toCalendarDate(i.dueDate).getTime() === tomorrow) out.push({ kind: 'UPCOMING', installmentIds: [i.id], dedupeKey: `i:${i.id}:UPCOMING` });
    if (recentlyOverdue(i)) out.push({ kind: 'OVERDUE', installmentIds: [i.id], dedupeKey: `i:${i.id}:OVERDUE` });
    if (input.hasLateFee && graceEndsOn(i.dueDate, input.graceDays).getTime() === today.getTime() && toCalendarDate(i.dueDate).getTime() <= today.getTime()) {
      out.push({ kind: 'GRACE_ENDING', installmentIds: [i.id], dedupeKey: `i:${i.id}:GRACE_ENDING` });
    }
  }
  return out;
}

export interface ReminderLine {
  kind: ReminderKind;
  dueDate: Date;
  remainingKobo: bigint;
}

/** One message for everything a person is being reminded about today, amounts in full. */
export function composeReminder(input: { groupName: string; lines: ReminderLine[] }): { title: string; message: string } {
  const parts = input.lines.map((l) => {
    const amount = formatNaira(l.remainingKobo);
    if (l.kind === 'UPCOMING') return `${amount} is due tomorrow (${iso(l.dueDate)})`;
    if (l.kind === 'GRACE_ENDING') return `${amount} due on ${iso(l.dueDate)} is still unpaid and your grace ends today, so a late fee applies from tomorrow`;
    return `${amount} due on ${iso(l.dueDate)} is still unpaid`;
  });
  const overdue = input.lines.some((l) => l.kind !== 'UPCOMING');
  return { title: overdue ? 'A payment is overdue' : 'A payment is due soon', message: `${input.groupName}: ${parts.join('; ')}. If you have already paid, ignore this.` };
}

/** The officers' once-a-day summary: who is overdue and by how much, amounts in full. */
export function composeDigest(input: { groupName: string; people: Array<{ name: string; overdueKobo: bigint }> }): { title: string; message: string } {
  const total = input.people.reduce((s, p) => s + p.overdueKobo, 0n);
  const top = [...input.people].sort((a, b) => (b.overdueKobo > a.overdueKobo ? 1 : b.overdueKobo < a.overdueKobo ? -1 : 0)).slice(0, 5).map((p) => `${p.name} ${formatNaira(p.overdueKobo)}`);
  const more = input.people.length > top.length ? `, and ${input.people.length - top.length} more` : '';
  return { title: 'Overdue payments today', message: `${input.groupName}: ${input.people.length} ${input.people.length === 1 ? 'person is' : 'people are'} overdue, ${formatNaira(total)} in all. ${top.join('; ')}${more}.` };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The trust score
// ---------------------------------------------------------------------------------------------------------------------------------

export type TrustBand = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'AT_RISK' | 'NO_HISTORY';

export interface TrustInstallment {
  dueDate: Date;
  amountKobo: bigint;
  paidKobo: bigint;
  /** The day the payment that completed it counted for, or null while it is still unpaid. */
  completedOn: Date | null;
  /** Under an open dispute: left out until the dispute is decided. */
  disputed: boolean;
  /** Waived: never counted either way. */
  waived: boolean;
}

export interface TrustResult {
  onTimeCount: number;
  dueCount: number;
  /** Basis points (9500 = 95.00%), or null with no history. */
  onTimeBps: number | null;
  band: TrustBand;
  excludedDisputed: number;
  excludedWaived: number;
  /** In plain words, with the counts behind the band. */
  text: string;
}

/** 95%+ Excellent, 85 to 94% Good, 70 to 84% Fair, under 70% At risk, nothing due yet: no history. Integer arithmetic, no rounding at the edges. */
export function trustBand(onTimeCount: number, dueCount: number): TrustBand {
  if (dueCount <= 0) return 'NO_HISTORY';
  const scaled = onTimeCount * 100;
  if (scaled >= 95 * dueCount) return 'EXCELLENT';
  if (scaled >= 85 * dueCount) return 'GOOD';
  if (scaled >= 70 * dueCount) return 'FAIR';
  return 'AT_RISK';
}

export const TRUST_WINDOW_DAYS = 365;

/**
 * Instalments paid on time out of those that fell due in the last 12 months. An instalment counts once it is past its due date. "On time"
 * is fully paid, with the payment that completed it counting for a day on or before the due date. Disputed ones are left out until
 * decided, waived ones never counted. It is an aid for officers and a view for the member; it never blocks anyone.
 */
export function computeTrust(rows: TrustInstallment[], today: Date): TrustResult {
  const day = toCalendarDate(today).getTime();
  const from = day - TRUST_WINDOW_DAYS * DAY_MS;
  let due = 0;
  let onTime = 0;
  let disputed = 0;
  let waived = 0;
  for (const r of rows) {
    const d = toCalendarDate(r.dueDate).getTime();
    if (d >= day || d < from) continue;
    if (r.waived) {
      waived++;
      continue;
    }
    if (r.disputed) {
      disputed++;
      continue;
    }
    due++;
    if (r.paidKobo >= r.amountKobo && r.completedOn && toCalendarDate(r.completedOn).getTime() <= d) onTime++;
  }
  const band = trustBand(onTime, due);
  const onTimeBps = due > 0 ? Math.round((onTime * 10_000) / due) : null;
  const text =
    due === 0
      ? 'No history yet: nothing has fallen due.'
      : `${onTime} of your last ${due} payment${due === 1 ? '' : 's'} ${onTime === 1 ? 'was' : 'were'} on time (${(((onTimeBps as number) / 100)).toFixed(0)}%)${disputed ? `. ${disputed} under dispute ${disputed === 1 ? 'is' : 'are'} not counted until decided` : ''}${waived ? `. ${waived} waived ${waived === 1 ? 'is' : 'are'} not counted` : ''}.`;
  return { onTimeCount: onTime, dueCount: due, onTimeBps, band, excludedDisputed: disputed, excludedWaived: waived, text };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Repayment plans
// ---------------------------------------------------------------------------------------------------------------------------------

export interface PlanLine {
  /** YYYY-MM-DD */
  dueDate: string;
  amountKobo: string;
}

/** The most instalments a drafted plan has; a longer cycle is repaid in this many. */
export const MAX_PLAN_PERIODS = 24;

/** Equal instalments on the group's own cycle, starting one period from `from`. The odd kobo go to the first lines, so the total is exact. */
export function draftPlan(input: CustomInterval & { outstandingKobo: bigint; frequency: Frequency; from: Date; periods: number }): PlanLine[] {
  if (input.outstandingKobo <= 0n) throw new RangeError('There is nothing to repay.');
  const n = Math.min(Math.max(Math.floor(input.periods), 1), MAX_PLAN_PERIODS);
  const base = input.outstandingKobo / BigInt(n);
  const extra = Number(input.outstandingKobo % BigInt(n));
  return Array.from({ length: n }, (_, i) => ({ dueDate: iso(addPeriods(input.from, input.frequency, i + 1, input)), amountKobo: (base + (i < extra ? 1n : 0n)).toString() }));
}

export interface PlanTracking {
  dueByNowKobo: bigint;
  paidKobo: bigint;
  behindKobo: bigint;
  /** Plan dates that have passed with less paid than the plan asked for by then. */
  missed: string[];
  onTrack: boolean;
}

/** A plan date is only "missed" a day after it passes, with the cumulative payments since agreement below the cumulative amount due. */
export function trackPlan(schedule: PlanLine[], paidSinceAgreedKobo: bigint, today: Date, leewayDays = 1): PlanTracking {
  const day = toCalendarDate(today).getTime();
  const lines = [...schedule].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  let cumulative = 0n;
  let dueByNow = 0n;
  const missed: string[] = [];
  for (const l of lines) {
    cumulative += BigInt(l.amountKobo);
    const d = new Date(`${l.dueDate}T00:00:00.000Z`).getTime();
    if (d <= day) dueByNow = cumulative;
    if (d + leewayDays * DAY_MS < day && paidSinceAgreedKobo < cumulative) missed.push(l.dueDate);
  }
  const behind = dueByNow > paidSinceAgreedKobo ? dueByNow - paidSinceAgreedKobo : 0n;
  return { dueByNowKobo: dueByNow, paidKobo: paidSinceAgreedKobo, behindKobo: behind, missed, onTrack: missed.length === 0 };
}
