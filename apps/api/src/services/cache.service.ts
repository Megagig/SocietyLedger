/**
 * Cache Service
 * Phase 12: Caching & Performance
 * 
 * Provides a unified caching interface with:
 * - Tag-based invalidation
 * - TTL management
 * - Graceful degradation when Redis unavailable
 * - Tenant-scoped caching
 */

import { getRedisClient, isRedisAvailable } from '../lib/redis';

// ============================================
// TYPES
// ============================================

export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Tags for grouped invalidation */
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// Default TTLs in seconds
export const CACHE_TTL = {
  SHORT: 60,           // 1 minute - for frequently changing data
  MEDIUM: 300,         // 5 minutes - for dashboard data
  LONG: 900,           // 15 minutes - for reports
  VERY_LONG: 3600,     // 1 hour - for static data
  SESSION: 86400,      // 24 hours - for session data
} as const;

// Cache key prefixes
export const CACHE_PREFIX = {
  DASHBOARD: 'dashboard',
  MEMBER: 'member',
  FINANCE: 'finance',
  REPORT: 'report',
  SESSION: 'session',
  SETTINGS: 'settings',
  TAG: 'tag',
} as const;

// In-memory stats tracking
let stats = { hits: 0, misses: 0 };

// ============================================
// CACHE SERVICE
// ============================================

export const cacheService = {
  /**
   * Generate a tenant-scoped cache key
   */
  generateKey(prefix: string, associationId: number, ...parts: (string | number)[]): string {
    return `${prefix}:${associationId}:${parts.join(':')}`;
  },

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      if (!client) {
        stats.misses++;
        return null;
      }

      const value = await client.get(key);
      if (value) {
        stats.hits++;
        return JSON.parse(value) as T;
      }

      stats.misses++;
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      stats.misses++;
      return null;
    }
  },

  /**
   * Set a value in cache with optional TTL and tags
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) return false;

      const ttl = options.ttl || CACHE_TTL.MEDIUM;
      const serialized = JSON.stringify(value);

      await client.setEx(key, ttl, serialized);

      // Store tags for invalidation
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          const tagKey = `${CACHE_PREFIX.TAG}:${tag}`;
          await client.sAdd(tagKey, key);
          // Set tag expiry slightly longer than cache TTL
          await client.expire(tagKey, ttl + 60);
        }
      }

      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  },

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) return false;

      await client.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  },

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const client = await getRedisClient();
      if (!client) return 0;

      const keys = await client.keys(pattern);
      if (keys.length === 0) return 0;

      await client.del(keys);
      return keys.length;
    } catch (error) {
      console.error('Cache deletePattern error:', error);
      return 0;
    }
  },

  /**
   * Invalidate all cache entries with a specific tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      const client = await getRedisClient();
      if (!client) return 0;

      const tagKey = `${CACHE_PREFIX.TAG}:${tag}`;
      const keys = await client.sMembers(tagKey);

      if (keys.length === 0) return 0;

      await client.del([...keys, tagKey]);
      return keys.length;
    } catch (error) {
      console.error('Cache invalidateByTag error:', error);
      return 0;
    }
  },

  /**
   * Invalidate all cache for a specific tenant
   */
  async invalidateTenant(associationId: number): Promise<number> {
    try {
      const client = await getRedisClient();
      if (!client) return 0;

      // Delete all keys for this tenant
      const patterns = [
        `${CACHE_PREFIX.DASHBOARD}:${associationId}:*`,
        `${CACHE_PREFIX.MEMBER}:${associationId}:*`,
        `${CACHE_PREFIX.FINANCE}:${associationId}:*`,
        `${CACHE_PREFIX.REPORT}:${associationId}:*`,
        `${CACHE_PREFIX.SETTINGS}:${associationId}:*`,
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        totalDeleted += await this.deletePattern(pattern);
      }

      return totalDeleted;
    } catch (error) {
      console.error('Cache invalidateTenant error:', error);
      return 0;
    }
  },

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetcher();

    // Cache the result (don't await to avoid blocking)
    this.set(key, data, options).catch(err => {
      console.error('Cache set error in getOrSet:', err);
    });

    return data;
  },

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) return false;

      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  },

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = stats.hits + stats.misses;
    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: total > 0 ? (stats.hits / total) * 100 : 0,
    };
  },

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    stats = { hits: 0, misses: 0 };
  },

  /**
   * Check if caching is available
   */
  isAvailable(): boolean {
    return isRedisAvailable();
  },

  /**
   * Warm up cache with commonly accessed data
   */
  async warmUp(associationId: number): Promise<void> {
    // This can be called on server startup or after cache invalidation
    // to pre-populate frequently accessed data
    console.log(`Cache warm-up initiated for association ${associationId}`);
    // Implementation depends on specific use cases
  },
};

export default cacheService;
