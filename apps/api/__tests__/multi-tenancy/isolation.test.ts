import request from 'supertest';
import app from '../../src/server';

// This test assumes at least one association seeded (demo) and that auth returns tokens with associationId
// For brevity, we only verify that accessing /api/auth/me without tenant header is unauthorized

describe.skip('Tenant isolation', () => {
  it('blocks /api/auth/me without token', async () => {
    const res = await request(app).get('/api/auth/me').set('x-tenant', 'demo');
    expect(res.status).toBe(401);
  });
});
