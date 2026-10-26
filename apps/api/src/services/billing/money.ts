/**
 * Money and period maths for billing. Everything is whole kobo (integers) so a price can never drift through floating point,
 * and every date calculation is UTC so the result does not depend on the server's timezone.
 */
import type { BillingCycle } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

export function nairaToKobo(naira: number | string): number {
  const n = typeof naira === 'string' ? Number(naira) : naira;
  if (!Number.isFinite(n)) throw new Error('Amount must be a number');
  return Math.round(n * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/** Always shown in full, e.g. `₦10,000.00`, never abbreviated. */
export function formatNaira(kobo: number): string {
  const sign = kobo < 0 ? '-' : '';
  const abs = Math.abs(kobo);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (abs % 100).toString().padStart(2, '0');
  return `${sign}₦${whole}.${cents}`;
}

export function priceForCycle(prices: { priceMonthlyKobo: number; priceAnnualKobo: number }, cycle: BillingCycle): number {
  return cycle === 'ANNUAL' ? prices.priceAnnualKobo : prices.priceMonthlyKobo;
}

/** Adds calendar months in UTC, clamping to the last day of a shorter month (31 Jan + 1 month = 28/29 Feb, not 3 Mar). */
export function addMonthsUtc(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function periodEndFor(start: Date, cycle: BillingCycle): Date {
  return addMonthsUtc(start, cycle === 'ANNUAL' ? 12 : 1);
}

/**
 * The fraction of a period still ahead, in whole days: `{ remainingDays, totalDays }`. Used to prorate add-ons bought mid-term
 * and to credit the unused part of the current plan on an upgrade.
 */
export function periodDays(periodStart: Date, periodEnd: Date, now: Date): { remainingDays: number; totalDays: number } {
  const totalDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS));
  const remaining = Math.ceil((periodEnd.getTime() - now.getTime()) / DAY_MS);
  return { totalDays, remainingDays: Math.min(totalDays, Math.max(0, remaining)) };
}

/**
 * Where a subscription is within its billing cycle, measured back from the period end. The cycle length is the nominal one for the
 * billing cycle ("the month/year ending on `periodEnd`"), so a period that was extended early still prorates against a real cycle.
 * `remainingDays` is NOT capped at one cycle: an add-on that runs for 1.2 cycles is charged 1.2 cycles.
 */
export function cycleDaysLeft(periodEnd: Date, cycle: BillingCycle, now: Date): { remainingDays: number; totalDays: number } {
  const cycleStart = addMonthsUtc(periodEnd, cycle === 'ANNUAL' ? -12 : -1);
  const totalDays = Math.max(1, Math.round((periodEnd.getTime() - cycleStart.getTime()) / DAY_MS));
  const remainingDays = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / DAY_MS));
  return { remainingDays, totalDays };
}

/**
 * What an add-on bought mid-term costs when it is aligned to the plan's renewal date: `price × remaining days ÷ days in the cycle`,
 * rounded up to the next kobo.
 */
export function addonProrationKobo(priceKobo: number, periodEnd: Date, cycle: BillingCycle, now: Date): number {
  const { remainingDays, totalDays } = cycleDaysLeft(periodEnd, cycle, now);
  if (priceKobo <= 0 || remainingDays <= 0) return 0;
  return Math.ceil((priceKobo * remainingDays) / totalDays);
}

/** `price × remainingDays ÷ totalDays`, rounded up to the next kobo and never more than the full price. */
export function prorateKobo(fullPriceKobo: number, remainingDays: number, totalDays: number): number {
  if (fullPriceKobo <= 0 || remainingDays <= 0) return 0;
  if (remainingDays >= totalDays) return fullPriceKobo;
  return Math.min(fullPriceKobo, Math.ceil((fullPriceKobo * remainingDays) / totalDays));
}

/** The unused part of what was paid, rounded down so a credit can never exceed what is owed back. */
export function creditKobo(fullPriceKobo: number, remainingDays: number, totalDays: number): number {
  if (fullPriceKobo <= 0 || remainingDays <= 0) return 0;
  if (remainingDays >= totalDays) return fullPriceKobo;
  return Math.floor((fullPriceKobo * remainingDays) / totalDays);
}
