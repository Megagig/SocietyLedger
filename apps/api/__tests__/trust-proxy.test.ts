/**
 * Behind Dokploy's proxy every request reaches the API from the proxy's own address. Unless Express is told there is one proxy, req.ip is that
 * address for everybody, and the rate limit (keyed on it) becomes ONE shared "N requests a minute" for the whole platform. These tests use the real
 * rate-limit middleware.
 */
jest.mock('../src/lib/redis', () => ({ getRedisClient: jest.fn(async () => null), isRedisAvailable: () => false }));

import express from 'express';
import request from 'supertest';
import { rateLimit } from '../src/middleware/rate-limit.middleware';
import { trustProxyHops } from '../src/lib/trust-proxy';

/** What the proxy puts in X-Forwarded-For: whatever the visitor sent, then the visitor's real address last. */
const visitor = (realAddress: string, forged = 'x') => `${forged}, ${realAddress}`;

function appBehind(hops: number, max = 2) {
  const a = express();
  a.set('trust proxy', hops);
  a.use('/api', rateLimit({ windowMs: 60_000, max }));
  a.get('/api/ping', (req, res) => res.json({ ip: req.ip }));
  return a;
}
const get = (a: express.Express, forwardedFor: string) => request(a).get('/api/ping').set('X-Forwarded-For', forwardedFor);

describe('what the API sees as the visitor', () => {
  it('is the visitor’s real address when it trusts the one proxy in front of it', async () => {
    const res = await get(appBehind(1), visitor('41.58.1.1'));
    expect(res.body.ip).toBe('41.58.1.1');
  });

  it('is the proxy for everybody when it does not (the old behaviour)', async () => {
    const a = appBehind(0);
    const first = await get(a, visitor('41.58.2.1'));
    const second = await get(a, visitor('102.89.2.2'));
    expect(first.body.ip).toBe(second.body.ip);
  });
});

describe('the rate limit', () => {
  it('without the setting, one busy visitor uses up everyone’s allowance (the 429 you saw)', async () => {
    const a = appBehind(0, 2);
    await get(a, visitor('41.58.3.1'));
    await get(a, visitor('41.58.3.1'));
    const someoneElse = await get(a, visitor('102.89.3.2'));
    expect(someoneElse.status).toBe(429);
  });

  it('with the setting, each visitor has their own allowance', async () => {
    const a = appBehind(1, 2);
    expect((await get(a, visitor('41.58.4.1'))).status).toBe(200);
    expect((await get(a, visitor('41.58.4.1'))).status).toBe(200);
    expect((await get(a, visitor('41.58.4.1'))).status).toBe(429); // this visitor is over their allowance
    expect((await get(a, visitor('102.89.4.2'))).status).toBe(200); // someone else is not affected
  });

  it('cannot be dodged by forging an address: only the address the proxy recorded counts', async () => {
    const a = appBehind(1, 2);
    await get(a, visitor('41.58.5.1', 'forged-1'));
    await get(a, visitor('41.58.5.1', 'forged-2'));
    const third = await get(a, visitor('41.58.5.1', 'forged-3'));
    expect(third.status).toBe(429);
  });
});

describe('how many proxies to trust', () => {
  it('is one in production, none locally, and can be set when another proxy is added', () => {
    expect(trustProxyHops({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(1);
    expect(trustProxyHops({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(0);
    expect(trustProxyHops({} as NodeJS.ProcessEnv)).toBe(0);
    expect(trustProxyHops({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '2' } as NodeJS.ProcessEnv)).toBe(2);
    expect(trustProxyHops({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '0' } as NodeJS.ProcessEnv)).toBe(0);
  });

  it('ignores a value that makes no sense instead of trusting everything', () => {
    for (const bad of ['true', '-1', '1.5', '99', 'abc', '']) {
      expect(trustProxyHops({ NODE_ENV: 'production', TRUST_PROXY_HOPS: bad } as NodeJS.ProcessEnv)).toBe(1);
    }
  });
});
