import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
  period?: 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'custom';
}

export const reportsApi = {
  /**
   * Get financial summary report
   */
  async getFinancialSummary(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
    includeComparison?: boolean;
  }) {
    const response = await api.get(`${API_URL}/api/reports/financial-summary`, { params });
    return response.data;
  },

  /**
   * Get member balances report
   */
  async getMemberBalances(params?: {
    page?: number;
    limit?: number;
    status?: 'all' | 'with_balance' | 'overdue';
    search?: string;
    sortBy?: 'name' | 'balance' | 'lastPayment';
    sortOrder?: 'asc' | 'desc';
  }) {
    const response = await api.get(`${API_URL}/api/reports/member-balances`, { params });
    return response.data;
  },

  /**
   * Get aging analysis report
   */
  async getAgingAnalysis(params?: {
    asOfDate?: string;
    includeDetails?: boolean;
  }) {
    const response = await api.get(`${API_URL}/api/reports/aging-analysis`, { params });
    return response.data;
  },

  /**
   * Get collection rate report
   */
  async getCollectionRate(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
    groupBy?: 'month' | 'quarter' | 'year';
  }) {
    const response = await api.get(`${API_URL}/api/reports/collection-rate`, { params });
    return response.data;
  },

  /**
   * Get category-wise report
   */
  async getCategoryReport(params?: {
    categoryId?: number;
    type?: 'due' | 'levy' | 'donation' | 'penalty';
    startDate?: string;
    endDate?: string;
    includeTransactions?: boolean;
    transactionLimit?: number;
  }) {
    const response = await api.get(`${API_URL}/api/reports/by-category`, { params });
    return response.data;
  },
};
