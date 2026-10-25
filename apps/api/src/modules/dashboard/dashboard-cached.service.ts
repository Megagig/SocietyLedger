/**
 * Cached Dashboard Service
 * Phase 12: Caching & Performance
 * 
 * Wraps the dashboard service with caching layer.
 * Cache invalidation happens on financial data changes.
 */

import { dashboardService } from './dashboard.service';
import { cacheService, CACHE_TTL, CACHE_PREFIX } from '../../services/cache.service';
import { DashboardOverview } from './dashboard.types';

// Cache tags for dashboard data
const DASHBOARD_TAGS = {
  OVERVIEW: (associationId: number) => `dashboard:overview:${associationId}`,
  MEMBERS: (associationId: number) => `dashboard:members:${associationId}`,
  FINANCE: (associationId: number) => `dashboard:finance:${associationId}`,
};

export const cachedDashboardService = {
  /**
   * Get dashboard overview with caching
   * TTL: 1 minute (SHORT). Most writes clear it straight away; the few that do not (online payments, donations) show within a minute.
   */
  async getDashboardOverview(associationId: number): Promise<DashboardOverview> {
    const cacheKey = cacheService.generateKey(
      CACHE_PREFIX.DASHBOARD,
      associationId,
      'overview'
    );

    return cacheService.getOrSet(
      cacheKey,
      () => dashboardService.getDashboardOverview(associationId),
      {
        ttl: CACHE_TTL.SHORT,
        tags: [
          DASHBOARD_TAGS.OVERVIEW(associationId),
          DASHBOARD_TAGS.MEMBERS(associationId),
          DASHBOARD_TAGS.FINANCE(associationId),
        ],
      }
    );
  },

  /**
   * Invalidate dashboard cache for an association
   * Call this when financial data changes
   */
  async invalidateDashboard(associationId: number): Promise<void> {
    await Promise.all([
      cacheService.invalidateByTag(DASHBOARD_TAGS.OVERVIEW(associationId)),
      cacheService.invalidateByTag(DASHBOARD_TAGS.MEMBERS(associationId)),
      cacheService.invalidateByTag(DASHBOARD_TAGS.FINANCE(associationId)),
    ]);
  },

  /**
   * Invalidate only member-related dashboard data
   */
  async invalidateMemberData(associationId: number): Promise<void> {
    await cacheService.invalidateByTag(DASHBOARD_TAGS.MEMBERS(associationId));
    await cacheService.invalidateByTag(DASHBOARD_TAGS.OVERVIEW(associationId));
  },

  /**
   * Invalidate only finance-related dashboard data
   */
  async invalidateFinanceData(associationId: number): Promise<void> {
    await cacheService.invalidateByTag(DASHBOARD_TAGS.FINANCE(associationId));
    await cacheService.invalidateByTag(DASHBOARD_TAGS.OVERVIEW(associationId));
  },
};

export default cachedDashboardService;
