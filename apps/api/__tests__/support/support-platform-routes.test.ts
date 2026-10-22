/**
 * /api/admin/support is open to SocietyLedger's SUPER_ADMIN and SUPPORT_AGENT staff and nobody else — not an
 * association admin, not a finance admin, not a member. The router is mounted for real; auth and the service are faked.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../src/middleware/auth.middleware', () => ({
  // The test sends who the caller is in headers: x-platform-role (optional) and x-user-id.
  authMiddleware: (req: any, res: any, next: any) => {
    if (!req.headers['x-user-id']) return res.status(401).json({ success: false, message: 'Authentication required' });
    req.user = { id: Number(req.headers['x-user-id']), associationId: 15, platformRole: req.headers['x-platform-role'] ?? null };
    next();
  },
}));
jest.mock('../../src/modules/support/support-platform.service', () => ({
  platformSupportService: {
    listTickets: jest.fn().mockResolvedValue({ tickets: [], total: 0, hasMore: false }),
    getStats: jest.fn().mockResolvedValue({ total: 0 }),
    listStaff: jest.fn().mockResolvedValue([]),
    getTicket: jest.fn().mockResolvedValue(null),
    getAttachmentForAccess: jest.fn().mockResolvedValue(null),
  },
}));
jest.mock('../../src/lib/prisma', () => ({ prisma: {} }));
jest.mock('../../src/lib/storage', () => ({ uploadFile: jest.fn(), deleteFile: jest.fn(), getPresignedUrl: jest.fn() }));

import platformSupportRoutes from '../../src/modules/support/support-platform.routes';

const app = express();
app.use(express.json());
app.use('/api/admin/support', platformSupportRoutes);

const get = (path: string, headers: Record<string, string>) => request(app).get(`/api/admin/support${path}`).set(headers);

describe.each(['SUPER_ADMIN', 'SUPPORT_AGENT'])('%s', (role) => {
  it('can open the inbox, stats, staff list and a ticket', async () => {
    const headers = { 'x-user-id': '1', 'x-platform-role': role };

    expect((await get('/tickets', headers)).status).toBe(200);
    expect((await get('/stats', headers)).status).toBe(200);
    expect((await get('/staff', headers)).status).toBe(200);
    expect((await get('/tickets/3', headers)).status).toBe(404); // reachable; this id simply is not a platform ticket
  });
});

describe.each([['an association admin or member', {}], ['a finance admin', { 'x-platform-role': 'FINANCE_ADMIN' }], ['a compliance admin', { 'x-platform-role': 'COMPLIANCE_ADMIN' }]])('%s', (_label, extra) => {
  it('is refused everywhere', async () => {
    const headers = { 'x-user-id': '7', ...extra } as Record<string, string>;

    for (const path of ['/tickets', '/stats', '/staff', '/tickets/3', '/attachments/4']) {
      expect((await get(path, headers)).status).toBe(403);
    }
    expect((await request(app).patch('/api/admin/support/tickets/3').set(headers).send({ status: 'CLOSED' })).status).toBe(403);
    expect((await request(app).post('/api/admin/support/tickets/3/respond').set(headers).send({ message: 'hi' })).status).toBe(403);
  });
});

it('needs a signed-in user', async () => {
  expect((await get('/tickets', {})).status).toBe(401);
});
