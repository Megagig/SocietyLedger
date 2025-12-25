import request from 'supertest';
import app from '../../src/server';

describe.skip('Subdomain routing and public endpoints', () => {
  it('allows check-subdomain without tenant context', async () => {
    const res = await request(app).get('/api/associations/check-subdomain?subdomain=unique-sub');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows signup without existing tenant', async () => {
    const payload = {
      association: { name: 'Test Assoc', slug: 'test-assoc', subdomain: 'testassoc', tier: 'STARTER' },
      admin: { email: 'admin@testassoc.org', password: 'Password123!' },
      planCode: 'starter',
    };
    const res = await request(app).post('/api/associations/signup').send(payload);
    // If slug/subdomain conflict exists due to prior run, expect 409; otherwise 201
    expect([201, 409]).toContain(res.status);
  });
});
