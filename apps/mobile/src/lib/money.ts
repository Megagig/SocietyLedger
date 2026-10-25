import { Decimal } from 'decimal.js-light';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/** API boundary conversion (code-standards.md §11) — Prisma `Decimal` fields arrive as strings or numbers. */
export function toDecimal(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Sums a list of amounts without float rounding error (library-docs.md's decimal.js-light note). `decimal.js-light` has no static `.sum()` (that's full decimal.js) — reduces manually. */
export function sumMoney(values: (string | number | Decimal)[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(toDecimal(value)), new Decimal(0));
}

export function insertThousands(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatFull(value: Decimal): string {
  const fixed = value.toFixed(2);
  const [integerPart, decimalPart] = fixed.split('.');
  return `₦${insertThousands(integerPart!)}.${decimalPart}`;
}

export type FormatMoneyOptions = {
  /** Word prefix for a negative (credit) amount — ui-rules.md §5.16's own example shows no literal minus sign. */
  creditLabel?: string;
};

/** ₦ prefix, thousands separators, 2 decimals — always the full amount, never "10k" or "1.2m". Negative values render as "<creditLabel> <abs amount>". */
export function formatMoney(value: string | number | Decimal, options: FormatMoneyOptions = {}): string {
  const decimal = toDecimal(value);
  const { creditLabel = 'Credit' } = options;

  if (decimal.isNegative()) return `${creditLabel} ${formatFull(decimal.abs())}`;

  return formatFull(decimal);
}
