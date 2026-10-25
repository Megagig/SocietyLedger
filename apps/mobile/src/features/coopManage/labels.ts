import { formatMoney } from '@/lib/money';
import type { SavingsDepositStatus } from '@/types/api/cooperatives';
import type { DisbursementMethod, OfficerLoanProductDTO } from '@/types/api/coopManage';
import type { GuarantorStatus, InterestType, LoanApplicationStatus, LoanStatus } from '@/types/api/loans';

// ---------------------------------------------------------------- requests (deposits and repayments)

/** The officer's wording for a member's request: it is waiting for a decision, approved, or not approved. */
export const REQUEST_STATUS_LABELS: Record<SavingsDepositStatus, string> = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
};

export const REQUEST_STATUS_KEYS: Record<SavingsDepositStatus, string> = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };

export const REQUEST_STATUS_OPTIONS: SavingsDepositStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

/** An officer who is also a member can't decide their own request; another officer has to. */
export const isOwnRequest = (requestMemberId: number, ownMemberId: number | undefined): boolean => ownMemberId !== undefined && requestMemberId === ownMemberId;

// ---------------------------------------------------------------- loan applications

export const APPLICATION_STATUS_LABELS: Record<LoanApplicationStatus, string> = {
  DRAFT: 'Draft',
  PENDING_GUARANTORS: 'Waiting for guarantors',
  PENDING_REVIEW: 'Waiting for review',
  UNDER_REVIEW: 'Under review',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DISBURSED: 'Paid out',
  CANCELLED: 'Cancelled',
};

/** The key `StatusChip` understands for an application. */
export function applicationStatusKey(status: LoanApplicationStatus): string {
  switch (status) {
    case 'PENDING_REVIEW':
    case 'UNDER_REVIEW':
    case 'PENDING_APPROVAL':
      return 'pending_review';
    case 'PENDING_GUARANTORS':
      return 'pending_guarantors';
    case 'DRAFT':
      return 'draft';
    default:
      return status.toLowerCase();
  }
}

/** The filters on the applications queue. */
export const APPLICATION_FILTERS: { label: string; value: LoanApplicationStatus | '' }[] = [
  { label: 'To review', value: 'PENDING_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Paid out', value: 'DISBURSED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: '' },
];

const REVIEWABLE: LoanApplicationStatus[] = ['PENDING_REVIEW', 'UNDER_REVIEW', 'PENDING_APPROVAL'];

/** An application can be approved or rejected while it is waiting for a decision. */
export const applicationCanReview = (status: LoanApplicationStatus): boolean => REVIEWABLE.includes(status);

/** Only an approved application can be paid out, and only once. */
export const applicationCanDisburse = (status: LoanApplicationStatus): boolean => status === 'APPROVED';

export const GUARANTOR_STATUS_LABELS: Record<GuarantorStatus, string> = {
  PENDING: 'Waiting',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  RELEASED: 'Released',
};

/** "2 of 2 guarantors accepted" — and what is still needed when the product asks for guarantors. */
export function guarantorSummary(guarantors: { status: GuarantorStatus }[], required: number): string {
  const accepted = guarantors.filter((g) => g.status === 'ACCEPTED').length;
  if (guarantors.length === 0) return required > 0 ? `Needs ${required} ${required === 1 ? 'guarantor' : 'guarantors'}` : 'No guarantors';
  return `${accepted} of ${guarantors.length} accepted`;
}

// ---------------------------------------------------------------- loans

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  ACTIVE: 'Active',
  OVERDUE: 'Overdue',
  DEFAULTED: 'Defaulted',
  PAID_OFF: 'Paid off',
  WRITTEN_OFF: 'Written off',
};

export const loanStatusKey = (status: LoanStatus): string => status.toLowerCase();

export const LOAN_FILTERS: { label: string; value: LoanStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Paid off', value: 'PAID_OFF' },
];

/** A repayment can be recorded while the loan is active or overdue. */
export const loanCanTakeRepayment = (status: LoanStatus): boolean => status === 'ACTIVE' || status === 'OVERDUE';

/** Percent of the loan repaid, 0–100. */
export function loanPercentRepaid(totalPaid: string | number, totalRepayment: string | number): number {
  const total = Number(totalRepayment);
  if (!(total > 0)) return 0;
  return Math.min(100, Math.round((Number(totalPaid) / total) * 100));
}

// ---------------------------------------------------------------- products

export const INTEREST_TYPE_LABELS: Record<InterestType, string> = {
  FLAT: 'Flat rate',
  REDUCING_BALANCE: 'Reducing balance',
  COMPOUND: 'Compound',
};

export const INTEREST_TYPE_OPTIONS = (Object.keys(INTEREST_TYPE_LABELS) as InterestType[]).map((value) => ({ value, label: INTEREST_TYPE_LABELS[value] }));

/** "10% reducing balance · 3–12 months · ₦10,000.00 to ₦500,000.00". */
export function productTermsLine(product: Pick<OfficerLoanProductDTO, 'interestRate' | 'interestType' | 'minTenureMonths' | 'maxTenureMonths' | 'minAmount' | 'maxAmount'>): string {
  const tenure = product.minTenureMonths === product.maxTenureMonths ? `${product.minTenureMonths} months` : `${product.minTenureMonths}–${product.maxTenureMonths} months`;
  return `${Number(product.interestRate)}% ${INTEREST_TYPE_LABELS[product.interestType].toLowerCase()} · ${tenure} · ${formatMoney(product.minAmount)} to ${formatMoney(product.maxAmount)}`;
}

// ---------------------------------------------------------------- disbursing and money in/out

export const DISBURSEMENT_LABELS: Record<DisbursementMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  savings_credit: 'Credit to savings account',
};

export const DISBURSEMENT_OPTIONS = (Object.keys(DISBURSEMENT_LABELS) as DisbursementMethod[]).map((value) => ({ value, label: DISBURSEMENT_LABELS[value] }));

/** The toast after paying a loan out. */
export function disbursedSummary(method: DisbursementMethod): string {
  return method === 'savings_credit' ? 'Loan paid out into savings' : 'Loan marked as paid out';
}

export const SAVINGS_METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' },
];

export const REPAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

/** "Available ₦40,000.00 · ₦60,000.00 held against a loan". */
export function availabilityLine(available: number, held: number): string {
  return held > 0 ? `Available ${formatMoney(available)} · ${formatMoney(held)} held against a loan` : `Available ${formatMoney(available)}`;
}
