/** Money and dates for the Ajo screens. Money is always shown in full: ₦10,000.00, never 10k. */

// The web app compiles below ES2020, so bigint literals (0n) are not available; these are the same values.
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

/** True when a kobo amount from the API is more than zero. */
export function koboPositive(kobo: string | null | undefined): boolean {
  if (!kobo) return false;
  try {
    return BigInt(kobo) > ZERO;
  } catch {
    return false;
  }
}

/** Kobo (a string from the API, so nothing is lost) as naira with two decimals. */
export function formatKobo(kobo: string | number | bigint | null | undefined): string {
  if (kobo === null || kobo === undefined || kobo === '') return '₦0.00';
  let value: bigint;
  try {
    value = BigInt(kobo);
  } catch {
    return '₦0.00';
  }
  const negative = value < ZERO;
  const abs = negative ? -value : value;
  const whole = (abs / HUNDRED).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (abs % HUNDRED).toString().padStart(2, '0');
  return `${negative ? '-' : ''}₦${whole}.${cents}`;
}

/** Naira typed into a form ("10,000", "10000.50") as kobo, or null when it is not a valid amount. */
export function nairaToKobo(text: string): bigint | null {
  const clean = text.replace(/[,\s₦]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return BigInt(whole) * HUNDRED + BigInt(frac.padEnd(2, '0') || '0');
}

/** A calendar day from the API ("2027-03-01T00:00:00.000Z"), shown as the same day wherever the reader is. */
export function formatDay(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** A moment (a payment received, a rule accepted), in the reader's own time. */
export function formatMoment(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const MODEL_LABEL = { COLLECTOR_THRIFT: 'Collector thrift', ROTATING_POT: 'Rotating pot' } as const;
export const FREQUENCY_LABEL = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' } as const;

/** "1st", "2nd", "3rd" for a place in the payout order. */
export function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
