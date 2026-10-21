import type { StatusTone } from '@/components/ui/StatusChip';
import type { SavingsAccountType, SavingsDepositStatus, SavingsTransactionType } from '@/types/api/cooperatives';

export const ACCOUNT_TYPE_LABELS: Record<SavingsAccountType, string> = {
  REGULAR: 'Regular savings',
  THRIFT: 'Thrift savings',
  TARGET: 'Target savings',
  FIXED_DEPOSIT: 'Fixed deposit',
};

/** Same wording as the web My Savings page, so members see one vocabulary across surfaces. */
export const DEPOSIT_STATUS_LABELS: Record<SavingsDepositStatus, string> = {
  PENDING: 'Awaiting confirmation',
  APPROVED: 'Confirmed',
  REJECTED: 'Not approved',
};

export const DEPOSIT_STATUS_TONES: Record<SavingsDepositStatus, StatusTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export const TRANSACTION_TYPE_LABELS: Record<SavingsTransactionType, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  INTEREST: 'Interest',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
  FEE: 'Fee',
};

/** Money-in types add to the balance; the rest reduce it. */
export function isCreditTransaction(type: SavingsTransactionType): boolean {
  return type === 'DEPOSIT' || type === 'INTEREST' || type === 'TRANSFER_IN';
}
