# Phase 12: Caching & Performance

## Overview

Phase 12 implements a comprehensive caching and performance optimization layer for SocietyLedger using Redis. The implementation provides:

- **Redis-based caching** with graceful degradation
- **Tag-based cache invalidation** for precise cache management
- **Rate limiting** to protect API endpoints
- **Database indexes** for query optimization
- **Tenant-scoped caching** for multi-tenant isolation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Request                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Rate Limit Middleware                      │
│  (Redis-backed with in-memory fallback)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Controller                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cached Service Layer                       │
│  (dashboard-cached.service, reports-cached.service)         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│      Cache Service      │     │      Original Service       │
│   (cache.service.ts)    │     │  (dashboard.service, etc)   │
└─────────────────────────┘     └─────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│         Redis           │     │        PostgreSQL           │
└─────────────────────────┘     └─────────────────────────────┘
```

## Components

### 1. Redis Client (`apps/api/src/lib/redis.ts`)

Singleton Redis client with:
- Connection pooling
- Graceful degradation when Redis unavailable
- Support for both Upstash (serverless) and standard Redis
- Automatic reconnection with backoff

```typescript
import { getRedisClient, isRedisAvailable, initializeRedis } from './lib/redis';

// Initialize on server startup
await initializeRedis();

// Check availability
if (isRedisAvailable()) {
  const client = await getRedisClient();
  // Use client...
}
```

### 2. Cache Service (`apps/api/src/services/cache.service.ts`)

Unified caching interface with:
- Tag-based invalidation
- TTL management
- Tenant-scoped keys
- `getOrSet` pattern for cache-aside

```typescript
import { cacheService, CACHE_TTL, CACHE_PREFIX } from './services/cache.service';

// Generate tenant-scoped key
const key = cacheService.generateKey(CACHE_PREFIX.DASHBOARD, associationId, 'overview');

// Get or set pattern
const data = await cacheService.getOrSet(
  key,
  () => fetchExpensiveData(),
  { ttl: CACHE_TTL.MEDIUM, tags: ['dashboard:overview:123'] }
);

// Invalidate by tag
await cacheService.invalidateByTag('dashboard:overview:123');
```

#### TTL Constants

| Constant | Duration | Use Case |
|----------|----------|----------|
| `SHORT` | 1 minute | Frequently changing data |
| `MEDIUM` | 5 minutes | Dashboard data |
| `LONG` | 15 minutes | Reports |
| `VERY_LONG` | 1 hour | Static data |
| `SESSION` | 24 hours | Session data |

### 3. Cache Invalidation Service (`apps/api/src/services/cache-invalidation.service.ts`)

Centralized invalidation for data changes:

```typescript
import { cacheInvalidationService } from './services/cache-invalidation.service';

// Call when member data changes
await cacheInvalidationService.onMemberChange(associationId);

// Call when transaction data changes
await cacheInvalidationService.onTransactionChange(associationId);

// Call when payment is recorded
await cacheInvalidationService.onPaymentChange(associationId);

// Call when categories change
await cacheInvalidationService.onCategoryChange(associationId);
```

### 4. Cached Services

#### Dashboard Cached Service (`apps/api/src/modules/dashboard/dashboard-cached.service.ts`)
- Caches dashboard overview (5 min TTL)
- Tag-based invalidation for members and finance data

#### Reports Cached Service (`apps/api/src/modules/reports/reports-cached.service.ts`)
- Caches all report types (15 min TTL)
- Filter-aware caching with hash-based keys

### 5. Rate Limiting (`apps/api/src/middleware/rate-limit.middleware.ts`)

Redis-backed rate limiting with in-memory fallback:

```typescript
import { 
  standardRateLimit,  // 100 req/min
  strictRateLimit,    // 20 req/min
  authRateLimit,      // 10 req/min
  exportRateLimit,    // 5 req/min
  reportRateLimit     // 30 req/min
} from './middleware/rate-limit.middleware';

// Apply to routes
app.use('/api/auth', authRateLimit);
app.use('/api', standardRateLimit);
```

## Database Indexes

Phase 12 adds performance indexes to frequently queried tables:

### Transaction Table
- `(associationId, status)` - Status filtering
- `(associationId, memberId)` - Member transactions
- `(associationId, categoryId)` - Category filtering
- `(associationId, createdAt)` - Date range queries
- `(associationId, dueDate)` - Due date queries
- `(memberId, status)` - Member status queries

### Payment Table
- `(associationId, paymentDate)` - Date filtering
- `(transactionId)` - Transaction lookups
- `(associationId, createdAt)` - Date range queries

### Member Table
- `(associationId, status)` - Status filtering
- `(associationId, category)` - Category filtering
- `(associationId, createdAt)` - Date range queries
- `(email)` - Email lookups

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
# OR for Upstash
UPSTASH_REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
```

### Server Initialization

Redis is initialized on server startup in `server.ts`:

```typescript
// Initialize Redis before starting server
initializeRedis()
  .then(() => {
    app.listen(PORT, () => {
      console.log('Server running with Redis caching');
    });
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closeRedisConnection();
  process.exit(0);
});
```

## Cache Invalidation Strategy

### Automatic Invalidation

Cache is automatically invalidated when data changes:

| Event | Invalidated Caches |
|-------|-------------------|
| Member created/updated/deleted | Dashboard members, Member reports |
| Transaction created/updated/deleted | Dashboard finance, Financial reports |
| Payment recorded | Dashboard finance, All reports |
| Category changed | Financial reports, Category reports |

### Manual Invalidation

For special cases, use the cache invalidation service:

```typescript
// Invalidate all cache for a tenant
await cacheInvalidationService.invalidateAll(associationId);

// Invalidate multiple tenants
await cacheInvalidationService.invalidateMultiple([id1, id2, id3]);
```

## Monitoring

### Cache Statistics

```typescript
const stats = cacheService.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);

// Reset stats
cacheService.resetStats();
```

### Rate Limit Headers

All API responses include rate limit headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when window resets

## Best Practices

1. **Always use tenant-scoped keys** to prevent data leakage
2. **Use appropriate TTLs** based on data volatility
3. **Invalidate cache on data mutations** using the invalidation service
4. **Monitor cache hit rates** to optimize TTLs
5. **Handle Redis unavailability gracefully** - the system works without Redis

## Troubleshooting

### Redis Connection Issues

```typescript
// Check if Redis is available
if (!cacheService.isAvailable()) {
  console.log('Redis unavailable - using database directly');
}
```

### Cache Not Invalidating

Ensure cache invalidation is called after data mutations:

```typescript
// In controller after successful mutation
await cacheInvalidationService.onTransactionChange(associationId);
```

### High Memory Usage

Reduce TTLs or implement cache eviction policies in Redis configuration.
