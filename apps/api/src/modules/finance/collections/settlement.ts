import { Decimal } from '@prisma/client/runtime/library';

/**
 * Who has paid and who is yet to pay, worked out from the money and never from a stored label, so every screen and every export agrees.
 *   paid   - nothing left to pay
 *   part   - something paid, a balance left
 *   unpaid - nothing paid yet
 * "owing" is the officer's "yet to pay": part and unpaid together.
 */
export type Settlement = 'paid' | 'part' | 'unpaid';
export const SETTLEMENT_FILTERS = ['all', 'paid', 'part', 'unpaid', 'owing'] as const;
export type SettlementFilter = (typeof SETTLEMENT_FILTERS)[number];

type Num = Decimal | number | string;

export function settle(amount: Num, paid: Num): { balance: Decimal; status: Settlement } {
  const owed = new Decimal(amount);
  const got = new Decimal(paid);
  const balance = owed.minus(got);
  if (balance.lessThanOrEqualTo(0)) return { balance: new Decimal(0), status: 'paid' };
  return { balance, status: got.greaterThan(0) ? 'part' : 'unpaid' };
}

export function matchesSettlement(status: Settlement, filter: SettlementFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'owing') return status !== 'paid';
  return status === filter;
}

/** Name or member number, any case, ignoring extra spaces; a blank search matches everyone. */
export function matchesSearch(search: string | undefined, ...fields: Array<string | null | undefined>): boolean {
  const needle = (search ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!needle) return true;
  const haystack = fields.filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' ');
  return needle.split(' ').every((word) => haystack.includes(word));
}

export const SETTLEMENT_LABELS: Record<Settlement, string> = { paid: 'Paid', part: 'Part paid', unpaid: 'Not paid' };
export const FILTER_LABELS: Record<SettlementFilter, string> = {
  all: 'Everyone',
  paid: 'Paid',
  part: 'Part paid',
  unpaid: 'Not paid',
  owing: 'Yet to pay (part paid and not paid)',
};

/** The status of a charge row in the `transactions` table, for filtering in the database where the list is paged. */
export function transactionStatusesFor(filter: SettlementFilter): string[] | null {
  switch (filter) {
    case 'paid': return ['paid'];
    case 'part': return ['partial'];
    case 'unpaid': return ['pending'];
    case 'owing': return ['pending', 'partial'];
    default: return null;
  }
}
