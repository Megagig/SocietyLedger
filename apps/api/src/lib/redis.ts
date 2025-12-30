/**
 * Redis Client Configuration
 * Phase 12: Caching & Performance
 * 
 * Centralized Redis connection with graceful degradation.
 * Supports both Upstash (serverless) and standard Redis.
 */

import { createClient, RedisClientType } from 'redis';

// Global cache for development hot reloading
const globalForRedis = global as unknown as { redis: RedisClientType | null };

let redisClient: RedisClientType | null = null;
let isConnected = false;
let connectionAttempted = false;

/**
 * Get Redis URL from environment
 */
function getRedisUrl(): string | null {
  return process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || null;
}

/**
 * Create and connect Redis client
 */
async function createRedisClient(): Promise<RedisClientType | null> {
  const redisUrl = getRedisUrl();
  
  if (!redisUrl) {
    console.log('⚠️ Redis URL not configured - caching disabled');
    return null;
  }

  try {
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.log('❌ Redis max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err.message);
      isConnected = false;
    });

    client.on('connect', () => {
      console.log('✅ Redis connected');
      isConnected = true;
    });

    client.on('disconnect', () => {
      console.log('⚠️ Redis disconnected');
      isConnected = false;
    });

    await client.connect();
    return client as RedisClientType;
  } catch (error: any) {
    console.error('❌ Redis connection failed:', error.message);
    return null;
  }
}

/**
 * Get Redis client instance (singleton)
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  // Return cached client if available
  if (redisClient && isConnected) {
    return redisClient;
  }

  // Use global cache in development
  if (globalForRedis.redis && isConnected) {
    redisClient = globalForRedis.redis;
    return redisClient;
  }

  // Only attempt connection once
  if (connectionAttempted) {
    return redisClient;
  }

  connectionAttempted = true;
  redisClient = await createRedisClient();

  if (process.env.NODE_ENV !== 'production' && redisClient) {
    globalForRedis.redis = redisClient;
  }

  return redisClient;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return isConnected && redisClient !== null;
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient && isConnected) {
    await redisClient.quit();
    isConnected = false;
    redisClient = null;
  }
}

/**
 * Initialize Redis on server startup
 */
export async function initializeRedis(): Promise<void> {
  await getRedisClient();
}

export default getRedisClient;
