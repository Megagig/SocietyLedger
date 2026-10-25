import { formatMoney, toDecimal } from '@/lib/money';
import type { BudgetPositionDTO, ExpenseStatus } from '@/types/api/expenses';

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  VOIDED: 'Voided',
};

/** The key `StatusChip` knows each state by. */
export const expenseStatusKey = (status: ExpenseStatus): string => (status === 'VOIDED' ? 'cancelled' : status.toLowerCase());

export const EXPENSE_FILTER_OPTIONS: { label: string; value: ExpenseStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Waiting for approval', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Drafts', value: 'DRAFT' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Voided', value: 'VOIDED' },
];

/** Where a category stands against its budget line, in words: what is left, or how far over this voucher takes it. */
export function budgetSentence(position: BudgetPositionDTO): { text: string; over: boolean } {
  const over = toDecimal(position.overBy).gt(0);
  if (over) {
    return {
      text: `This takes the category ${formatMoney(position.overBy)} over its budget (${formatMoney(position.planned)} planned, ${formatMoney(position.spent)} already spent).`,
      over: true,
    };
  }
  return { text: `${formatMoney(toDecimal(position.spent).plus(position.thisVoucher))} of ${formatMoney(position.planned)} used. ${formatMoney(position.left)} left in the budget.`, over: false };
}

/** Said to someone who can see an expense waiting for approval but may not decide it. */
export const CANNOT_DECIDE_NOTE = 'Waiting for an officer who can approve payments. You can see it, but not decide it.';

/** Said when nobody but the officer who recorded it could approve: it would wait for ever. */
export const NO_APPROVER_NOTE = 'No other officer can approve this yet. Give the Treasurer role to someone, or let another officer approve payments.';

/** What the receipt rule asks for this amount: the receipt itself above the limit, a receipt or a reason at or below it. */
export function receiptRule(amount: string | number, limit: string | number): 'receipt' | 'receipt-or-reason' {
  return toDecimal(amount).gt(limit) ? 'receipt' : 'receipt-or-reason';
}

/** The words that tell the officer what the receipt rule is for the amount they entered. */
export function receiptHelper(amount: string, limit: string | number): string {
  const entered = Number(amount.replace(/,/g, ''));
  if (!Number.isFinite(entered) || entered <= 0) return `A receipt is needed for spending above ${formatMoney(limit)}.`;
  return receiptRule(entered, limit) === 'receipt'
    ? `This needs its receipt: spending above ${formatMoney(limit)} cannot be sent without one.`
    : `Attach the receipt, or say why there is none below. A receipt is only required above ${formatMoney(limit)}.`;
}

