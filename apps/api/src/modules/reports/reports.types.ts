import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// REPORT TYPES
// ============================================

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
  period?: 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'custom';
}

export interface FinancialSummaryReport {
  period: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  income: {
    total: Decimal;
    byCategory: Array<{
      categoryId: number;
      categoryName: string;
      categoryType: string;
      amount: Decimal;
      transactionCount: number;
    }>;
  };
  expenses: {
    total: Decimal;
    byCategory: Array<{
      categoryId: number;
      categoryName: string;
      categoryType: string;
      amount: Decimal;
      transactionCount: number;
    }>;
  };
  collections: {
    expected: Decimal;
    collected: Decimal;
    outstanding: Decimal;
    collectionRate: number; // percentage
  };
  /** Money that came in during the period: every payment dated in it. `income.total` is this. */
  received?: { total: Decimal; paymentCount: number };
  /** Charges raised during the period (not voided, not waived). `collections.expected` is this. */
  raised?: { total: Decimal; chargeCount: number };
  comparison?: {
    previousPeriod: {
      startDate: Date;
      endDate: Date;
      income: Decimal;
      expenses: Decimal;
      collections: Decimal;
    };
    changes: {
      income: { amount: Decimal; percentage: number };
      expenses: { amount: Decimal; percentage: number };
      collections: { amount: Decimal; percentage: number };
    };
  };
}

export interface MemberBalanceReport {
  memberId: number;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  totalDues: Decimal;
  totalPaid: Decimal;
  balance: Decimal;
  pendingTransactions: number;
  overdueTransactions: number;
  lastPaymentDate: Date | null;
  status: string;
}

export interface AgingBucket {
  range: string;
  minDays: number;
  maxDays: number | null;
  count: number;
  amount: Decimal;
  members: Array<{
    memberId: number;
    memberName: string;
    amount: Decimal;
    oldestDueDate: Date;
    daysOverdue: number;
    chargeCount?: number;
  }>;
}

export interface AgingAnalysisReport {
  asOfDate: Date;
  summary: {
    totalOutstanding: Decimal;
    totalMembers: number;
    totalTransactions: number;
  };
  buckets: {
    notYetDue: AgingBucket;
    current: AgingBucket; // 1-30 days overdue
    days31to60: AgingBucket;
    days61to90: AgingBucket;
    over90: AgingBucket;
  };
}

export interface CollectionRateReport {
  period: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  overall: {
    expected: Decimal;
    collected: Decimal;
    outstanding: Decimal;
    collectionRate: number;
  };
  byMonth: Array<{
    key?: string;
    startDate?: Date;
    endDate?: Date;
    month: string;
    year: number;
    expected: Decimal;
    collected: Decimal;
    collectionRate: number;
  }>;
  byCategory: Array<{
    categoryId: number;
    categoryName: string;
    categoryType: string;
    expected: Decimal;
    collected: Decimal;
    collectionRate: number;
  }>;
}

export interface CategoryReport {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  isActive: boolean;
  statistics: {
    totalExpected: Decimal;
    totalCollected: Decimal;
    totalOutstanding: Decimal;
    collectionRate: number;
    transactionCount: number;
    memberCount: number;
  };
  byStatus: Record<string, { count: number; amount: Decimal }>;
  recentTransactions: Array<{
    id: number;
    referenceNumber: string;
    memberName: string;
    amount: Decimal;
    paidAmount: Decimal;
    balance: Decimal;
    status: string;
    dueDate: Date | null;
    createdAt: Date;
  }>;
}
