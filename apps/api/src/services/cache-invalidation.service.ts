/**
 * Cache Invalidation Service
 * Phase 12: Caching & Performance
 * 
 * Centralized cache invalidation for all data changes.
 * Call these methods from controllers/services when data is modified.
 */

import { cacheService, CACHE_PREFIX } from './cache.service';
import { cachedDashboardService } from '../modules/dashboard/dashboard-cached.service';
import { cachedReportsService } from '../modules/reports/reports-cached.service';

export const cacheInvalidationService = {
  /**
   * Invalidate cache when a member is created, updated, or deleted
   */
  async onMemberChange(associationId: number): Promise<void> {
    await Promise.all([
      cachedDashboardService.invalidateMemberData(associationId),
      cachedReportsService.invalidateMemberReports(associationId),
      cacheService.deletePattern(`${CACHE_PREFIX.MEMBER}:${associationId}:*`),
    ]);
  },

  /**
   * Invalidate cache when a transaction is created, updated, or deleted
   */
  async onTransactionChange(associationId: number): Promise<void> {
    await Promise.all([
      cachedDashboardService.invalidateFinanceData(associationId),
      cachedReportsService.invalidateFinancialReports(associationId),
      cacheService.deletePattern(`${CACHE_PREFIX.FINANCE}:${associationId}:*`),
    ]);
  },

  /**
   * Invalidate cache when a payment is recorded
   */
  async onPaymentChange(associationId: number): Promise<void> {
    await Promise.all([
      cachedDashboardService.invalidateFinanceData(associationId),
      cachedReportsService.invalidateAllReports(associationId),
      cacheService.deletePattern(`${CACHE_PREFIX.FINANCE}:${associationId}:*`),
    ]);
  },

  /**
   * Invalidate cache when financial categories change
   */
  async onCategoryChange(associationId: number): Promise<void> {
    await Promise.all([
      cachedReportsService.invalidateFinancialReports(associationId),
      cacheService.deletePattern(`${CACHE_PREFIX.FINANCE}:${associationId}:categories:*`),
    ]);
  },

  /**
   * Invalidate cache when settings change
   */
  async onSettingsChange(associationId: number): Promise<void> {
    await cacheService.deletePattern(`${CACHE_PREFIX.SETTINGS}:${associationId}:*`);
  },

  /**
   * Invalidate all cache for an association (use sparingly)
   */
  async invalidateAll(associationId: number): Promise<void> {
    await Promise.all([
      cachedDashboardService.invalidateDashboard(associationId),
      cachedReportsService.invalidateAllReports(associationId),
      cacheService.invalidateTenant(associationId),
    ]);
  },

  /**
   * Invalidate session cache for a user
   */
  async onUserSessionChange(userId: number): Promise<void> {
    await cacheService.deletePattern(`${CACHE_PREFIX.SESSION}:user:${userId}:*`);
  },

  /**
   * Bulk invalidation for multiple associations
   */
  async invalidateMultiple(associationIds: number[]): Promise<void> {
    await Promise.all(
      associationIds.map(id => this.invalidateAll(id))
    );
  },
};

export default cacheInvalidationService;
