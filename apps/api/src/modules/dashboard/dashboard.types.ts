/**
 * Dashboard Types
 * Phase 20: Dashboard Real-Data Integration
 * 
 * TypeScript interfaces for dashboard data structures
 */

import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// MEMBER STATISTICS
// ============================================

export interface MemberStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  terminated: number;
  newThisMonth: number;
}

// ============================================
// FINANCIAL SUMMARY
// ============================================

export interface FinancialSummary {
  totalInflow: Decimal;
  totalOutflow: Decimal;
  currentBalance: Decimal;
  outstandingDues: Decimal;
  pendingPayments: number;
  overduePayments: number;
  thisMonthInflow: Decimal;
  collectionRate: number;
}

// ============================================
// REVENUE TREND
// ============================================

export interface RevenueTrendItem {
  month: string;
  year: number;
  revenue: Decimal;
  expected: Decimal;
}

// ============================================
// PAYMENT METHODS
// ============================================

export interface PaymentMethodItem {
  method: string;
  name: string;
  count: number;
  amount: Decimal;
  percentage: number;
  color: string;
}

// ============================================
// RECENT TRANSACTIONS
// ============================================

export interface RecentTransaction {
  id: number;
  memberName: string;
  amount: Decimal;
  paidAmount: Decimal;
  status: string;
  date: Date;
  category: string;
  categoryType: string;
}

// ============================================
// QUICK STATS
// ============================================

export interface QuickStats {
  activeMembers: number;
  activeMembersChange: number;
  thisMonthRevenue: Decimal;
  thisMonthRevenueChange: number;
  collectionRate: number;
  collectionRateChange: number;
}

// ============================================
// DASHBOARD OVERVIEW (AGGREGATED RESPONSE)
// ============================================

export interface DashboardOverview {
  memberStats: MemberStats;
  financialSummary: FinancialSummary;
  revenueTrend: RevenueTrendItem[];
  paymentMethods: PaymentMethodItem[];
  recentTransactions: RecentTransaction[];
  quickStats: QuickStats;
  generatedAt: Date;
}

// ============================================
// PAYMENT METHOD DISPLAY CONFIG
// ============================================

export const PAYMENT_METHOD_CONFIG: Record<string, { name: string; color: string }> = {
  bank_transfer: { name: 'Bank Transfer', color: '#14b8a6' },
  cash: { name: 'Cash', color: '#f59e0b' },
  mobile_money: { name: 'Mobile Money', color: '#8b5cf6' },
  card: { name: 'Card', color: '#3b82f6' },
  cheque: { name: 'Cheque', color: '#ef4444' },
  other: { name: 'Other', color: '#6b7280' },
};
