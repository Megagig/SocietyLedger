import type { OpenChargeDTO, Settlement, SettlementFilter } from '@/types/api/collections';

/** What the officer's "paid / yet to pay" choices are called: the same wording as the web and the exports. */
export const SETTLEMENT_OPTIONS: { value: SettlementFilter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'owing', label: 'Yet to pay' },
  { value: 'unpaid', label: 'Not paid' },
  { value: 'part', label: 'Part paid' },
  { value: 'paid', label: 'Paid' },
];

/** Member ledgers have only two real states. */
export const LEDGER_OPTIONS: { value: SettlementFilter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'owing', label: 'Owing' },
  { value: 'paid', label: 'Cleared' },
];

export const SETTLEMENT_LABELS: Record<Settlement, string> = { paid: 'Paid', part: 'Part paid', unpaid: 'Not paid' };

/** StatusChip's colour key for each state. */
export const SETTLEMENT_CHIP: Record<Settlement, string> = { paid: 'paid', part: 'partial', unpaid: 'pending' };

export const KIND_LABELS: Record<OpenChargeDTO['kind'], string> = { levy: 'Levy', pledge: 'Pledge', penalty: 'Penalty', charge: 'Charge' };

/** Paid, part paid or not paid, from the money: never from a stored label. */
export function settle(amount: number, paid: number): { balance: number; status: Settlement } {
  const balance = Math.round((amount - paid) * 100) / 100;
  if (balance <= 0) return { balance: 0, status: 'paid' };
  return { balance, status: paid > 0 ? 'part' : 'unpaid' };
}

export function matchesSettlement(status: Settlement, filter: SettlementFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'owing') return status !== 'paid';
  return status === filter;
}

/** Every word of the search has to be in the name or member number, in any case. */
export function matchesSearch(search: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = search.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!needle) return true;
  const haystack = fields.filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' ');
  return needle.split(' ').every((word) => haystack.includes(word));
}

/** A problem with what the officer typed for one debt, or null. Money is shown in full. */
export function amountProblem(text: string, balance: number): string | null {
  const value = Number(text);
  if (!text.trim() || !Number.isFinite(value) || value <= 0) return 'Enter an amount above zero.';
  if (value > balance) return `At most ₦${balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
  return null;
}

/** The plain-words reason, and which debt it was about, from a refused request. */
export function paymentFailure(error: unknown): { message: string; transactionId?: number } {
  const e = error as { message?: string; transactionId?: number } | null;
  return { message: e?.message || 'We could not record that payment. Nothing was saved. Try again.', transactionId: e?.transactionId };
}

export function exportFilename(screen: string, status: string, format: 'xlsx' | 'pdf', now: Date = new Date()): string {
  return `${screen}-${status}-${now.toISOString().slice(0, 10)}.${format}`;
}
