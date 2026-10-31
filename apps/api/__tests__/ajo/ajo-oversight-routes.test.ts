/**
 * Staff oversight of Ajo groups over HTTP (T9): who can look, who can override, what a refusal looks like, and that every override
 * leaves a reasoned row in the Action log. Sign-in, permissions, billing and the database are stood in for; what is under test is the wiring.
 */
import express from 'express';
import request from 'supertest';

const mockDb = {
  ajoPayout: { findUnique: jest.fn() },
  ajoGroup: { findUnique: jest.fn() },
  platformActionLog: { create: jest.fn(async () => ({})) },
};
const mockVoidPayout = jest.fn();
const mockChangeTier = jest.fn();
const mockPreviewTier = jest.fn();
const mockListTiers = jest.fn();
const mockSuspend = jest.fn();
const mockReactivate = jest.fn();

jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: mockDb, prisma: mockDb }));
jest.mock('../../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const raw = req.header('x-test-user');
    if (!raw) return res.status(401).json({ success: false, message: 'Not signed in' });
    req.user = JSON.parse(raw);
    return next();
  },
}));
jest.mock('../../src/middleware/rbac', () => ({
  requirePlatformRole: (roles: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) =>
    roles.includes(String(req.user!.platformRole)) ? next() : res.status(403).json({ success: false, code: 'FORBIDDEN' }),
}));
jest.mock('../../src/modules/ajo/ajo-payout.service', () => ({ voidPayout: (...a: unknown[]) => mockVoidPayout(...a) }));
jest.mock('../../src/modules/ajo/ajo-capacity', () => ({ countActiveContributors: jest.fn(async () => 12) }));
jest.mock('../../src/modules/ajo/ajo-levy.service', () => ({ levyReport: jest.fn(async () => ({ associations: [], totals: {} })) }));
jest.mock('../../src/services/billing/tier-change.service', () => ({
  changeTier: (...a: unknown[]) => mockChangeTier(...a),
  previewTierChange: (...a: unknown[]) => mockPreviewTier(...a),
  listTierOptions: (...a: unknown[]) => mockListTiers(...a),
  getHeldTier: jest.fn(async () => null),
  tierAdoption: jest.fn(async () => []),
}));
jest.mock('../../src/services/tenant-management.service', () => ({
  TenantManagementService: { suspend: (...a: unknown[]) => mockSuspend(...a), reactivate: (...a: unknown[]) => mockReactivate(...a) },
}));
jest.mock('../../src/modules/ajo/ajo-analytics.service', () => ({ ajoAnalytics: jest.fn(async () => ({ contributors: { active: 3 } })) }));

import ajoOversightRoutes from '../../src/modules/ajo/ajo-oversight.routes';
import { BillingError } from '../../src/services/billing/quote.service';

const app = express();
app.use(express.json());
app.use('/api/admin/ajo-oversight', ajoOversightRoutes);

const STAFF = (role: string) => JSON.stringify({ id: 900, associationId: null, platformRole: role });
const GOOD_REASON = 'The bank account was entered wrongly';

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.ajoPayout.findUnique.mockResolvedValue({ id: 5, associationId: 7, groupId: 3, status: 'APPROVED', netKobo: 1_000_000n });
  mockVoidPayout.mockResolvedValue({ payout: {}, replayed: false });
  mockDb.ajoGroup.findUnique.mockResolvedValue({ associationId: 7 });
  mockListTiers.mockResolvedValue([
    { addonId: 1, code: 'ajo-trial', name: 'Ajo trial' },
    { addonId: 2, code: 'ajo-starter', name: 'Ajo Starter' },
  ]);
});

