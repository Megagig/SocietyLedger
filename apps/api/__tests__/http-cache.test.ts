/**
 * The HTTP defaults for /api: reads are revalidated and never kept by a shared cache, writes are not stored, big answers are compressed, an
 * unchanged answer is a 304, and a route can set its own Cache-Control.
 */
import compression from 'compression';
import express from 'express';
import request from 'supertest';
import { apiCacheHeaders } from '../src/middleware/http-cache.middleware';

function app() {
  const a = express();
  a.use(compression());
  a.use('/api', apiCacheHeaders);
  a.get('/api/members', (_req, res) => res.json({ rows: Array.from({ length: 400 }, (_, i) => ({ id: i, name: `Member number ${i}` })) }));
  a.post('/api/members', (_req, res) => res.status(201).json({ ok: true }));
  a.get('/api/public/pricing', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ plans: [] });
  });
  return a;
}

describe('API cache headers', () => {
  it('marks a read private and revalidated, and says what the answer depends on', async () => {
    const res = await request(app()).get('/api/members');
    expect(res.headers['cache-control']).toBe('private, no-cache');
    expect(res.headers.vary).toMatch(/Authorization/);
    expect(res.headers.vary).toMatch(/X-Tenant/);
  });

  it('never lets a read be stored with a freshness window, so a saved change shows on the next read', async () => {
    const res = await request(app()).get('/api/members');
    expect(res.headers['cache-control']).not.toMatch(/max-age/);
    expect(res.headers['cache-control']).not.toMatch(/public/);
  });

  it('does not store a write', async () => {
    const res = await request(app()).post('/api/members').send({});
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('lets a route set its own header (for example public pricing)', async () => {
    const res = await request(app()).get('/api/public/pricing');
    expect(res.headers['cache-control']).toBe('public, max-age=300');
  });

  it('compresses a large answer when the client accepts it', async () => {
    const res = await request(app()).get('/api/members').set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.body.rows).toHaveLength(400);
  });

  it('answers 304 with no body when the client already has the current version', async () => {
    const a = app();
    const first = await request(a).get('/api/members');
    expect(first.headers.etag).toBeTruthy();
    const again = await request(a).get('/api/members').set('If-None-Match', first.headers.etag);
    expect(again.status).toBe(304);
    expect(again.text).toBe('');
  });
});
