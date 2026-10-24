import { client } from '../client';
import { unwrap } from '../envelope';

export type MemberStats = {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  terminated: number;
  newThisMonth: number;
};

export type FinancialSummary = {
  totalInflow: string;
  totalOutflow: string;
  currentBalance: string;
  outstandingDues: string;
  pendingPayments: number;
  overduePayments: number;
  thisMonthInflow: string;
  collectionRate: number;
};

export type RevenueTrendItem = {
  month: string;
  year: number;
  revenue: string;
  expected: string;
};

export type PaymentMethodItem = {
  method: string;
  name: string;
  count: number;
  amount: string;
  percentage: number;
  color: string;
};

export type RecentTransaction = {
  id: number;
  memberName: string;
  amount: string;
  paidAmount: string;
  status: string;
  date: string;
  category: string;
  categoryType: string;
};

export type QuickStats = {
  activeMembers: number;
  activeMembersChange: number;
  thisMonthRevenue: string;
  thisMonthRevenueChange: number;
  collectionRate: number;
  collectionRateChange: number;
};

export type DashboardOverviewDTO = {
  memberStats: MemberStats;
  financialSummary: FinancialSummary;
  revenueTrend: RevenueTrendItem[];
  paymentMethods: PaymentMethodItem[];
  recentTransactions: RecentTransaction[];
  quickStats: QuickStats;
  generatedAt: string;
};

export const dashboardApi = {
  /** GET /dashboard/overview — officer-only; requires ledger.view. */
  async getOverview(): Promise<DashboardOverviewDTO> {
    return unwrap<DashboardOverviewDTO>(client.get('/dashboard/overview'));
  },
};

export type AttentionKey =
  | 'paymentProofs'
  | 'bankTransfers'
  | 'memberApprovals'
  | 'cashLodgments'
  | 'overdueCharges'
  | 'supportTickets'
  | 'loanApplications'
  | 'loanRepayments'
  | 'savingsDeposits'
  | 'welfarePayouts'
  | 'welfareContributions'
  | 'electionNominations'
  | 'electionsToClose'
  | 'electionResults';

export type AttentionItemDTO = { key: AttentionKey; count: number };

export const attentionApi = {
  /** GET /dashboard/attention — only the queues the caller may open, and only those with something waiting. */
  async getAttention(): Promise<AttentionItemDTO[]> {
    const data = await unwrap<{ items: AttentionItemDTO[] }>(client.get('/dashboard/attention'));
    return data.items;
  },
};