describe('who can reach the oversight routes', () => {
  it('turns away anyone not signed in and any staff role outside the list', async () => {
    expect((await request(app).get('/api/admin/ajo-oversight/analytics')).status).toBe(401);
    expect((await request(app).get('/api/admin/ajo-oversight/groups/3').set('x-test-user', STAFF('CONTENT_EDITOR'))).status).toBe(403);
  });

  it('lets support and compliance look but not override or see revenue', async () => {
    for (const role of ['SUPPORT_AGENT', 'COMPLIANCE_ADMIN']) {
      const tier = await request(app).post('/api/admin/ajo-oversight/groups/3/tier').set('x-test-user', STAFF(role)).send({ targetAddonId: 2, reason: GOOD_REASON });
      expect(tier.status).toBe(403);
      const voided = await request(app).post('/api/admin/ajo-oversight/payouts/5/void').set('x-test-user', STAFF(role)).send({ reason: GOOD_REASON });
      expect(voided.status).toBe(403);
      expect((await request(app).get('/api/admin/ajo-oversight/analytics').set('x-test-user', STAFF(role))).status).toBe(403);
    }
    expect(mockChangeTier).not.toHaveBeenCalled();
    expect(mockVoidPayout).not.toHaveBeenCalled();
  });

  it('lets finance and super admins see revenue', async () => {
    for (const role of ['FINANCE_ADMIN', 'SUPER_ADMIN']) {
      expect((await request(app).get('/api/admin/ajo-oversight/analytics').set('x-test-user', STAFF(role))).status).toBe(200);
    }
  });
});

describe('knowing your own role', () => {
  it('answers every staff role the Ajo screens serve, so compliance and finance staff see their buttons (the general admin/me is super-admin-only)', async () => {
    for (const role of ['SUPER_ADMIN', 'FINANCE_ADMIN', 'COMPLIANCE_ADMIN', 'SUPPORT_AGENT']) {
      const res = await request(app).get('/api/admin/ajo-oversight/whoami').set('x-test-user', STAFF(role));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ platformRole: role });
    }
    expect((await request(app).get('/api/admin/ajo-oversight/whoami')).status).toBe(401);
  });
});

describe('suspending the owner of a group', () => {
  it('is for super admins only', async () => {
    for (const role of ['FINANCE_ADMIN', 'COMPLIANCE_ADMIN', 'SUPPORT_AGENT']) {
      const res = await request(app).post('/api/admin/ajo-oversight/groups/3/owner/suspend').set('x-test-user', STAFF(role)).send({ reason: GOOD_REASON });
      expect(res.status).toBe(403);
    }
    expect(mockSuspend).not.toHaveBeenCalled();
  });

  it('needs a written reason, then suspends and reactivates through the platform path with that reason', async () => {
    const short = await request(app).post('/api/admin/ajo-oversight/groups/3/owner/suspend').set('x-test-user', STAFF('SUPER_ADMIN')).send({ reason: 'no' });
    expect(short.status).toBe(400);
    expect(mockSuspend).not.toHaveBeenCalled();

    expect((await request(app).post('/api/admin/ajo-oversight/groups/3/owner/suspend').set('x-test-user', STAFF('SUPER_ADMIN')).send({ reason: GOOD_REASON })).status).toBe(200);
    expect(mockSuspend).toHaveBeenCalledWith(7, 900, { reason: GOOD_REASON, notifyUsers: false });
    expect((await request(app).post('/api/admin/ajo-oversight/groups/3/owner/reactivate').set('x-test-user', STAFF('SUPER_ADMIN')).send({ reason: GOOD_REASON })).status).toBe(200);
    expect(mockReactivate).toHaveBeenCalledWith(7, 900, GOOD_REASON);
  });

  it('turns a plain refusal (already suspended) into a clear 409, not a server error', async () => {
    mockSuspend.mockRejectedValue(new Error('Association is already suspended'));
    const res = await request(app).post('/api/admin/ajo-oversight/groups/3/owner/suspend').set('x-test-user', STAFF('SUPER_ADMIN')).send({ reason: GOOD_REASON });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already suspended/);
  });
});

