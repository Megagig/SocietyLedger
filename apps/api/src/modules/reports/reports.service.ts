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
import { generateAgingAnalysis, generateCategoryReport, generateCollectionRate, generateFinancialSummary, generateMemberBalances, resolveRange } from './reports-core.service';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * The start and end of a period (Lagos time), or of a custom range. Kept under this name for the accounting reports that use it.
 */
export function getDateRange(filter: DateRangeFilter): { startDate: Date; endDate: Date; label: string } {
  return resolveRange(filter);
}


// ============================================
// REPORT SERVICE
// ============================================

export const reportsService = {
  // The five reports (and the lists behind their figures) live in reports-core.service.ts
  generateFinancialSummary: generateFinancialSummary,
  generateMemberBalances: generateMemberBalances,
  generateAgingAnalysis: generateAgingAnalysis,
  generateCollectionRate: generateCollectionRate,
  generateCategoryReport: generateCategoryReport,


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

