// ============================================
// PHASE 17: AI RATE LIMITER
// Per-tenant rate limiting for AI requests
// ============================================

import { prisma } from '../../../lib/prisma';
import { RateLimitStatus, RateLimitConfig } from '../ai.types';

// ============================================
// RATE LIMIT CONFIGURATION BY TIER
// ============================================

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  STARTER: {
    requestsPerDay: 20,
    tokensPerDay: 50000,
  },
  PROFESSIONAL: {
    requestsPerDay: 100,
    tokensPerDay: 500000,
  },
  ENTERPRISE: {
    requestsPerDay: -1, // Unlimited
    tokensPerDay: -1,   // Unlimited
  },
};

// In-memory cache for rate limits (with TTL)
const rateLimitCache: Map<number, {
  requestCount: number;
  tokenCount: number;
  resetAt: Date;
  tier: string;
}> = new Map();

// ============================================
// RATE LIMITER CLASS
// ============================================

class AIRateLimiter {
  /**
   * Check if association has exceeded rate limit
   * @throws RateLimitError if limit exceeded
   */
  async checkLimit(associationId: number): Promise<void> {
    const status = await this.getStatus(associationId);
    
    if (status.isLimited) {
      throw new RateLimitError(
        `AI request limit exceeded. You have used ${status.requestsUsed} of ${status.requestsUsed + status.requestsRemaining} daily requests. Resets at ${status.resetsAt.toLocaleTimeString()}.`,
        status
      );
    }
    
    // Increment counter
    await this.incrementCounter(associationId);
  }

  /**
   * Get current rate limit status for association
   */
  async getStatus(associationId: number): Promise<RateLimitStatus> {
    // Check cache first
    const cached = rateLimitCache.get(associationId);
    const now = new Date();
    
    if (cached && cached.resetAt > now) {
      const config = RATE_LIMITS[cached.tier] || RATE_LIMITS.STARTER;
      const isUnlimited = config.requestsPerDay === -1;
      
      return {
        requestsUsed: cached.requestCount,
        requestsRemaining: isUnlimited ? 999999 : Math.max(0, config.requestsPerDay - cached.requestCount),
        tokensUsed: cached.tokenCount,
        tokensRemaining: isUnlimited ? 999999999 : Math.max(0, config.tokensPerDay - cached.tokenCount),
        resetsAt: cached.resetAt,
        isLimited: !isUnlimited && cached.requestCount >= config.requestsPerDay,
      };
    }
    
    // Fetch from database
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      select: { tier: true },
    });
    
    const tier = association?.tier || 'STARTER';
    const config = RATE_LIMITS[tier] || RATE_LIMITS.STARTER;
    
    // Get today's usage from audit logs
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const todayLogs = await prisma.aIAuditLog.aggregate({
      where: {
        associationId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: 'success',
      },
      _count: { id: true },
      _sum: {
        tokensInput: true,
        tokensOutput: true,
      },
    });
    
    const requestCount = todayLogs._count.id || 0;
    const tokenCount = (todayLogs._sum.tokensInput || 0) + (todayLogs._sum.tokensOutput || 0);
    
    // Update cache
    const resetAt = new Date(endOfDay);
    resetAt.setDate(resetAt.getDate() + 1);
    resetAt.setHours(0, 0, 0, 0);
    
    rateLimitCache.set(associationId, {
      requestCount,
      tokenCount,
      resetAt,
      tier,
    });
    
    const isUnlimited = config.requestsPerDay === -1;
    
    return {
      requestsUsed: requestCount,
      requestsRemaining: isUnlimited ? 999999 : Math.max(0, config.requestsPerDay - requestCount),
      tokensUsed: tokenCount,
      tokensRemaining: isUnlimited ? 999999999 : Math.max(0, config.tokensPerDay - tokenCount),
      resetsAt: resetAt,
      isLimited: !isUnlimited && requestCount >= config.requestsPerDay,
    };
  }

  /**
   * Increment request counter
   */
  async incrementCounter(associationId: number, tokens: number = 0): Promise<void> {
    const cached = rateLimitCache.get(associationId);
    
    if (cached) {
      cached.requestCount++;
      cached.tokenCount += tokens;
      rateLimitCache.set(associationId, cached);
    }
  }

  /**
   * Add token usage to counter
   */
  async addTokenUsage(associationId: number, tokens: number): Promise<void> {
    const cached = rateLimitCache.get(associationId);
    
    if (cached) {
      cached.tokenCount += tokens;
      rateLimitCache.set(associationId, cached);
    }
  }

  /**
   * Get rate limit config for tier
   */
  getConfigForTier(tier: string): RateLimitConfig {
    return RATE_LIMITS[tier] || RATE_LIMITS.STARTER;
  }

  /**
   * Clear cache for association (useful for testing or tier changes)
   */
  clearCache(associationId: number): void {
    rateLimitCache.delete(associationId);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    rateLimitCache.clear();
  }
}

// ============================================
// CUSTOM ERROR CLASS
// ============================================

export class RateLimitError extends Error {
  public status: RateLimitStatus;
  
  constructor(message: string, status: RateLimitStatus) {
    super(message);
    this.name = 'RateLimitError';
    this.status = status;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const aiRateLimiter = new AIRateLimiter();

export default aiRateLimiter;
