/**
 * Dashboard Service
 * Phase 20: Dashboard Real-Data Integration
 * 
 * Aggregates all dashboard data in a single call to avoid N+1 API requests.
 * All queries are scoped by associationId for tenant isolation.
 */

import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  DashboardOverview,
  MemberStats,
  FinancialSummary,
  RevenueTrendItem,
  PaymentMethodItem,
  RecentTransaction,
  QuickStats,
  PAYMENT_METHOD_CONFIG,
} from './dashboard.types';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the start of the current month
 */
function getStartOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get the start of the previous month
 */
function getStartOfPreviousMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

/**
 * Get the end of the previous month
 */
function getEndOfPreviousMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59);
}

/**
 * Calculate percentage change between two values
 */
function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

// ============================================
// DASHBOARD SERVICE
// ============================================

export const dashboardService = {
  /**
   * TASK-DASH-001: Get complete dashboard overview
   * Aggregates all dashboard data in a single call
   */
  async getDashboardOverview(associationId: number): Promise<DashboardOverview> {
    // Run all queries in parallel for better performance
    const [
      memberStats,
      financialSummary,
      revenueTrend,
      paymentMethods,
      recentTransactions,
      quickStats,
    ] = await Promise.all([
      this.getMemberStats(associationId),
      this.getFinancialSummary(associationId),
      this.getRevenueTrend(associationId),
      this.getPaymentMethods(associationId),
      this.getRecentTransactions(associationId),
      this.getQuickStats(associationId),
    ]);

    return {
      memberStats,
      financialSummary,
      revenueTrend,
      paymentMethods,
      recentTransactions,
      quickStats,
      generatedAt: new Date(),
    };
  },


  /**
   * TASK-DASH-002: Get member statistics
   */
  async getMemberStats(associationId: number): Promise<MemberStats> {
    const startOfMonth = getStartOfMonth();

    // Get counts by status
    const statusCounts = await prisma.member.groupBy({
      by: ['status'],
      where: { associationId },
      _count: { id: true },
    });

    // Get new members this month
    const newThisMonth = await prisma.member.count({
      where: {
        associationId,
        createdAt: { gte: startOfMonth },
      },
    });

    // Map status counts
    const countMap: Record<string, number> = {};
    statusCounts.forEach(item => {
      countMap[item.status] = item._count.id;
    });

    const total = Object.values(countMap).reduce((sum, count) => sum + count, 0);

    return {
      total,
      active: countMap['active'] || 0,
      inactive: countMap['inactive'] || 0,
      suspended: countMap['suspended'] || 0,
      terminated: countMap['terminated'] || 0,
      newThisMonth,
    };
  },

  /**
   * TASK-DASH-003: Get financial summary
   */
  async getFinancialSummary(associationId: number): Promise<FinancialSummary> {
    const startOfMonth = getStartOfMonth();

    // Get all transactions with their payments
    const transactions = await prisma.transaction.findMany({
      where: { associationId },
      include: {
        payments: { select: { amountPaid: true, paymentDate: true } },
      },
    });

    let totalExpected = new Decimal(0);
    let totalCollected = new Decimal(0);
    let thisMonthInflow = new Decimal(0);
    let pendingPayments = 0;
    let overduePayments = 0;

    transactions.forEach(txn => {
      totalExpected = totalExpected.plus(txn.amount);
      
      txn.payments.forEach(payment => {
        totalCollected = totalCollected.plus(payment.amountPaid);
        
        // Check if payment was this month
        if (payment.paymentDate >= startOfMonth) {
          thisMonthInflow = thisMonthInflow.plus(payment.amountPaid);
        }
      });

      // Count pending and overdue
      if (txn.status === 'pending' || txn.status === 'partial') {
        pendingPayments++;
      }
      if (txn.status === 'overdue') {
        overduePayments++;
      }
    });

    const outstandingDues = totalExpected.minus(totalCollected);
    const collectionRate = totalExpected.isZero() 
      ? 0 
      : totalCollected.dividedBy(totalExpected).times(100).toNumber();

    return {
      totalInflow: totalCollected,
      totalOutflow: new Decimal(0), // Expenses not tracked in current model
      currentBalance: totalCollected, // Simplified - actual balance would need expense tracking
      outstandingDues,
      pendingPayments,
      overduePayments,
      thisMonthInflow,
      collectionRate: Math.round(collectionRate * 10) / 10,
    };
  },

  /**
   * TASK-DASH-004: Get revenue trend (last 6 months)
   */
  async getRevenueTrend(associationId: number, months: number = 6): Promise<RevenueTrendItem[]> {
    const now = new Date();
    const result: RevenueTrendItem[] = [];

    // Generate data for each of the last N months
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      // Get transactions created in this month
      const transactions = await prisma.transaction.findMany({
        where: {
          associationId,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        include: {
          payments: {
            where: { paymentDate: { gte: monthStart, lte: monthEnd } },
            select: { amountPaid: true },
          },
        },
      });

      let expected = new Decimal(0);
      let revenue = new Decimal(0);

      transactions.forEach(txn => {
        expected = expected.plus(txn.amount);
        txn.payments.forEach(p => {
          revenue = revenue.plus(p.amountPaid);
        });
      });

      // Also get payments from previous transactions that were paid this month
      const additionalPayments = await prisma.payment.findMany({
        where: {
          transaction: { associationId },
          paymentDate: { gte: monthStart, lte: monthEnd },
        },
        select: { amountPaid: true },
      });

      // Add payments not already counted
      const additionalRevenue = additionalPayments.reduce(
        (sum, p) => sum.plus(p.amountPaid),
        new Decimal(0)
      );

      result.push({
        month: monthStart.toLocaleString('default', { month: 'short' }),
        year: monthStart.getFullYear(),
        revenue: revenue.plus(additionalRevenue.minus(revenue).greaterThan(0) ? additionalRevenue.minus(revenue) : new Decimal(0)),
        expected,
      });
    }

    return result;
  },


  /**
   * TASK-DASH-005: Get payment methods distribution
   */
  async getPaymentMethods(associationId: number): Promise<PaymentMethodItem[]> {
    // Get payments grouped by method
    const payments = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: {
        transaction: { associationId },
      },
      _count: { id: true },
      _sum: { amountPaid: true },
    });

    // Calculate total for percentages
    const totalAmount = payments.reduce(
      (sum, p) => sum.plus(p._sum.amountPaid || 0),
      new Decimal(0)
    );

    // Map to response format
    const result: PaymentMethodItem[] = payments.map(p => {
      const config = PAYMENT_METHOD_CONFIG[p.paymentMethod] || { 
        name: p.paymentMethod, 
        color: '#6b7280' 
      };
      const amount = new Decimal(p._sum.amountPaid || 0);
      const percentage = totalAmount.isZero() 
        ? 0 
        : amount.dividedBy(totalAmount).times(100).toNumber();

      return {
        method: p.paymentMethod,
        name: config.name,
        count: p._count.id,
        amount,
        percentage: Math.round(percentage),
        color: config.color,
      };
    });

    // Sort by amount descending
    result.sort((a, b) => b.amount.comparedTo(a.amount));

    return result;
  },

  /**
   * TASK-DASH-006: Get recent transactions
   */
  async getRecentTransactions(associationId: number, limit: number = 10): Promise<RecentTransaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: { associationId },
      include: {
        member: { select: { firstName: true, lastName: true } },
        category: { select: { name: true, type: true } },
        payments: { select: { amountPaid: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return transactions.map(txn => {
      const paidAmount = txn.payments.reduce(
        (sum, p) => sum.plus(p.amountPaid),
        new Decimal(0)
      );

      return {
        id: txn.id,
        memberName: `${txn.member.firstName} ${txn.member.lastName}`,
        amount: new Decimal(txn.amount),
        paidAmount,
        status: txn.status,
        date: txn.createdAt,
        category: txn.category.name,
        categoryType: txn.category.type,
      };
    });
  },

  /**
   * TASK-DASH-007: Get quick stats with month-over-month comparison
   */
  async getQuickStats(associationId: number): Promise<QuickStats> {
    const startOfMonth = getStartOfMonth();
    const startOfPrevMonth = getStartOfPreviousMonth();
    const endOfPrevMonth = getEndOfPreviousMonth();

    // Current month active members
    const currentActiveMembers = await prisma.member.count({
      where: { associationId, status: 'active' },
    });

    // Previous month active members (approximate - members active at end of prev month)
    const prevActiveMembers = await prisma.member.count({
      where: {
        associationId,
        status: 'active',
        createdAt: { lte: endOfPrevMonth },
      },
    });

    // This month's revenue
    const thisMonthPayments = await prisma.payment.aggregate({
      where: {
        transaction: { associationId },
        paymentDate: { gte: startOfMonth },
      },
      _sum: { amountPaid: true },
    });

    // Previous month's revenue
    const prevMonthPayments = await prisma.payment.aggregate({
      where: {
        transaction: { associationId },
        paymentDate: { gte: startOfPrevMonth, lte: endOfPrevMonth },
      },
      _sum: { amountPaid: true },
    });

    const thisMonthRevenue = new Decimal(thisMonthPayments._sum.amountPaid || 0);
    const prevMonthRevenue = new Decimal(prevMonthPayments._sum.amountPaid || 0);

    // Collection rate this month
    const thisMonthTransactions = await prisma.transaction.aggregate({
      where: {
        associationId,
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    const thisMonthExpected = new Decimal(thisMonthTransactions._sum.amount || 0);
    const collectionRate = thisMonthExpected.isZero()
      ? 0
      : thisMonthRevenue.dividedBy(thisMonthExpected).times(100).toNumber();

    // Previous month collection rate
    const prevMonthTransactions = await prisma.transaction.aggregate({
      where: {
        associationId,
        createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth },
      },
      _sum: { amount: true },
    });

    const prevMonthExpected = new Decimal(prevMonthTransactions._sum.amount || 0);
    const prevCollectionRate = prevMonthExpected.isZero()
      ? 0
      : prevMonthRevenue.dividedBy(prevMonthExpected).times(100).toNumber();

    return {
      activeMembers: currentActiveMembers,
      activeMembersChange: calculatePercentageChange(currentActiveMembers, prevActiveMembers),
      thisMonthRevenue,
      thisMonthRevenueChange: calculatePercentageChange(
        thisMonthRevenue.toNumber(),
        prevMonthRevenue.toNumber()
      ),
      collectionRate: Math.round(collectionRate * 10) / 10,
      collectionRateChange: Math.round((collectionRate - prevCollectionRate) * 10) / 10,
    };
  },
};
