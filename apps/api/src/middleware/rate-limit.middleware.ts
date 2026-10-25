/**
 * Rate Limiting Middleware
 * Phase 12: Caching & Performance
 * 
 * Provides rate limiting using Redis for distributed rate limiting.
 * Falls back to in-memory rate limiting when Redis is unavailable.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisAvailable } from '../lib/redis';

// ============================================
// TYPES
// ============================================

export interface RateLimitOptions {
  /** Window size in seconds */
  windowMs?: number;
  /** Maximum requests per window */
  max?: number;
  /** Custom key generator */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Custom message on rate limit exceeded */
  message?: string;
  /** Use tenant-based rate limiting */
  perTenant?: boolean;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

// In-memory fallback store
const memoryStore: Map<string, RateLimitInfo> = new Map();

// Default options
const DEFAULT_OPTIONS: Required<Omit<RateLimitOptions, 'keyGenerator' | 'skip'>> = {
  windowMs: 60000, // 1 minute
  max: 100,        // 100 requests per minute
  message: 'Too many requests, please try again later.',
  perTenant: true,
};

// ============================================
// RATE LIMIT FUNCTIONS
// ============================================

/**
 * Generate rate limit key
 */
function generateKey(req: Request, options: RateLimitOptions): string {
  if (options.keyGenerator) {
    return options.keyGenerator(req);
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (options.perTenant && (req as any).associationId) {
    return `ratelimit:tenant:${(req as any).associationId}:${ip}`;
  }

  return `ratelimit:ip:${ip}`;
}

/**
 * Check rate limit using Redis
 */
async function checkRedisRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const client = await getRedisClient();
  if (!client) {
    return checkMemoryRateLimit(key, windowMs, max);
  }

  try {
    const now = Date.now();
    const windowStart = now - windowMs;
    const windowKey = `${key}:${Math.floor(now / windowMs)}`;

    // Increment counter
    const count = await client.incr(windowKey);
    
    // Set expiry on first request
    if (count === 1) {
      await client.expire(windowKey, Math.ceil(windowMs / 1000) + 1);
    }

    const resetTime = Math.ceil(now / windowMs) * windowMs;
    const remaining = Math.max(0, max - count);

    return {
      allowed: count <= max,
      remaining,
      resetTime,
    };
  } catch (error) {
    console.error('Redis rate limit error:', error);
    return checkMemoryRateLimit(key, windowMs, max);
  }
}

/**
 * Check rate limit using in-memory store (fallback)
 */
function checkMemoryRateLimit(
  key: string,
  windowMs: number,
  max: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const info = memoryStore.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupMemoryStore();
  }

  if (!info || now > info.resetTime) {
    // New window
    const resetTime = now + windowMs;
    memoryStore.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: max - 1, resetTime };
  }

  // Existing window
  info.count++;
  const remaining = Math.max(0, max - info.count);

  return {
    allowed: info.count <= max,
    remaining,
    resetTime: info.resetTime,
  };
}

/**
 * Clean up expired entries from memory store
 */
function cleanupMemoryStore(): void {
  const now = Date.now();
  for (const [key, info] of memoryStore.entries()) {
    if (now > info.resetTime) {
      memoryStore.delete(key);
    }
  }
}

// ============================================
// ATTEMPT COUNTING (for things that count only the failures, such as a wrong password)
// ============================================

/** Counts one attempt against a key and says whether it is still within the limit. Uses Redis when it is there, memory when not. */
export async function countAttempt(key: string, windowMs: number, max: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  return checkRedisRateLimit(key, windowMs, max);
}

/** How many attempts a key has used in the current window, without counting another. */
export async function peekAttempts(key: string, windowMs: number): Promise<number> {
  const client = await getRedisClient();
  if (client) {
    try {
      const windowKey = `${key}:${Math.floor(Date.now() / windowMs)}`;
      return Number((await client.get(windowKey)) ?? 0);
    } catch (error) {
      console.error('Redis rate limit error:', error);
    }
  }
  const info = memoryStore.get(key);
  return info && Date.now() <= info.resetTime ? info.count : 0;
}

// ============================================
// MIDDLEWARE FACTORY
// ============================================

/**
 * Create rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if should skip
    if (options.skip && options.skip(req)) {
      return next();
    }

    // DEV-ONLY: skip rate limiting entirely so repeated local test runs
    // (signup/verify/login flows during docs verification) don't trip it.
    // Never runs outside development.
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    const key = generateKey(req, config);
    const { allowed, remaining, resetTime } = await checkRedisRateLimit(
      key,
      config.windowMs,
      config.max
    );

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

    if (!allowed) {
      res.setHeader('Retry-After', Math.ceil((resetTime - Date.now()) / 1000));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: config.message,
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
      });
    }

    next();
  };
}

// ============================================
// PRESET RATE LIMITERS
// ============================================

/**
 * Standard API rate limiter (100 requests/minute)
 */
export const standardRateLimit = rateLimit({
  windowMs: 60000,
  max: 100,
  perTenant: true,
});

/**
 * Strict rate limiter for sensitive endpoints (20 requests/minute)
 */
export const strictRateLimit = rateLimit({
  windowMs: 60000,
  max: 20,
  perTenant: true,
  message: 'Too many requests to this endpoint. Please wait before trying again.',
});

/**
 * Auth rate limiter for login/register (10 requests/minute per IP)
 * Use this for sensitive auth endpoints like login, register, password reset
 */
export const authRateLimit = rateLimit({
  windowMs: 60000,
  max: 10,
  perTenant: false,
  message: 'Too many authentication attempts. Please wait before trying again.',
});

/**
 * Session check rate limiter (200 requests/minute)
 * Use this for /auth/me and other session validation endpoints
 * Higher limit since these are called on every page load
 */
export const sessionRateLimit = rateLimit({
  windowMs: 60000,
  max: 200,
  perTenant: false,
});

/**
 * Export rate limiter (5 requests/minute)
 */
export const exportRateLimit = rateLimit({
  windowMs: 60000,
  max: 5,
  perTenant: true,
  message: 'Too many export requests. Please wait before generating another export.',
});

/**
 * Report rate limiter (30 requests/minute)
 */
export const reportRateLimit = rateLimit({
  windowMs: 60000,
  max: 30,
  perTenant: true,
});

export default rateLimit;
