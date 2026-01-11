import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  DateRangeFilter,
  FinancialSummaryReport,
  MemberBalanceReport,
  AgingAnalysisReport,
  AgingBucket,
  CollectionRateReport,
  CategoryReport,
} from './reports.types';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get date range based on period or custom dates
 */
export function getDateRange(filter: DateRangeFilter): { startDate: Date; endDate: Date; label: string } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let label: string;

  if (filter.period) {
    switch (filter.period) {
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        label = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
        break;

      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        label = `${startDate.toLocaleString('default', { month: 'long' })} ${startDate.getFullYear()}`;
        break;

      case 'this_quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59);
        label = `Q${currentQuarter + 1} ${now.getFullYear()}`;
        break;

      case 'last_quarter':
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        const quarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
        startDate = new Date(quarterYear, adjustedQuarter * 3, 1);
        endDate = new Date(quarterYear, (adjustedQuarter + 1) * 3, 0, 23, 59, 59);
        label = `Q${adjustedQuarter + 1} ${quarterYear}`;
        break;

      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        label = `${now.getFullYear()}`;
        break;

      case 'last_year':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        label = `${now.getFullYear() - 1}`;
        break;

      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        label = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
    }
  } else if (filter.startDate && filter.endDate) {
    startDate = new Date(filter.startDate);
    endDate = new Date(filter.endDate);
    label = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  } else {
    // Default to current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    label = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
  }

  return { startDate, endDate, label };
}

/**
 * Get previous period for comparison
 */
function getPreviousPeriod(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
  const duration = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - duration);
  return { startDate: prevStartDate, endDate: prevEndDate };
}

/**
 * Calculate percentage change
 */
function calculatePercentageChange(current: Decimal, previous: Decimal): number {
  if (previous.isZero()) return current.isZero() ? 0 : 100;
  return current.minus(previous).dividedBy(previous).times(100).toNumber();
}

// ============================================
// REPORT SERVICE
// ============================================

