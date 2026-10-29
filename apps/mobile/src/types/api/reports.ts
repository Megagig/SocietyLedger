import type { IsoDateString, MoneyValue } from './common';

/**
 * Reports and exports for officers. Mirrors `apps/api/src/modules/reports` and `modules/exports`. Money comes as strings or numbers
 * and is shown through `Money`. Every figure here has a list behind it (`ChargeListDTO`, `PaymentListDTO`) whose totals equal it.
 */

export type ReportPeriod = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'custom';
export type GroupBy = 'month' | 'quarter' | 'year';
export type ChargeCategoryType = 'due' | 'levy' | 'donation' | 'penalty';

/** What a report is asked about: a named period, or a custom range (both dates). */
export type RangeParams = { period: ReportPeriod; startDate?: string; endDate?: string };

export type PeriodDTO = { startDate: IsoDateString; endDate: IsoDateString; label: string };

export type CategoryIncomeDTO = { categoryId: number; categoryName: string; categoryType: string; amount: MoneyValue; transactionCount: number };

export type FinancialSummaryDTO = {
  period: PeriodDTO;
  /** Money that came in during the period: every payment dated in it. */
  income: { total: MoneyValue; byCategory: CategoryIncomeDTO[] };
  expenses: { total: MoneyValue; byCategory: CategoryIncomeDTO[] };
  /** Of the charges raised in the period: what was expected, what has been paid on them, what is still owed. */
  collections: { expected: MoneyValue; collected: MoneyValue; outstanding: MoneyValue; collectionRate: number };
  received?: { total: MoneyValue; paymentCount: number };
  raised?: { total: MoneyValue; chargeCount: number };
  comparison?: {
    previousPeriod: { startDate: IsoDateString; endDate: IsoDateString; income: MoneyValue; expenses: MoneyValue; collections: MoneyValue };
    changes: { income: Change; expenses: Change; collections: Change };
  };
};
type Change = { amount: MoneyValue; percentage: number };

export type MemberBalanceDTO = {
  memberId: number;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  totalDues: MoneyValue;
  totalPaid: MoneyValue;
  balance: MoneyValue;
  pendingTransactions: number;
  overdueTransactions: number;
  lastPaymentDate: IsoDateString | null;
  status: string;
};

export type MemberBalancesDTO = {
  members: MemberBalanceDTO[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
  totals: { memberCount: number; totalDues: MoneyValue; totalPaid: MoneyValue; balance: MoneyValue; overdueCharges: number };
};

export type MemberBalancesParams = { page: number; limit: number; status: 'all' | 'with_balance' | 'overdue'; search?: string; sortBy?: 'name' | 'balance' | 'lastPayment'; sortOrder?: 'asc' | 'desc' };

export type AgingBucketKey = 'notYetDue' | 'current' | 'days31to60' | 'days61to90' | 'over90';
export type AgingBucketDTO = {
  range: string;
  minDays: number;
  maxDays: number | null;
  count: number;
  amount: MoneyValue;
  members: { memberId: number; memberName: string; amount: MoneyValue; oldestDueDate: IsoDateString; daysOverdue: number; chargeCount?: number }[];
};
export type AgingDTO = {
  asOfDate: IsoDateString;
  summary: { totalOutstanding: MoneyValue; totalMembers: number; totalTransactions: number };
  buckets: Record<AgingBucketKey, AgingBucketDTO>;
};

export type CollectionRateDTO = {
  period: PeriodDTO;
  overall: { expected: MoneyValue; collected: MoneyValue; outstanding: MoneyValue; collectionRate: number };
  byMonth: { key?: string; startDate?: IsoDateString; endDate?: IsoDateString; month: string; year: number; expected: MoneyValue; collected: MoneyValue; collectionRate: number }[];
  byCategory: { categoryId: number; categoryName: string; categoryType: string; expected: MoneyValue; collected: MoneyValue; collectionRate: number }[];
};

export type CategoryReportDTO = {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  isActive: boolean;
  statistics: { totalExpected: MoneyValue; totalCollected: MoneyValue; totalOutstanding: MoneyValue; collectionRate: number; transactionCount: number; memberCount: number };
  byStatus: Record<string, { count: number; amount: MoneyValue }>;
  recentTransactions: { id: number; referenceNumber: string; memberName: string; amount: MoneyValue; paidAmount: MoneyValue; balance: MoneyValue; status: string; dueDate: IsoDateString | null; createdAt: IsoDateString }[];
};

// ---------------------------------------------------------------- the records behind a figure

export type ChargeScope = 'raised' | 'owing' | 'overdue' | 'aging';
export type ChargeStatusFilter = 'paid' | 'partial' | 'pending' | 'overdue' | 'waived';

/** Which charges to list. These are the same filters the reports use, so the list adds up to the figure that was tapped. */
export type ChargeListParams = {
  scope: ChargeScope;
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  categoryType?: ChargeCategoryType;
  memberId?: number;
  bucket?: AgingBucketKey;
  asOfDate?: string;
  status?: ChargeStatusFilter;
  owingOnly?: boolean;
};

export type ChargeRowDTO = {
  id: number;
  referenceNumber: string | null;
  memberId: number;
  memberNumber: string;
  memberName: string;
  categoryId: number;
  categoryName: string;
  categoryType: string;
  amount: MoneyValue;
  paid: MoneyValue;
  balance: MoneyValue;
  status: string;
  dueDate: IsoDateString | null;
  createdAt: IsoDateString;
};

export type Pagination = { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };

export type ChargeListDTO = {
  charges: ChargeRowDTO[];
  totals: { count: number; amount: MoneyValue; paid: MoneyValue; balance: MoneyValue };
  pagination: Pagination;
};

/** paymentMethod is a method name, or "unspecified" for payments recorded without one. */
export type PaymentListParams = { startDate?: string; endDate?: string; categoryId?: number; categoryType?: ChargeCategoryType; memberId?: number; paymentMethod?: string };

export type PaymentRowDTO = {
  id: number;
  amountPaid: MoneyValue;
  paymentDate: IsoDateString;
  paymentMethod: string | null;
  receiptNumber: string | null;
  chargeId: number;
  chargeReference: string | null;
  chargeVoided: boolean;
  memberId: number;
  memberNumber: string;
  memberName: string;
  categoryId: number;
  categoryName: string;
  categoryType: string;
};

export type PaymentListDTO = {
  payments: PaymentRowDTO[];
  totals: { count: number; amount: MoneyValue };
  pagination: Pagination;
};

// ---------------------------------------------------------------- exports

export type ExportFormat = 'pdf' | 'excel';

export type ExportResultDTO = {
  id: number;
  filename: string;
  format: ExportFormat;
  type: string;
  fileSize: number;
  downloadUrl: string;
  expiresAt: IsoDateString;
};

export type ExportHistoryItemDTO = {
  id: number;
  type: string;
  format: ExportFormat;
  filename: string;
  fileSize: number;
  downloadUrl: string;
  createdAt: IsoDateString;
  expiresAt: IsoDateString;
  createdBy: { id: number; name: string; email: string };
};

export type ExportHistoryDTO = { exports: ExportHistoryItemDTO[]; pagination: Pagination };

export type FinancialExportPayload = { format: ExportFormat; period?: ReportPeriod; startDate?: string; endDate?: string; includeComparison?: boolean };
export type MembersExportPayload = { format: 'excel'; status?: 'all' | 'with_balance' | 'overdue' };
export type StatementExportPayload = { format: 'pdf'; startDate?: string; endDate?: string };
