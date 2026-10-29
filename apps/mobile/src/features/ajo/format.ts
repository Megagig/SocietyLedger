/** Money and dates for the Ajo screens. Money is always shown in full: ₦10,000.00, never 10k. Same rules as apps/web/src/lib/ajo/format.ts. */

const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function toBig(kobo: string | number | bigint | null | undefined): bigint | null {
  if (kobo === null || kobo === undefined || kobo === '') return null;
  try {
    return BigInt(kobo);
  } catch {
    return null;
  }
}

/** True when a kobo amount from the API is more than zero. */
export function koboPositive(kobo: string | null | undefined): boolean {
  const value = toBig(kobo);
  return value !== null && value > ZERO;
}

/** True when a kobo amount is below zero (a difference that is short). */
export function koboNegative(kobo: string | null | undefined): boolean {
  const value = toBig(kobo);
  return value !== null && value < ZERO;
}

function groupThousands(whole: bigint): string {
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Kobo (a string from the API, so nothing is lost) as naira with two decimals: "₦10,000.00". A negative keeps its minus sign. */
export function formatKobo(kobo: string | number | bigint | null | undefined): string {
  const value = toBig(kobo);
  if (value === null) return '₦0.00';
  const negative = value < ZERO;
  const abs = negative ? -value : value;
  const cents = (abs % HUNDRED).toString().padStart(2, '0');
  return `${negative ? '-' : ''}₦${groupThousands(abs / HUNDRED)}.${cents}`;
}

/** Kobo as a plain naira string with two decimals ("10000.00"), for the shared `Money` component and form fields. Never negative-aware: use `formatKobo` for a difference. */
export function koboToNaira(kobo: string | number | bigint | null | undefined): string {
  const value = toBig(kobo);
  if (value === null) return '0.00';
  const abs = value < ZERO ? -value : value;
  return `${(abs / HUNDRED).toString()}.${(abs % HUNDRED).toString().padStart(2, '0')}`;
}

/** Naira typed into a form ("10,000", "10000.50") as kobo, or null when it is not a valid amount. */
export function nairaToKobo(text: string): bigint | null {
  const clean = text.replace(/[,\s₦]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole = '0', frac = ''] = clean.split('.');
  return BigInt(whole) * HUNDRED + BigInt(frac.padEnd(2, '0') || '0');
}

/** Naira typed into a form as a kobo string for the API, or null when it is not a valid amount. */
export function nairaToKoboString(text: string): string | null {
  const kobo = nairaToKobo(text);
  return kobo === null ? null : kobo.toString();
}

function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A calendar day from the API ("2027-03-01T00:00:00.000Z"), shown as the same day wherever the reader is: "1 Mar 2027". */
export function formatDay(value: string | Date | null | undefined): string {
  const date = parse(value);
  if (!date) return '';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** A moment (a payment received, a rule accepted), in the reader's own time: "1 Mar 2027, 2:30 PM". */
export function formatMoment(value: string | Date | null | undefined): string {
  const date = parse(value);
  if (!date) return '';
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const clock = `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${clock}`;
}

/** Today as a plain `YYYY-MM-DD` in the phone's own calendar, for a date field's default. */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const MODEL_LABEL = { COLLECTOR_THRIFT: 'Collector thrift', ROTATING_POT: 'Rotating pot' } as const;
export const FREQUENCY_LABEL = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', ANNUALLY: 'Annually', CUSTOM: 'Custom' } as const;

/** How often a group collects: "Weekly", or for a custom step "Every 2 weeks" (the server writes the words). */
export function frequencyText(g: { frequency: keyof typeof FREQUENCY_LABEL; cadence?: string | null }): string {
  if (g.frequency === 'CUSTOM' && g.cadence) return g.cadence.charAt(0).toUpperCase() + g.cadence.slice(1);
  return FREQUENCY_LABEL[g.frequency];
}

/** "1st", "2nd", "3rd" for a place in the payout order. */
export function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** The cadence the wizard is building, in the same words the server uses: "every 2 weeks", "every 3 months". */
export function cadenceWords(frequency: keyof typeof FREQUENCY_LABEL, count: number, unit: 'DAYS' | 'WEEKS' | 'MONTHS'): string {
  switch (frequency) {
    case 'DAILY':
      return 'every day';
    case 'WEEKLY':
      return 'every week';
    case 'MONTHLY':
      return 'every month';
    case 'QUARTERLY':
      return 'every 3 months';
    case 'ANNUALLY':
      return 'every year';
    default:
      return count === 1 ? `every ${unit.toLowerCase().replace(/s$/, '')}` : `every ${count} ${unit.toLowerCase()}`;
  }
}

/** A fresh key for one money-recording write. A retry of the same attempt reuses it, so it is recorded once. */
export function newIdempotencyKey(): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

/** The calendar day (`YYYY-MM-DD`) a date field's value falls on in the phone's own calendar. A picked day must not slip a day back through UTC. */
export function isoToLocalDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