export const reportsService = {
  /**
   * TASK-REP-002: Financial Summary Report
   * Returns income/expense totals, category breakdowns, period comparisons
   */
  async generateFinancialSummary(
    associationId: number,
    filter: DateRangeFilter,
    includeComparison: boolean = false
  ): Promise<FinancialSummaryReport> {
    const { startDate, endDate, label } = getDateRange(filter);

    // Get all transactions in the period
    const transactions = await prisma.transaction.findMany({
      where: {
        associationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        category: { select: { id: true, name: true, type: true } },
        payments: { select: { amountPaid: true } },
      },
    });

    // Categorize transactions by type
    const incomeTypes = ['due', 'levy', 'donation'];
    const expenseTypes = ['penalty']; // In a real system, you'd have expense categories

    const incomeByCategory: Record<number, { name: string; type: string; amount: Decimal; count: number }> = {};
    const expenseByCategory: Record<number, { name: string; type: string; amount: Decimal; count: number }> = {};

    let totalIncome = new Decimal(0);
    let totalExpenses = new Decimal(0);
    let totalExpected = new Decimal(0);
    let totalCollected = new Decimal(0);

    transactions.forEach(txn => {
      const collected = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
      totalExpected = totalExpected.plus(txn.amount);
      totalCollected = totalCollected.plus(collected);

      if (incomeTypes.includes(txn.category.type)) {
        totalIncome = totalIncome.plus(collected);
        if (!incomeByCategory[txn.category.id]) {
          incomeByCategory[txn.category.id] = {
            name: txn.category.name,
            type: txn.category.type,
            amount: new Decimal(0),
            count: 0,
          };
        }
        incomeByCategory[txn.category.id].amount = incomeByCategory[txn.category.id].amount.plus(collected);
        incomeByCategory[txn.category.id].count++;
      } else if (expenseTypes.includes(txn.category.type)) {
        totalExpenses = totalExpenses.plus(collected);
        if (!expenseByCategory[txn.category.id]) {
          expenseByCategory[txn.category.id] = {
            name: txn.category.name,
            type: txn.category.type,
            amount: new Decimal(0),
            count: 0,
          };
        }
        expenseByCategory[txn.category.id].amount = expenseByCategory[txn.category.id].amount.plus(collected);
        expenseByCategory[txn.category.id].count++;
      }
    });

    const collectionRate = totalExpected.isZero() 
      ? 0 
      : totalCollected.dividedBy(totalExpected).times(100).toNumber();

    const report: FinancialSummaryReport = {
      period: { startDate, endDate, label },
      income: {
        total: totalIncome,
        byCategory: Object.entries(incomeByCategory).map(([id, data]) => ({
          categoryId: parseInt(id),
          categoryName: data.name,
          categoryType: data.type,
          amount: data.amount,
          transactionCount: data.count,
        })),
      },
      expenses: {
        total: totalExpenses,
        byCategory: Object.entries(expenseByCategory).map(([id, data]) => ({
          categoryId: parseInt(id),
          categoryName: data.name,
          categoryType: data.type,
          amount: data.amount,
          transactionCount: data.count,
        })),
      },
      collections: {
        expected: totalExpected,
        collected: totalCollected,
        outstanding: totalExpected.minus(totalCollected),
        collectionRate,
      },
    };

    // Add comparison if requested
    if (includeComparison) {
      const prevPeriod = getPreviousPeriod(startDate, endDate);
      const prevTransactions = await prisma.transaction.findMany({
        where: {
          associationId,
          createdAt: { gte: prevPeriod.startDate, lte: prevPeriod.endDate },
        },
        include: {
          category: { select: { type: true } },
          payments: { select: { amountPaid: true } },
        },
      });

      let prevIncome = new Decimal(0);
      let prevExpenses = new Decimal(0);
      let prevCollected = new Decimal(0);

      prevTransactions.forEach(txn => {
        const collected = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
        prevCollected = prevCollected.plus(collected);

        if (incomeTypes.includes(txn.category.type)) {
          prevIncome = prevIncome.plus(collected);
        } else if (expenseTypes.includes(txn.category.type)) {
          prevExpenses = prevExpenses.plus(collected);
        }
      });

      report.comparison = {
        previousPeriod: {
          startDate: prevPeriod.startDate,
          endDate: prevPeriod.endDate,
          income: prevIncome,
          expenses: prevExpenses,
          collections: prevCollected,
        },
        changes: {
          income: {
            amount: totalIncome.minus(prevIncome),
            percentage: calculatePercentageChange(totalIncome, prevIncome),
          },
          expenses: {
            amount: totalExpenses.minus(prevExpenses),
            percentage: calculatePercentageChange(totalExpenses, prevExpenses),
          },
          collections: {
            amount: totalCollected.minus(prevCollected),
            percentage: calculatePercentageChange(totalCollected, prevCollected),
          },
        },
      };
    }

    return report;
  },

  /**
   * TASK-REP-003: Member Payment Status Report
   * Returns all members with their payment status, outstanding balances
   */
  async generateMemberBalances(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      status?: 'all' | 'with_balance' | 'overdue';
      search?: string;
      sortBy?: 'name' | 'balance' | 'lastPayment';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ members: MemberBalanceReport[]; pagination: any }> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    // Get all members with their transactions
    const whereClause: any = { associationId, status: 'active' };

    if (options.search) {
      whereClause.OR = [
        { firstName: { contains: options.search, mode: 'insensitive' } },
        { lastName: { contains: options.search, mode: 'insensitive' } },
        { memberId: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const members = await prisma.member.findMany({
      where: whereClause,
      include: {
        transactions: {
          include: {
            payments: { select: { amountPaid: true, paymentDate: true } },
          },
        },
      },
    });

    // Calculate balances for each member
    const memberBalances: MemberBalanceReport[] = members.map(member => {
      let totalDues = new Decimal(0);
      let totalPaid = new Decimal(0);
      let pendingCount = 0;
      let overdueCount = 0;
      let lastPaymentDate: Date | null = null;

      member.transactions.forEach(txn => {
        totalDues = totalDues.plus(txn.amount);
        const txnPaid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
        totalPaid = totalPaid.plus(txnPaid);

        if (txn.status === 'pending' || txn.status === 'partial') pendingCount++;
        if (txn.status === 'overdue') overdueCount++;

        // Track last payment date
        txn.payments.forEach(p => {
          if (!lastPaymentDate || p.paymentDate > lastPaymentDate) {
            lastPaymentDate = p.paymentDate;
          }
        });
      });

      const balance = totalDues.minus(totalPaid);

      return {
        memberId: member.id,
        memberNumber: member.memberId,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        totalDues,
        totalPaid,
        balance,
        pendingTransactions: pendingCount,
        overdueTransactions: overdueCount,
        lastPaymentDate,
        status: member.status,
      };
    });

    // Filter by status
    let filteredMembers = memberBalances;
    if (options.status === 'with_balance') {
      filteredMembers = memberBalances.filter(m => m.balance.greaterThan(0));
    } else if (options.status === 'overdue') {
      filteredMembers = memberBalances.filter(m => m.overdueTransactions > 0);
    }

    // Sort
    const sortBy = options.sortBy || 'balance';
    const sortOrder = options.sortOrder || 'desc';
    filteredMembers.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      } else if (sortBy === 'balance') {
        comparison = a.balance.comparedTo(b.balance);
      } else if (sortBy === 'lastPayment') {
        const aDate = a.lastPaymentDate?.getTime() || 0;
        const bDate = b.lastPaymentDate?.getTime() || 0;
        comparison = aDate - bDate;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const paginatedMembers = filteredMembers.slice(skip, skip + limit);

    return {
      members: paginatedMembers,
      pagination: {
        page,
        limit,
        totalCount: filteredMembers.length,
        totalPages: Math.ceil(filteredMembers.length / limit),
        hasMore: skip + paginatedMembers.length < filteredMembers.length,
      },
    };
  },

  /**
   * TASK-REP-004: Outstanding Balances with Aging Analysis
   * Returns outstanding amounts grouped by age (0-30, 31-60, 61-90, 90+ days)
   */
  async generateAgingAnalysis(
    associationId: number,
    asOfDate?: Date,
    includeDetails: boolean = true
  ): Promise<AgingAnalysisReport> {
    const analysisDate = asOfDate || new Date();

    // Get all outstanding transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        associationId,
        status: { in: ['pending', 'overdue', 'partial'] },
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        payments: { select: { amountPaid: true } },
      },
    });

    // Initialize buckets
    const buckets: Record<string, AgingBucket> = {
      current: { range: '0-30 days', minDays: 0, maxDays: 30, count: 0, amount: new Decimal(0), members: [] },
      days31to60: { range: '31-60 days', minDays: 31, maxDays: 60, count: 0, amount: new Decimal(0), members: [] },
      days61to90: { range: '61-90 days', minDays: 61, maxDays: 90, count: 0, amount: new Decimal(0), members: [] },
      over90: { range: '90+ days', minDays: 91, maxDays: null, count: 0, amount: new Decimal(0), members: [] },
    };

    let totalOutstanding = new Decimal(0);
    const memberMap: Record<number, { name: string; transactions: any[] }> = {};

    transactions.forEach(txn => {
      const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
      const balance = new Decimal(txn.amount).minus(paid);

      if (balance.lessThanOrEqualTo(0)) return;

      totalOutstanding = totalOutstanding.plus(balance);

      // Calculate days overdue
      const dueDate = txn.dueDate || txn.createdAt;
      const daysOverdue = Math.floor((analysisDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Determine bucket
      let bucket: AgingBucket;
      if (daysOverdue <= 30) bucket = buckets.current;
      else if (daysOverdue <= 60) bucket = buckets.days31to60;
      else if (daysOverdue <= 90) bucket = buckets.days61to90;
      else bucket = buckets.over90;

      bucket.count++;
      bucket.amount = bucket.amount.plus(balance);

      // Track by member for details
      if (includeDetails) {
        if (!memberMap[txn.member.id]) {
          memberMap[txn.member.id] = {
            name: `${txn.member.firstName} ${txn.member.lastName}`,
            transactions: [],
          };
        }
        memberMap[txn.member.id].transactions.push({
          balance,
          dueDate,
          daysOverdue,
          bucket: bucket.range,
        });
      }
    });

    // Aggregate member details by bucket
    if (includeDetails) {
      Object.entries(memberMap).forEach(([memberId, data]) => {
        const memberTransactions = data.transactions;
        const oldestTxn = memberTransactions.reduce((oldest, txn) => 
          txn.daysOverdue > oldest.daysOverdue ? txn : oldest
        );

        const memberTotal = memberTransactions.reduce(
          (sum, txn) => sum.plus(txn.balance),
          new Decimal(0)
        );

        const bucketKey = oldestTxn.bucket;
        const bucket = Object.values(buckets).find(b => b.range === bucketKey);
        
        if (bucket) {
          bucket.members.push({
            memberId: parseInt(memberId),
            memberName: data.name,
            amount: memberTotal,
            oldestDueDate: oldestTxn.dueDate,
            daysOverdue: oldestTxn.daysOverdue,
          });
        }
      });

      // Sort members by amount in each bucket
      Object.values(buckets).forEach(bucket => {
        bucket.members.sort((a, b) => b.amount.comparedTo(a.amount));
      });
    }

    return {
      asOfDate: analysisDate,
      summary: {
        totalOutstanding,
        totalMembers: Object.keys(memberMap).length,
        totalTransactions: transactions.length,
      },
      buckets: {
        current: buckets.current,
        days31to60: buckets.days31to60,
        days61to90: buckets.days61to90,
        over90: buckets.over90,
      },
    };
  },

  /**
   * TASK-REP-005: Collection Rate Report
   * Returns collection efficiency metrics over time
   */
  async generateCollectionRate(
    associationId: number,
    filter: DateRangeFilter,
    groupBy: 'month' | 'quarter' | 'year' = 'month'
  ): Promise<CollectionRateReport> {
    const { startDate, endDate, label } = getDateRange(filter);

    // Get all transactions in the period
    const transactions = await prisma.transaction.findMany({
      where: {
        associationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        category: { select: { id: true, name: true, type: true } },
        payments: { select: { amountPaid: true } },
      },
    });

    let totalExpected = new Decimal(0);
    let totalCollected = new Decimal(0);

    // Group by time period
    const byMonth: Record<string, { expected: Decimal; collected: Decimal }> = {};
    const byCategory: Record<number, { name: string; type: string; expected: Decimal; collected: Decimal }> = {};

    transactions.forEach(txn => {
      const collected = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
      totalExpected = totalExpected.plus(txn.amount);
      totalCollected = totalCollected.plus(collected);

      // Group by month
      const txnDate = new Date(txn.createdAt);
      const monthKey = `${txnDate.getFullYear()}-${String(txnDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { expected: new Decimal(0), collected: new Decimal(0) };
      }
      byMonth[monthKey].expected = byMonth[monthKey].expected.plus(txn.amount);
      byMonth[monthKey].collected = byMonth[monthKey].collected.plus(collected);

      // Group by category
      if (!byCategory[txn.category.id]) {
        byCategory[txn.category.id] = {
          name: txn.category.name,
          type: txn.category.type,
          expected: new Decimal(0),
          collected: new Decimal(0),
        };
      }
      byCategory[txn.category.id].expected = byCategory[txn.category.id].expected.plus(txn.amount);
      byCategory[txn.category.id].collected = byCategory[txn.category.id].collected.plus(collected);
    });

    const overallRate = totalExpected.isZero() 
      ? 0 
      : totalCollected.dividedBy(totalExpected).times(100).toNumber();

    return {
      period: { startDate, endDate, label },
      overall: {
        expected: totalExpected,
        collected: totalCollected,
        outstanding: totalExpected.minus(totalCollected),
        collectionRate: overallRate,
      },
      byMonth: Object.entries(byMonth)
        .map(([key, data]) => {
          const [year, month] = key.split('-');
          const rate = data.expected.isZero() 
            ? 0 
            : data.collected.dividedBy(data.expected).times(100).toNumber();
          return {
            month: new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long' }),
            year: parseInt(year),
            expected: data.expected,
            collected: data.collected,
            collectionRate: rate,
          };
        })
        .sort((a, b) => a.year - b.year),
      byCategory: Object.entries(byCategory).map(([id, data]) => {
        const rate = data.expected.isZero() 
          ? 0 
          : data.collected.dividedBy(data.expected).times(100).toNumber();
        return {
          categoryId: parseInt(id),
          categoryName: data.name,
          categoryType: data.type,
          expected: data.expected,
          collected: data.collected,
          collectionRate: rate,
        };
      }),
    };
  },

  /**
   * TASK-REP-006: Category-wise Report
   * Returns financial breakdown by category (dues, levies, donations, penalties)
   */
  async generateCategoryReport(
    associationId: number,
    options: {
      categoryId?: number;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      includeTransactions?: boolean;
      transactionLimit?: number;
    } = {}
  ): Promise<CategoryReport[]> {
    const whereClause: any = { associationId };

    if (options.categoryId) {
      whereClause.id = options.categoryId;
    }

    if (options.type) {
      whereClause.type = options.type;
    }

    const categories = await prisma.financialCategory.findMany({
      where: whereClause,
      include: {
        transactions: {
          where: {
            ...(options.startDate && options.endDate
              ? { createdAt: { gte: options.startDate, lte: options.endDate } }
              : {}),
          },
          include: {
            member: { select: { firstName: true, lastName: true } },
            payments: { select: { amountPaid: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: options.includeTransactions ? options.transactionLimit || 10 : 0,
        },
      },
    });

    const reports = await Promise.all(
      categories.map(async category => {
        let totalExpected = new Decimal(0);
        let totalCollected = new Decimal(0);
        const memberSet = new Set<number>();
        const byStatus: Record<string, { count: number; amount: Decimal }> = {
          pending: { count: 0, amount: new Decimal(0) },
          paid: { count: 0, amount: new Decimal(0) },
          overdue: { count: 0, amount: new Decimal(0) },
          partial: { count: 0, amount: new Decimal(0) },
          waived: { count: 0, amount: new Decimal(0) },
        };

        // Get all transactions for this category (not just the limited ones)
        const allTxns = await prisma.transaction.findMany({
          where: {
            categoryId: category.id,
            associationId,
            ...(options.startDate && options.endDate
              ? { createdAt: { gte: options.startDate, lte: options.endDate } }
              : {}),
          },
          include: {
            payments: { select: { amountPaid: true } },
          },
        });

        // Calculate stats from all transactions
        allTxns.forEach(txn => {
          totalExpected = totalExpected.plus(txn.amount);
          const collected = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
          totalCollected = totalCollected.plus(collected);
          memberSet.add(txn.memberId);

          if (byStatus[txn.status]) {
            byStatus[txn.status].count++;
            byStatus[txn.status].amount = byStatus[txn.status].amount.plus(txn.amount);
          }
        });

        const collectionRate = totalExpected.isZero() 
          ? 0 
          : totalCollected.dividedBy(totalExpected).times(100).toNumber();

        const recentTransactions = category.transactions.map(txn => {
          const paidAmount = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
          return {
            id: txn.id,
            referenceNumber: txn.referenceNumber || '',
            memberName: `${txn.member.firstName} ${txn.member.lastName}`,
            amount: txn.amount,
            paidAmount,
            balance: new Decimal(txn.amount).minus(paidAmount),
            status: txn.status,
            dueDate: txn.dueDate,
            createdAt: txn.createdAt,
          };
        });

        return {
          categoryId: category.id,
          categoryName: category.name,
          categoryType: category.type,
          isActive: category.isActive,
          statistics: {
            totalExpected,
            totalCollected,
            totalOutstanding: totalExpected.minus(totalCollected),
            collectionRate,
            transactionCount: allTxns.length,
            memberCount: memberSet.size,
          },
          byStatus,
          recentTransactions,
        };
      })
    );

    return reports;
  },

  /**
   * Get Welfare Financial Summary
   * Returns welfare contributions, payouts, and fund balances
   */
  async getWelfareFinancials(
    associationId: number,
    filter: DateRangeFilter
  ): Promise<{
    contributions: { total: Decimal; count: number };
    payouts: { total: Decimal; count: number };
    netBalance: Decimal;
    byFund: Array<{
      fundId: number;
      fundName: string;
      contributions: Decimal;
      payouts: Decimal;
      currentBalance: Decimal;
    }>;
  }> {
    const { startDate, endDate } = getDateRange(filter);

    // Get all welfare contributions in period
    const contributions = await prisma.welfareContribution.findMany({
      where: {
        associationId,
        status: 'CONFIRMED',
        contributionDate: { gte: startDate, lte: endDate },
      },
      include: {
        fund: { select: { id: true, name: true, currentBalance: true } },
      },
    });

    // Get all welfare payouts in period
    const payouts = await prisma.welfarePayoutRequest.findMany({
      where: {
        associationId,
        status: 'DISBURSED',
        disbursedAt: { gte: startDate, lte: endDate },
      },
      include: {
        fund: { select: { id: true, name: true, currentBalance: true } },
      },
    });

    // Calculate totals
    const totalContributions = contributions.reduce(
      (sum, c) => sum.plus(c.amount),
      new Decimal(0)
    );
    const totalPayouts = payouts.reduce(
      (sum, p) => sum.plus(p.approvedAmount || p.amount),
      new Decimal(0)
    );

    // Group by fund
    const fundMap = new Map<number, {
      fundId: number;
      fundName: string;
      contributions: Decimal;
      payouts: Decimal;
      currentBalance: Decimal;
    }>();

    contributions.forEach(c => {
      if (!fundMap.has(c.fundId)) {
        fundMap.set(c.fundId, {
          fundId: c.fundId,
          fundName: c.fund.name,
          contributions: new Decimal(0),
          payouts: new Decimal(0),
          currentBalance: c.fund.currentBalance,
        });
      }
      const fund = fundMap.get(c.fundId)!;
      fund.contributions = fund.contributions.plus(c.amount);
    });

    payouts.forEach(p => {
      if (!fundMap.has(p.fundId)) {
        fundMap.set(p.fundId, {
          fundId: p.fundId,
          fundName: p.fund.name,
          contributions: new Decimal(0),
          payouts: new Decimal(0),
          currentBalance: p.fund.currentBalance,
        });
      }
      const fund = fundMap.get(p.fundId)!;
      fund.payouts = fund.payouts.plus(p.approvedAmount || p.amount);
    });

    return {
      contributions: {
        total: totalContributions,
        count: contributions.length,
      },
      payouts: {
        total: totalPayouts,
        count: payouts.length,
      },
      netBalance: totalContributions.minus(totalPayouts),
      byFund: Array.from(fundMap.values()),
    };
  },

  /**
   * Get Cooperative Financial Summary
   * Returns savings, loans, repayments, and interest
   */
  async getCooperativeFinancials(
    associationId: number,
    filter: DateRangeFilter
  ): Promise<{
    savings: {
      deposits: Decimal;
      withdrawals: Decimal;
      netSavings: Decimal;
      accountCount: number;
    };
    loans: {
      disbursed: Decimal;
      repayments: Decimal;
      principalRepaid: Decimal;
      interestRepaid: Decimal;
      outstanding: Decimal;
      loanCount: number;
    };
  }> {
    const { startDate, endDate } = getDateRange(filter);

    // Get savings transactions
    const savingsTransactions = await prisma.savingsTransaction.findMany({
      where: {
        associationId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const deposits = savingsTransactions
      .filter(t => ['DEPOSIT', 'INTEREST', 'TRANSFER_IN'].includes(t.type))
      .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));

    const withdrawals = savingsTransactions
      .filter(t => ['WITHDRAWAL', 'TRANSFER_OUT', 'FEE'].includes(t.type))
      .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));

    // Get unique savings accounts
    const uniqueAccounts = new Set(savingsTransactions.map(t => t.savingsAccountId));

    // Get loans disbursed in period
    const loansDisbursed = await prisma.loan.findMany({
      where: {
        associationId,
        status: { in: ['ACTIVE', 'PAID_OFF'] },
        disbursedAt: { gte: startDate, lte: endDate },
      },
    });

    const totalDisbursed = loansDisbursed.reduce(
      (sum, l) => sum.plus(l.principalAmount),
      new Decimal(0)
    );

    // Get loan repayments in period
    const repayments = await prisma.loanRepayment.findMany({
      where: {
        associationId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const totalRepayments = repayments.reduce(
      (sum, r) => sum.plus(r.amount),
      new Decimal(0)
    );
    const totalPrincipal = repayments.reduce(
      (sum, r) => sum.plus(r.principalPortion),
      new Decimal(0)
    );
    const totalInterest = repayments.reduce(
      (sum, r) => sum.plus(r.interestPortion),
      new Decimal(0)
    );

    // Get total outstanding loans
    const activeLoans = await prisma.loan.findMany({
      where: {
        associationId,
        status: 'ACTIVE',
      },
      select: {
        outstandingBalance: true,
      },
    });

    const totalOutstanding = activeLoans.reduce(
      (sum, l) => sum.plus(l.outstandingBalance),
      new Decimal(0)
    );

    return {
      savings: {
        deposits,
        withdrawals,
        netSavings: deposits.minus(withdrawals),
        accountCount: uniqueAccounts.size,
      },
      loans: {
        disbursed: totalDisbursed,
        repayments: totalRepayments,
        principalRepaid: totalPrincipal,
        interestRepaid: totalInterest,
        outstanding: totalOutstanding,
        loanCount: loansDisbursed.length,
      },
    };
  },

  /**
   * Get Comprehensive Financial Summary
   * Combines Finance, Welfare, and Cooperative data
   */
  async getComprehensiveFinancialSummary(
    associationId: number,
    filter: DateRangeFilter
  ) {
    // Get data from all modules
    const [finance, welfare, cooperative] = await Promise.all([
      this.generateFinancialSummary(associationId, filter, false),
      this.getWelfareFinancials(associationId, filter),
      this.getCooperativeFinancials(associationId, filter),
    ]);

    // Calculate comprehensive totals
    const totalIncome = new Decimal(finance.income.total)
      .plus(welfare.contributions.total)
      .plus(cooperative.savings.deposits)
      .plus(cooperative.loans.repayments);

    const totalExpenses = new Decimal(finance.expenses.total)
      .plus(welfare.payouts.total)
      .plus(cooperative.savings.withdrawals)
      .plus(cooperative.loans.disbursed);

    const netIncome = totalIncome.minus(totalExpenses);

    return {
      finance,
      welfare,
      cooperative,
      totals: {
        totalIncome,
        totalExpenses,
        netIncome,
      },
    };
  },
};