describe('voiding a payout as staff', () => {
  it('needs a written reason of at least 10 characters, and does nothing without one', async () => {
    const res = await request(app).post('/api/admin/ajo-oversight/payouts/5/void').set('x-test-user', STAFF('FINANCE_ADMIN')).send({ reason: 'too short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REASON_REQUIRED');
    expect(mockVoidPayout).not.toHaveBeenCalled();
    expect(mockDb.platformActionLog.create).not.toHaveBeenCalled();
  });

  it('voids as an admin of that group and writes the reason to the Action log', async () => {
    const res = await request(app).post('/api/admin/ajo-oversight/payouts/5/void').set('x-test-user', STAFF('FINANCE_ADMIN')).send({ reason: GOOD_REASON });
    expect(res.status).toBe(200);
    expect(mockVoidPayout).toHaveBeenCalledWith(expect.objectContaining({ associationId: 7, payoutId: 5, actorUserId: 900, actorIsAdmin: true }));
    expect(mockDb.platformActionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actionType: 'AJO_PAYOUT_VOIDED_BY_STAFF', targetId: 5, associationId: 7, reason: GOOD_REASON, actorId: 900, actorRole: 'FINANCE_ADMIN' }),
    });
  });

  it('leaves no log row when the payout was already paid, and passes the refusal on', async () => {
    const { RuleError } = jest.requireActual('../../src/modules/finance/rule-error');
    mockVoidPayout.mockRejectedValue(new RuleError('This payout has been recorded as paid.', 409, 'PAYOUT_ALREADY_PAID'));
    const res = await request(app).post('/api/admin/ajo-oversight/payouts/5/void').set('x-test-user', STAFF('SUPER_ADMIN')).send({ reason: GOOD_REASON });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYOUT_ALREADY_PAID');
    expect(mockDb.platformActionLog.create).not.toHaveBeenCalled();
  });

  it('does not write a second log row when the payout was already cancelled', async () => {
    mockVoidPayout.mockResolvedValue({ payout: {}, replayed: true });
    const res = await request(app).post('/api/admin/ajo-oversight/payouts/5/void').set('x-test-user', STAFF('SUPER_ADMIN')).send({ reason: GOOD_REASON });
    expect(res.status).toBe(200);
    expect(mockDb.platformActionLog.create).not.toHaveBeenCalled();
  });
});

describe('changing a group tier as staff', () => {
  it('needs a reason, and never moves a group onto the trial tier', async () => {
    const short = await request(app).post('/api/admin/ajo-oversight/groups/3/tier').set('x-test-user', STAFF('SUPER_ADMIN')).send({ targetAddonId: 2, reason: 'because' });
    expect(short.status).toBe(400);
    const trial = await request(app).post('/api/admin/ajo-oversight/groups/3/tier').set('x-test-user', STAFF('SUPER_ADMIN')).send({ targetAddonId: 1, reason: GOOD_REASON });
    expect(trial.status).toBe(400);
    expect(trial.body.code).toBe('TIER_NOT_ALLOWED');
    expect(mockChangeTier).not.toHaveBeenCalled();
  });

  it('hands billing the owner, the real head count and the actor, and says when a downgrade will land', async () => {
    mockChangeTier.mockResolvedValue({ applied: 'PERIOD_END', effectiveAt: new Date('2027-01-01T00:00:00Z') });
    const res = await request(app).post('/api/admin/ajo-oversight/groups/3/tier').set('x-test-user', STAFF('FINANCE_ADMIN')).send({ targetAddonId: 2, reason: GOOD_REASON });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/end of the paid period/);
    expect(mockChangeTier).toHaveBeenCalledWith(expect.objectContaining({ associationId: 7, family: 'ajo', targetAddonId: 2, activeContributors: expect.any(Function), reason: GOOD_REASON, actor: expect.objectContaining({ id: 900, role: 'FINANCE_ADMIN' }) }));
    // The head count is read by billing inside its own transaction, from the real counter.
    const asked = mockChangeTier.mock.calls[0][0].activeContributors as (db: unknown) => Promise<number>;
    expect(await asked({})).toBe(12);
  });

  it('shows a blocked downgrade as a clear 409 with its code, not a server error', async () => {
    mockChangeTier.mockRejectedValue(new BillingError('TIER_BLOCKED', 'Ajo Starter allows 30 active contributors and this group has 42.', 409));
    const res = await request(app).post('/api/admin/ajo-oversight/groups/3/tier').set('x-test-user', STAFF('SUPER_ADMIN')).send({ targetAddonId: 2, reason: GOOD_REASON });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'TIER_BLOCKED' });
    expect(res.body.message).toMatch(/42/);
  });

  it('previews without changing anything', async () => {
    mockPreviewTier.mockResolvedValue({ current: { name: 'Ajo Growth' }, target: { name: 'Ajo Starter' }, decision: { direction: 'DOWNGRADE', timing: 'PERIOD_END', blockers: [] }, effectiveAt: null });
    const res = await request(app).get('/api/admin/ajo-oversight/groups/3/tier-preview?targetAddonId=2').set('x-test-user', STAFF('SUPPORT_AGENT'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ direction: 'DOWNGRADE', timing: 'PERIOD_END', from: 'Ajo Growth', to: 'Ajo Starter' });
    expect(mockChangeTier).not.toHaveBeenCalled();
  });
});
