/**
 * F0.4 unit test — mobile-return.routes.ts in isolation (a tiny Express app
 * mounting just this router, not the full server.ts, which pulls in the
 * otplib/Jest-ESM issue documented at G91). Confirms the redirect target is
 * always the hard-coded scheme and is never influenced by any request
 * input — the "no open redirect" requirement from build-plan.md's F0.4 DoD.
 */
import express from 'express';
import request from 'supertest';
import mobileReturnRoutes from '../../src/modules/payments/mobile-return.routes';

const app = express();
app.use('/api/payments/mobile-return', mobileReturnRoutes);

describe('GET /api/payments/mobile-return', () => {
  it('redirects to the app scheme with the reference forwarded', async () => {
    const res = await request(app).get('/api/payments/mobile-return?reference=abc123&status=success');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('societyledger://payments/return?reference=abc123&status=success');
  });

  it('falls back to trxref when reference is absent (Paystack sometimes sends only trxref)', async () => {
    const res = await request(app).get('/api/payments/mobile-return?trxref=xyz789');
    expect(res.headers.location).toBe('societyledger://payments/return?reference=xyz789');
  });

  it('redirects to the bare scheme with no query string when nothing is provided', async () => {
    const res = await request(app).get('/api/payments/mobile-return');
    expect(res.headers.location).toBe('societyledger://payments/return');
  });

  it('never honors a "redirect" (or any other) query param as the target — no open redirect', async () => {
    const res = await request(app).get(
      '/api/payments/mobile-return?reference=abc&redirect=https://evil.example.com'
    );
    expect(res.headers.location).toBe('societyledger://payments/return?reference=abc');
    expect(res.headers.location).not.toMatch(/evil\.example\.com/);
  });

  it('includes a visible fallback link pointing at the same deep link, HTML-escaped', async () => {
    const res = await request(app).get('/api/payments/mobile-return?reference=abc&status=success');
    expect(res.text).toContain('href="societyledger://payments/return?reference=abc&amp;status=success"');
  });
});
