/**
 * The association dashboard shows revenue, dues and member names, so only someone with ledger.view may read it.
 */
import express from 'express';
import request from 'supertest';

const mockHasPermission = jest.fn();
jest.mock('../../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 5, associationId: 9, platformRole: null };
    next();
  },
}));
jest.mock('../../src/services/rbac.service', () => ({
  RBACService: { hasPermission: (...a: unknown[]) => mockHasPermission(...a), auditPermissionCheck: jest.fn(async () => undefined), hasAnyPermission: jest.fn(async () => false) },
}));
jest.mock('../../src/modules/dashboard/dashboard-cached.service', () => ({
  cachedDashboardService: { getDashboardOverview: jest.fn(async () => ({ total: 1 })) },
}));
jest.mock('../../src/modules/dashboard/attention.service', () => ({ attentionService: { getAttention: jest.fn(async () => []) } }));

import dashboardRoutes from '../../src/modules/dashboard/dashboard.routes';

const app = express();
app.use('/api/dashboard', dashboardRoutes);

beforeEach(() => jest.clearAllMocks());

describe('GET /api/dashboard/overview', () => {
  it('refuses someone without ledger.view', async () => {
    mockHasPermission.mockResolvedValue(false);
    const res = await request(app).get('/api/dashboard/overview');
    expect(res.status).toBe(403);
    expect(mockHasPermission).toHaveBeenCalledWith(expect.anything(), 'ledger.view');
  });

  it('serves an officer with ledger.view', async () => {
    mockHasPermission.mockResolvedValue(true);
    const res = await request(app).get('/api/dashboard/overview');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ total: 1 });
  });

  it('leaves /attention open to everyone, since it filters by permission itself', async () => {
    mockHasPermission.mockResolvedValue(false);
    const res = await request(app).get('/api/dashboard/attention');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [] });
  });
});
