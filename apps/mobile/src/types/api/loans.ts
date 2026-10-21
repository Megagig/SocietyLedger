/** Cooperative loans — `/api/cooperatives/{loan-products,loan-applications,loans,loan-repayments,loan-repayment-requests,guarantor-candidates}`. Verified 2026-10-21 against cooperatives.types.ts / controller. Decimals arrive as strings. */
import type { IsoDateString, MoneyValue } from './common';
import type { PaginationDTO, SavingsDepositStatus } from './cooperatives';

export type InterestType = 'FLAT' | 'REDUCING_BALANCE' | 'COMPOUND';
export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'DEFAULTED' | 'PAID_OFF' | 'WRITTEN_OFF';
export type LoanApplicationStatus =
  | 'DRAFT'
  | 'PENDING_GUARANTORS'
  | 'PENDING_REVIEW'
  | 'UNDER_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'
  | 'CANCELLED';
export type GuarantorStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'RELEASED';
export type RepaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';

export type LoanProductDTO = {
  id: number;
  name: string;
  description: string | null;
  minAmount: MoneyValue;
  maxAmount: MoneyValue;
  interestRate: MoneyValue;
  interestType: InterestType;
  minTenureMonths: number;
  maxTenureMonths: number;
  processingFeePercent: MoneyValue;
  processingFeeFixed: MoneyValue;
  requiresGuarantor: boolean;
  minGuarantors: number;
  /** e.g. "2.00": borrow up to this many times available savings. null = no savings rule. */
  maxLoanToSavingsRatio: MoneyValue | null;
  /** When true, principal ÷ ratio of the member's savings is held until the loan is repaid. */
  lockSavings: boolean;
  isActive: boolean;
};

export type LoanProductsResponseDTO = { products: LoanProductDTO[]; pagination: PaginationDTO };

export type LoanGuarantorDTO = {
  id: number;
  loanApplicationId: number;
  guarantorMemberId: number;
  guarantorName: string;
  guaranteeAmount: MoneyValue;
  status: GuarantorStatus;
  acceptedAt: IsoDateString | null;
  declinedAt: IsoDateString | null;
  declineReason: string | null;
};

export type LoanApplicationDTO = {
  id: number;
  applicationNumber: string;
  memberId: number;
  loanProductId: number;
  loanProductName: string;
  amount: MoneyValue;
  tenureMonths: number;
  interestRate: MoneyValue;
  interestType: InterestType;
  monthlyRepayment: MoneyValue;
  totalRepayment: MoneyValue;
  totalInterest: MoneyValue;
  processingFee: MoneyValue;
  purpose: string;
  status: LoanApplicationStatus;
  guarantors: LoanGuarantorDTO[];
  appliedAt: IsoDateString;
  rejectionReason: string | null;
  disbursedAt: IsoDateString | null;
};

export type LoanApplicationsResponseDTO = { applications: LoanApplicationDTO[]; pagination: PaginationDTO };

export type CreateLoanApplicationPayload = {
  loanProductId: number;
  amount: number;
  tenureMonths: number;
  /** 10–500 characters. */
  purpose: string;
  guarantorIds?: number[];
};

export type LoanScheduleItemDTO = {
  id: number;
  installmentNumber: number;
  dueDate: IsoDateString;
  principalDue: MoneyValue;
  interestDue: MoneyValue;
  totalDue: MoneyValue;
  totalPaid: MoneyValue;
  lateFee: MoneyValue;
  status: RepaymentStatus;
  paidAt: IsoDateString | null;
};

export type LoanDTO = {
  id: number;
  loanNumber: string;
  memberId: number;
  loanProductName: string;
  principalAmount: MoneyValue;
  interestRate: MoneyValue;
  interestType: InterestType;
  tenureMonths: number;
  monthlyRepayment: MoneyValue;
  totalRepayment: MoneyValue;
  totalInterest: MoneyValue;
  totalPaid: MoneyValue;
  principalPaid: MoneyValue;
  outstandingBalance: MoneyValue;
  nextPaymentDate: IsoDateString | null;
  nextPaymentAmount: MoneyValue | null;
  status: LoanStatus;
  disbursedAt: IsoDateString;
  maturityDate: IsoDateString;
  closedAt: IsoDateString | null;
  repaymentSchedule: LoanScheduleItemDTO[];
};

export type LoansResponseDTO = { loans: LoanDTO[]; pagination: PaginationDTO };

export type LoanRepaymentDTO = {
  id: number;
  loanId: number;
  amount: MoneyValue;
  principalPortion: MoneyValue;
  interestPortion: MoneyValue;
  lateFee: MoneyValue;
  paymentMethod: string;
  reference: string | null;
  paidAt: IsoDateString;
};

export type LoanRepaymentsResponseDTO = { repayments: LoanRepaymentDTO[]; pagination: PaginationDTO };

/** A member-declared payment towards a loan; an officer's approval is what records it. Same status values as savings deposits. */
export type LoanRepaymentRequestDTO = {
  id: number;
  loanId: number;
  loanNumber: string;
  amount: MoneyValue;
  paymentDate: IsoDateString;
  reference: string | null;
  memberNote: string | null;
  filename: string;
  hasReceipt: boolean;
  status: SavingsDepositStatus;
  reviewedAt: IsoDateString | null;
  rejectionReason: string | null;
  createdAt: IsoDateString;
};

export type LoanRepaymentRequestsResponseDTO = { repaymentRequests: LoanRepaymentRequestDTO[]; pagination: PaginationDTO };

export type SubmitLoanRepaymentPayload = {
  loanId: number;
  amount: string;
  paymentDate: string;
  reference?: string;
  memberNote?: string;
  file: { uri: string; name: string; type: string };
};

/** GET /cooperatives/guarantor-candidates — names only; members can't list /members. */
export type GuarantorCandidateDTO = { id: number; firstName: string; lastName: string; memberId: string };
