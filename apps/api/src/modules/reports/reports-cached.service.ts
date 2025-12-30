/**
 * Cached Reports Service
 * Phase 12: Caching & Performance
 * 
 * Wraps the reports service with caching layer.
 * Reports are cached longer since they're computationally expensive.
 */

import { reportsService, getDateRange } from './reports.service';
import { cacheService, CACHE_TTL, CACHE_PREFIX } from '../../services/cache.service';
import {
  DateRangeFilter,
  FinancialSummaryReport,
  MemberBalanceReport,
  AgingAnalysisReport,
  CollectionRateReport,
  CategoryReport,
} from './reports.types';

// Cache tags for reports
const REPORT_TAGS = {
  FINANCIAL: (associationId: number) => `report:financial:${associationId}`,
  MEMBERS: (associationId: number) => `report:members:${associationId}`,
  AGING: (associationId: number) => `report:aging:${associationId}`,
  COLLECTION: (associationId: number) => `report:collection:${associationId}`,
  CATEGORY: (associationId: number) => `report:category:${associationId}`,
};

/**
 * Generate a hash for filter options to use in cache key
 */
function hashFilter(filter: any): string {
  return Buffer.from(JSON.stringify(filter)).toString('base64').slice(0, 20);
}

export const cachedReportsService = {
  /**
   * Get financial summary with caching
   * TTL: 15 minutes (LONG)
   */
  async generateFinancialSummary(
    associationId: number,
    filter: DateRangeFilter,
    includeComparison: boolean = false
  ): Promise<FinancialSummaryReport> {
    const filterHash = hashFilter({ filter, includeComparison });
    const cacheKey = cacheService.generateKey(
      CACHE_PREFIX.REPORT,
      associationId,
      'financial-summary',
      filterHash
    );

    return cacheService.getOrSet(
      cacheKey,
      () => reportsService.generateFinancialSummary(associationId, filter, includeComparison),
      {
        ttl: CACHE_TTL.LONG,
        tags: [REPORT_TAGS.FINANCIAL(associationId)],
      }
    );
  },

  /**
   * Get member balances with caching
   * TTL: 10 minutes (between MEDIUM and LONG)
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
    const filterHash = hashFilter(options);
    const cacheKey = cacheService.generateKey(
      CACHE_PREFIX.REPORT,
      associationId,
      'member-balances',
      filterHash
    );

    return cacheService.getOrSet(
      cacheKey,
      () => reportsService.generateMemberBalances(associationId, options),
      {
        ttl: 600, // 10 minutes
        tags: [REPORT_TAGS.MEMBERS(associationId)],
      }
    );
  },

  /**
   * Get aging analysis with caching
   * TTL: 15 minutes (LONG)
   */
  async generateAgingAnalysis(
    associationId: number,
    asOfDate?: Date,
    includeDetails: boolean = true
  ): Promise<AgingAnalysisReport> {
    // Use today's date for cache key if not specified
    const dateKey = asOfDate 
      ? asOfDate.toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0];
    
    const cacheKey = cacheService.generateKey(
      CACHE_PREFIX.REPORT,
      associationId,
      'aging-analysis',
      dateKey,
      includeDetails ? 'detailed' : 'summary'
    );

    return cacheService.getOrSet(
      cacheKey,
      () => reportsService.generateAgingAnalysis(associationId, asOfDate, includeDetails),
      {
        ttl: CACHE_TTL.LONG,
        tags: [REPORT_TAGS.AGING(associationId)],
      }
    );
  },

  /**
   * Get collection rate with caching
   * TTL: 15 minutes (LONG)
   */
  async generateCollectionRate(
    associationId: number,
    filter: DateRangeFilter,
    groupBy: 'month' | 'quarter' | 'year' = 'month'
  ): Promise<CollectionRateReport> {
    const filterHash = hashFilter({ filter, groupBy });
    const cacheKey = cacheService.generateKey(
      CACHE_PREFIX.REPORT,
      associationId,
      'collection-rate',
      filterHash
    );

    return cacheService.getOrSet(
      cacheKey,
      () => reportsService.generateCollectionRate(associationId, filter, groupBy),
      {
        ttl: CACHE_TTL.LONG,
        tags: [REPORT_TAGS.COLLECTION(associationId)],
      }
    );
  },

  /**
   * Get category report with caching
   * TTL: 15 minutes (LONG)
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
    const filterHash = hashFilter(options);
    const cacheKey = cacheService.generateKey(
      CACHE_PREFIX.REPORT,
      associationId,
      'category',
      filterHash
    );

    return cacheService.getOrSet(
      cacheKey,
      () => reportsService.generateCategoryReport(associationId, options),
      {
        ttl: CACHE_TTL.LONG,
        tags: [REPORT_TAGS.CATEGORY(associationId)],
      }
    );
  },

  /**
   * Invalidate all report caches for an association
   */
  async invalidateAllReports(associationId: number): Promise<void> {
    await Promise.all([
      cacheService.invalidateByTag(REPORT_TAGS.FINANCIAL(associationId)),
      cacheService.invalidateByTag(REPORT_TAGS.MEMBERS(associationId)),
      cacheService.invalidateByTag(REPORT_TAGS.AGING(associationId)),
      cacheService.invalidateByTag(REPORT_TAGS.COLLECTION(associationId)),
      cacheService.invalidateByTag(REPORT_TAGS.CATEGORY(associationId)),
    ]);
  },

  /**
   * Invalidate financial reports only
   */
  async invalidateFinancialReports(associationId: number): Promise<void> {
    await Promise.all([
      cacheService.invalidateByTag(REPORT_TAGS.FINANCIAL(associationId)),
      cacheService.invalidateByTag(REPORT_TAGS.COLLECTION(associationId)),
      cacheService.invalidateByTag(REPORT_TAGS.CATEGORY(associationId)),
    ]);
  },

  /**
   * Invalidate member-related reports only
   */
  async invalidateMemberReports(associationId: number): Promise<void> {
    await Promise.all([
      cacheService.invalidateByTag(REPORT_TAGS.MEMBERS(associationId)),
      cacheService.invalidateByTag(REPORT_TAGS.AGING(associationId)),
    ]);
  },
};

export default cachedReportsService;
