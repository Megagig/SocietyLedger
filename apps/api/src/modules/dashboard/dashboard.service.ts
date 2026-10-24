/**
 * Dashboard Service
 * Phase 20: Dashboard Real-Data Integration
 * 
 * Aggregates all dashboard data in a single call to avoid N+1 API requests.
 * All queries are scoped by associationId for tenant isolation.
 */

import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { COUNTED_CHARGE, monthRange, periodRange } from '../reports/report-rules';
import { generateAgingAnalysis } from '../reports/reports-core.service';
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
    const startOfMonth = periodRange('this_month').startDate;

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
   *
   * Every figure here is worked out the way the reports and the lists behind them work it out (see reports/report-rules.ts), so a
   * tile on Home and the list it opens always add up to the same number:
   *  - inflow is every payment ever received; this month's is every payment dated in this month (Lagos);
   *  - outstanding is what is still owed on charges that are not voided, not waived and not for a disabled member;
   *  - overdue is the owing charges past their due date, pending the owing ones not yet due.
   */
  async getFinancialSummary(associationId: number): Promise<FinancialSummary> {
    const month = periodRange('this_month');

    const [allPaid, thisMonthPaid, expected, owing] = await Promise.all([
      prisma.payment.aggregate({ where: { associationId }, _sum: { amountPaid: true } }),
      prisma.payment.aggregate({ where: { associationId, paymentDate: { gte: month.startDate, lte: month.endDate } }, _sum: { amountPaid: true } }),
      prisma.transaction.aggregate({ where: { associationId, ...COUNTED_CHARGE }, _sum: { amount: true } }),
      generateAgingAnalysis(associationId, new Date(), false),
    ]);

    const totalCollected = new Decimal(allPaid._sum.amountPaid || 0);
    const totalExpected = new Decimal(expected._sum.amount || 0);
    const { notYetDue, current, days31to60, days61to90, over90 } = owing.buckets;
    const collectionRate = totalExpected.isZero() ? 0 : totalCollected.dividedBy(totalExpected).times(100).toNumber();

    return {
      totalInflow: totalCollected,
      totalOutflow: new Decimal(0), // Expenses are kept in Accounting, not here
      currentBalance: totalCollected, // Simplified - actual balance would need expense tracking
      outstandingDues: owing.summary.totalOutstanding,
      pendingPayments: notYetDue.count,
      overduePayments: current.count + days31to60.count + days61to90.count + over90.count,
      thisMonthInflow: new Decimal(thisMonthPaid._sum.amountPaid || 0),
      collectionRate: Math.min(100, Math.round(collectionRate * 10) / 10),
    };
  },

  /**
   * TASK-DASH-004: Get revenue trend (last 6 months)
   * Revenue is the money that came in during each month (Lagos), expected is what was charged in it. Each month carries its dates so
   * its bar can open the payments in it.
   */
  async getRevenueTrend(associationId: number, months: number = 6): Promise<RevenueTrendItem[]> {
    const result: RevenueTrendItem[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const m = monthRange(i);
      const [paid, raised] = await Promise.all([
        prisma.payment.aggregate({ where: { associationId, paymentDate: { gte: m.startDate, lte: m.endDate } }, _sum: { amountPaid: true } }),
        prisma.transaction.aggregate({ where: { associationId, ...COUNTED_CHARGE, createdAt: { gte: m.startDate, lte: m.endDate } }, _sum: { amount: true } }),
      ]);
      result.push({
        month: m.shortLabel,
        year: m.year,
        revenue: new Decimal(paid._sum.amountPaid || 0),
        expected: new Decimal(raised._sum.amount || 0),
        startDate: m.startDate,
        endDate: m.endDate,
      });
    }
    return result;
  },

  /**
   * TASK-DASH-005: Get payment methods distribution
   * Every payment is counted, including those recorded without a method (shown as "Not recorded"), so the slices add up to all the
   * money received and each slice can open its payments.
   */
  async getPaymentMethods(associationId: number): Promise<PaymentMethodItem[]> {
    const payments = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: { associationId },
      _count: { id: true },
      _sum: { amountPaid: true },
    });

    const totalAmount = payments.reduce((sum, p) => sum.plus(p._sum.amountPaid || 0), new Decimal(0));

    const result: PaymentMethodItem[] = payments.map((p) => {
      const method = p.paymentMethod ?? 'unspecified';
      const config = p.paymentMethod ? PAYMENT_METHOD_CONFIG[method] || { name: method, color: '#6b7280' } : { name: 'Not recorded', color: '#6b7280' };
      const amount = new Decimal(p._sum.amountPaid || 0);
      const percentage = totalAmount.isZero() ? 0 : amount.dividedBy(totalAmount).times(100).toNumber();
      return { method, name: config.name, count: p._count.id, amount, percentage: Math.round(percentage), color: config.color };
    });

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
    const startOfMonth = periodRange('this_month').startDate;
    const startOfPrevMonth = periodRange('last_month').startDate;
    const endOfPrevMonth = periodRange('last_month').endDate;

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
        ...COUNTED_CHARGE,
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
        ...COUNTED_CHARGE,
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
