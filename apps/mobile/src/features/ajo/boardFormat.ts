/**
 * Small pure helpers for the Circle board: percentages and the group's own clock (spec §16.2, "one clock"). No React, so they are
 * tested on their own.
 */

/** Basis points as a percentage: 9500 is "95%". Null means there is nothing to measure yet. */
export function percent(bps: number | null | undefined): string {
  return bps === null || bps === undefined ? 'None yet' : `${Math.round(bps / 100)}%`;
}

/** The share of a round collected, 0 to 100, for a progress bar. Money is a kobo string, so this never goes through a float for the amounts. */
export function collectedPercent(collectedKobo: string, expectedKobo: string): number {
  const expected = BigInt(expectedKobo);
  if (expected <= BigInt(0)) return 0;
  return Number((BigInt(collectedKobo) * BigInt(100)) / expected);
}

/** "29 Oct, 14:02" in the group's timezone, not the phone's. Falls back to the phone's clock if the timezone is not known to the device. */
export function formatMomentIn(value: string | null | undefined, timeZone: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false };
  try {
    return date.toLocaleString('en-NG', { ...options, timeZone });
  } catch {
    return date.toLocaleString('en-NG', options);
  }
}

/** "4 Mar", from a calendar day the API sends as "2027-03-04" (the same day wherever the reader is). */
export function shortDay(day: string | null | undefined): string {
  if (!day) return '';
  const date = new Date(`${day.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Whole days from now in words: "in 2 days", "today", "3 days ago". */
export function daysPhrase(days: number): string {
  if (days === 0) return 'today';
  return days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} ago`;
}
