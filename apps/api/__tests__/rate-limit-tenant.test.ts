/**
 * Limits marked "per association" must count per association and visitor. The tenant middleware records the association as `tenantId`; the limiter
 * used to read a different field, `associationId`, which nothing sets, so the option silently did nothing and every limit was per address only.
 */
jest.mock('../src/lib/redis', () => ({ getRedisClient: jest.fn(async () => null), isRedisAvailable: () => false }));

import express from 'express';
import request from 'supertest';
import { rateLimit } from '../src/middleware/rate-limit.middleware';

/** Like the real server: the tenant middleware runs first and sets req.tenantId; here it comes from a test header. */
function app(options: { perTenant: boolean }) {
  const a = express();
  a.set('trust proxy', 1);
  a.use((req, _res, next) => {
    const tenant = req.header('x-test-tenant');
    if (tenant) (req as unknown as { tenantId: number }).tenantId = Number(tenant);
    next();
  });
  a.use('/api', rateLimit({ windowMs: 60_000, max: 2, ...options }));
  a.get('/api/ping', (_req, res) => res.json({ ok: true }));
  return a;
}
const hit = (a: express.Express, address: string, tenant: number) => request(a).get('/api/ping').set('X-Forwarded-For', `x, ${address}`).set('X-Test-Tenant', String(tenant));

describe('a per-association limit', () => {
  it('counts the same visitor separately in each association', async () => {
    const a = app({ perTenant: true });
    await hit(a, '41.58.20.1', 701);
    await hit(a, '41.58.20.1', 701);
    expect((await hit(a, '41.58.20.1', 701)).status).toBe(429); // over the allowance in association 701
    expect((await hit(a, '41.58.20.1', 702)).status).toBe(200); // the same visitor in another association has their own
  });

  it('still limits one visitor in one association', async () => {
    const a = app({ perTenant: true });
    expect((await hit(a, '41.58.21.1', 711)).status).toBe(200);
    expect((await hit(a, '41.58.21.1', 711)).status).toBe(200);
    expect((await hit(a, '41.58.21.1', 711)).status).toBe(429);
  });

  it('does not let one visitor use up another visitor’s allowance in the same association', async () => {
    const a = app({ perTenant: true });
    await hit(a, '41.58.22.1', 721);
    await hit(a, '41.58.22.1', 721);
    expect((await hit(a, '41.58.22.2', 721)).status).toBe(200);
  });
});

describe('a limit that is not per association', () => {
  it('counts the visitor once across associations, as before', async () => {
    const a = app({ perTenant: false });
    await hit(a, '41.58.23.1', 731);
    await hit(a, '41.58.23.1', 732);
    expect((await hit(a, '41.58.23.1', 733)).status).toBe(429);
  });
});
