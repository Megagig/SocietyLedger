/**
 * Dashboard API Client
 * Phase 20: Dashboard Real-Data Integration
 * 
 * API client functions for fetching dashboard data
 */

import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';

// ============================================
// TYPES
// ============================================

export interface MemberStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  terminated: number;
  newThisMonth: number;
}

export interface FinancialSummary {
  totalInflow: string;
  totalOutflow: string;
  currentBalance: string;
  outstandingDues: string;
  pendingPayments: number;
  overduePayments: number;
  thisMonthInflow: string;
  collectionRate: number;
}

export interface RevenueTrendItem {
  month: string;
  year: number;
  revenue: string;
  expected: string;
}

export interface PaymentMethodItem {
  method: string;
  name: string;
  count: number;
  amount: string;
  percentage: number;
  color: string;
}

export interface RecentTransaction {
  id: number;
  memberName: string;
  amount: string;
  paidAmount: string;
  status: string;
  date: string;
  category: string;
  categoryType: string;
}

export interface QuickStats {
  activeMembers: number;
  activeMembersChange: number;
  thisMonthRevenue: string;
  thisMonthRevenueChange: number;
  collectionRate: number;
  collectionRateChange: number;
}

export interface DashboardOverview {
  memberStats: MemberStats;
  financialSummary: FinancialSummary;
  revenueTrend: RevenueTrendItem[];
  paymentMethods: PaymentMethodItem[];
  recentTransactions: RecentTransaction[];
  quickStats: QuickStats;
  generatedAt: string;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardOverview;
  message?: string;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetch dashboard overview data
 * GET /api/dashboard/overview
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const response = await api.get<DashboardResponse>('/dashboard/overview');

  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to fetch dashboard data');
  }

  return response.data.data;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format currency value for display
 */
export function formatCurrency(value: string | number, currency: string = '₦'): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return `${currency}${numValue.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format percentage change with sign
 */
export function formatPercentageChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value}%`;
}

/**
 * Get status color class
 */
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'pending':
    case 'partial':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'waived':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

// ============================================
// NEEDS YOUR ATTENTION
// ============================================

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
  | 'welfarePayouts';

export interface AttentionItem {
  key: AttentionKey;
  count: number;
}

/**
 * What is waiting on the signed-in officer, one count per queue they may open.
 * GET /api/dashboard/attention
 */
export async function getDashboardAttention(): Promise<AttentionItem[]> {
  const response = await api.get<{ success: boolean; message?: string; data: { items: AttentionItem[] } }>('/dashboard/attention');
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to fetch what needs attention');
  }
  return response.data.data.items;
}
