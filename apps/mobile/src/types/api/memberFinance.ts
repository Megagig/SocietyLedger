/** Member finance self-service — real path `/api/members/me/*`, no `X-Tenant` needed — api-contract.md §4. */
import type { MoneyValue, IsoDateString } from './common';

/** GET /members/me/dues — verified against member-finance.controller.ts getDues. */
export type DueDTO = {
  id: number;
  referenceNumber: string;
  category: FinanceCategoryRefDTO;
  amount: number;
  paid: number;
  balance: number;
  dueDate: IsoDateString;
  status: string;
  isOverdue: boolean;
  payments: { id: number; amount: number; paymentDate: IsoDateString }[];
  createdAt: IsoDateString;
};

export type DuesResponseDTO = { dues: DueDTO[] };

/** GET /members/me/levies — verified against member-finance.controller.ts getLevies. */
export type LevyCampaignDTO = {
  id: number;
  name: string;
  description: string | null;
  targetAmount: MoneyValue;
  deadline: IsoDateString | null;
  status: string;
  category: FinanceCategoryRefDTO;
};

export type LevyAssignmentDTO = {
  id: number;
  campaign: LevyCampaignDTO;
  amount: number;
  paid: number;
  balance: number;
  status: string;
  isOverdue: boolean;
  transactionId: number | null;
  assignedAt: IsoDateString;
};

export type LeviesResponseDTO = { levies: LevyAssignmentDTO[] };

/** GET /members/me/penalties — verified against member-finance.controller.ts getPenalties. */
export type PenaltyDTO = {
  id: number;
  referenceNumber: string;
  category: FinanceCategoryRefDTO;
  amount: number;
  paid: number;
  balance: number;
  reason: string | null;
  status: string;
  payments: { id: number; amount: number; paymentDate: IsoDateString }[];
  createdAt: IsoDateString;
};

export type PenaltiesResponseDTO = { penalties: PenaltyDTO[] };

/** Donation cause picker — sourced from `donationCategories[]` in GET /members/me/donations. */
export type DonationCategoryDTO = {
  id: number;
  name: string;
  description: string | null;
};

/** GET /members/me/donations — verified against member-finance.controller.ts getDonations. */
export type DonationDTO = {
  id: number;
  category: FinanceCategoryRefDTO;
  amount: number;
  isAnonymous: boolean;
  reference: string | null;
  notes: string | null;
  createdAt: IsoDateString;
};

export type DonationsResponseDTO = {
  donations: DonationDTO[];
  donationCategories: DonationCategoryDTO[];
};
import type { PaymentProofDTO } from './nigerianPayments';

/** `FinancialCategory.type` is a free-form `String` column (not a Prisma enum). */
export type FinanceCategoryRefDTO = {
  id: number;
  name: string;
  type: string;
};

export type OutstandingItemType = 'dues' | 'levy' | 'penalty';

export type UpcomingPaymentDTO = {
  id: number;
  category: FinanceCategoryRefDTO;
  amount: MoneyValue;
  balance: MoneyValue;
  dueDate: IsoDateString;
  status: string;
};

export type RecentTransactionDTO = {
  id: number;
  category: FinanceCategoryRefDTO;
  amount: MoneyValue;
  paid: MoneyValue;
  balance: MoneyValue;
  status: string;
  createdAt: IsoDateString;
};

/**
 * GET /members/me/finance-summary — verified against member-finance.controller.ts (2026-10-19).
 * No member profile → still 200, all fields zeroed, `hasMemberProfile: false`. The normal-path
 * response does NOT include `hasMemberProfile: true` — don't assume that flag is always present.
 */
export type FinanceSummaryDTO = {
  hasMemberProfile?: false;
  totalDue: MoneyValue;
  totalPaid: MoneyValue;
  paidThisMonth: MoneyValue;
  totalOutstanding: MoneyValue;
  overdueAmount: MoneyValue;
  overdueCount: number;
  duesSummary: { total: MoneyValue; paid: MoneyValue; outstanding: MoneyValue; count: number };
  leviesSummary: { total: MoneyValue; paid: MoneyValue; outstanding: MoneyValue; count: number };
  penaltiesSummary: { total: MoneyValue; paid: MoneyValue; outstanding: MoneyValue; count: number };
  donationsSummary: { total: MoneyValue; count: number };
  upcomingPayments: UpcomingPaymentDTO[];
  recentTransactions: RecentTransactionDTO[];
};

/**
 * GET /members/me/outstanding — verified 2026-10-19. NO pagination at all, unlike every
 * other list endpoint in this contract — do not reuse a paginated shape here.
 */
export type OutstandingItemDTO = {
  id: number;
  type: OutstandingItemType;
  category: FinanceCategoryRefDTO;
  campaign?: { name: string };
  amount: MoneyValue;
  balance: MoneyValue;
  dueDate: IsoDateString;
};

export type OutstandingResponseDTO = {
  items: OutstandingItemDTO[];
};

/** GET /members/me/payment-proofs — verified 2026-10-19. Max 50, newest first; empty array (not 404) if no member profile. PaymentProof row shape is nigerianPayments.ts's PaymentProofDTO. */
export type PaymentProofsResponseDTO = {
  proofs: PaymentProofDTO[];
};

/** GET /members/me/bank-accounts — verified 2026-10-19. Member-safe subset (active accounts only, no sensitive fields). */
export type MemberBankAccountDTO = {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
};

export type MemberBankAccountsResponseDTO = {
  accounts: MemberBankAccountDTO[];
};

/** Request body for POST /members/me/pay — verified against the real zod schema (2026-10-19). */
export type PayRequestPaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'mobile_money' | 'cheque' | 'other';

export type PayRequestDTO = {
  transactionIds: number[];
  paymentMethod: PayRequestPaymentMethod;
  declarationNote: string;
  reference?: string;
  notes?: string;
};

/** Request body for POST /members/me/donate — verified 2026-10-19. */
export type DonateRequestDTO = {
  categoryId: number;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  isAnonymous?: boolean;
};

export type MemberPaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'mobile_money' | 'cheque' | 'other';

export type MemberPaymentDTO = {
  id: number;
  /** Already `Number()`'d server-side (member-finance.controller.ts's `getPayments`), unlike
   * most other money fields in this contract — still run through `toDecimal()` at this layer
   * for consistency with every other amount in the app. */
  amount: number;
  paymentDate: IsoDateString;
  paymentMethod: MemberPaymentMethod;
  reference: string | null;
  transaction: {
    id: number;
    referenceNumber: string;
    category: FinanceCategoryRefDTO;
  };
  createdAt: IsoDateString;
};

/**
 * GET /members/me/payments — verified against member-finance.controller.ts getPayments
 * (2026-10-20). **No pagination/limit support at all** — the controller ignores any `?limit=`
 * query param and always returns the complete history, newest-first; callers wanting "recent N"
 * (H1) must slice client-side. 404s "Member profile not found" if the user has no linked
 * `Member` — unlike `finance-summary`'s graceful `hasMemberProfile: false` fallback, so this
 * endpoint's 404 needs its own handling, not `finance-summary`'s pattern.
 */
export type MemberPaymentsResponseDTO = {
  payments: MemberPaymentDTO[];
};

/** GET /members/me/payment-info — F2.8/F2.9 (2026-10-21). */
export type PaymentInfoDTO = {
  paystackEnabled: boolean;
  bankAccounts: MemberBankAccountDTO[];
};
