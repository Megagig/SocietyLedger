/**
 * The Ajo payout and levy routes over HTTP (T5): the real routers and controllers, with sign-in, permission checks, services and the
 * database stood in for. What is under test is the wiring: who can reach what, the add-on gate and read-only mode, the upload checks, how
 * input becomes what the services receive, the staff roles for the levy, and that nothing private ever leaves the API.
 */
import express from 'express';
import request from 'supertest';

const mockPerms = new Map<number, string[]>();
const svc = {
  previewPayout: jest.fn(),
  preparePayout: jest.fn(),
  prepareAllReady: jest.fn(),
  approvePayout: jest.fn(),
  voidPayout: jest.fn(),
  recordPayoutPaid: jest.fn(),
  reversePaidPayout: jest.fn(),
  listPayouts: jest.fn(),
  getPayout: jest.fn(),
  listOwnPayouts: jest.fn(),
  completeGroup: jest.fn(),
  listAssociationLevy: jest.fn(),
  listLevy: jest.fn(),
  levyReport: jest.fn(),
  setLevyStatus: jest.fn(),
};
const mockDb = { member: { findFirst: jest.fn() }, ajoMembership: { findFirst: jest.fn() }, ajoGroup: { findFirst: jest.fn() }, ajoContribution: { findFirst: jest.fn() }, ajoCollectorAssignment: { findFirst: jest.fn() } };
const mockModuleStatus = jest.fn();

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
  requirePermission: (key: string) => (req: express.Request, res: express.Response, next: express.NextFunction) =>
    (mockPerms.get(req.user!.id) ?? []).includes(key) ? next() : res.status(403).json({ success: false, code: 'FORBIDDEN' }),
  requireAnyPermission: (keys: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) =>
    keys.some((k) => (mockPerms.get(req.user!.id) ?? []).includes(k)) ? next() : res.status(403).json({ success: false, code: 'FORBIDDEN' }),
  requirePlatformRole: (roles: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) =>
    roles.includes(String(req.user!.platformRole)) ? next() : res.status(403).json({ success: false, code: 'FORBIDDEN' }),
}));
jest.mock('../../src/services/rbac.service', () => ({
  RBACService: { hasPermission: jest.fn(async (ctx: { userId: number }, key: string) => (mockPerms.get(ctx.userId) ?? []).includes(key)) },
}));
jest.mock('../../src/services/module-feature.service', () => ({
  ModuleFeatureService: { getModuleStatus: (...a: unknown[]) => mockModuleStatus(...a), isFeatureEnabled: jest.fn(async () => true), getFeatureStatus: jest.fn() },
}));
jest.mock('../../src/modules/ajo/ajo-capacity', () => ({ contributorCapacity: jest.fn(async () => ({ limit: 30, count: 3 })) }));

const pass = <K extends keyof typeof svc>(name: K) => (...a: unknown[]) => svc[name](...a);
jest.mock('../../src/modules/ajo/ajo-payout.service', () => ({
  previewPayout: pass('previewPayout'),
  preparePayout: pass('preparePayout'),
  prepareAllReady: pass('prepareAllReady'),
  approvePayout: pass('approvePayout'),
  voidPayout: pass('voidPayout'),
  recordPayoutPaid: pass('recordPayoutPaid'),
  reversePaidPayout: pass('reversePaidPayout'),
  listPayouts: pass('listPayouts'),
  getPayout: pass('getPayout'),
  listOwnPayouts: pass('listOwnPayouts'),
  completeGroup: pass('completeGroup'),
}));
jest.mock('../../src/modules/ajo/ajo-levy.service', () => ({ listAssociationLevy: pass('listAssociationLevy'), listLevy: pass('listLevy'), levyReport: pass('levyReport'), setLevyStatus: pass('setLevyStatus') }));
// The T2, T3 and T4 pieces the router also loads.
jest.mock('../../src/modules/ajo/ajo-contribution.service', () => ({ recordCash: jest.fn(), reportTransfer: jest.fn(), confirmTransfer: jest.fn(), rejectContribution: jest.fn(), reverseContribution: jest.fn(), listMembershipContributions: jest.fn(), listGroupContributions: jest.fn(), getProofLink: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-handover.service', () => ({ collectorDaySummary: jest.fn(), createHandover: jest.fn(), listHandovers: jest.fn(), getHandover: jest.fn(), reconcileHandover: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-receipt.service', () => ({ flushQueuedReceipts: jest.fn(), listReceipts: jest.fn(), queuedReceiptCount: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-group.service', () => ({ listGroups: jest.fn(), createGroup: jest.fn(), getGroupDetail: jest.fn(), updateGroup: jest.fn(), openGroup: jest.fn(), startGroup: jest.fn(), cancelGroup: jest.fn(), getGroupBankAccount: jest.fn(), assertGroupVisible: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-membership.service', () => ({ approveMembership: jest.fn(), addMember: jest.fn(), setShares: jest.fn(), leaveMembership: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-views.service', () => ({ listGroupMembers: jest.fn(), listMembershipInstallments: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-rules.service', () => ({ publishRuleVersion: jest.fn(), listRuleVersions: jest.fn(), acceptanceStats: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-consent.service', () => ({ acceptRules: jest.fn(), rulesToAccept: jest.fn(), recordGuarantorConsent: jest.fn(), previewGuarantorWording: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-order.service', () => ({ runDraw: jest.fn(), getOrder: jest.fn(), requestSwap: jest.fn(), decideSwap: jest.fn(), emergencyException: jest.fn(), listSwapRequests: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-collector.service', () => ({ assignCollector: jest.fn(), unassignCollector: jest.fn(), listGroupAssignments: jest.fn(), listAssignedContributors: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-phone-code.service', () => ({ requestPhoneCode: jest.fn(), confirmPhoneCode: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-payout-account.service', () => ({ getPayoutAccount: jest.fn(), setPayoutAccount: jest.fn(), revealAccountNumber: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-verification.service', () => ({ latestVerification: jest.fn(), resubmitVerification: jest.fn() }));

import { RuleError } from '../../src/modules/finance/rule-error';
import ajoRoutes from '../../src/modules/ajo/ajo.routes';
import levyAdminRoutes from '../../src/modules/ajo/ajo-levy-admin.routes';

const app = express();
app.use(express.json());
app.use('/api/ajo', ajoRoutes);
app.use('/api/admin/ajo-levy', levyAdminRoutes);

const ASSOC = 5;
const as = (id: number) => JSON.stringify({ id, associationId: ASSOC, platformRole: null });
const STAFF = (role: string) => JSON.stringify({ id: 900, associationId: null, platformRole: role });
const MEMBER = 2;
const OFFICER = 6; // ajo.manage
const RECONCILER = 5; // ajo.reconcile
const ADMIN = 3; // ajo.approve_payout (and manage)
const STRANGER = 7;
const KEY = 'idem-key-12345';

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms.set(MEMBER, ['ajo.view_own', 'ajo.contribute']);
  mockPerms.set(OFFICER, ['ajo.view_own', 'ajo.manage']);
  mockPerms.set(RECONCILER, ['ajo.reconcile']);
  mockPerms.set(ADMIN, ['ajo.view_own', 'ajo.manage', 'ajo.approve_payout']);
  mockPerms.set(STRANGER, ['ajo.view_own']);
  mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: true, source: 'addon' });
  mockDb.ajoGroup.findFirst.mockResolvedValue({ id: 1 });
});

describe('who can reach what', () => {
  it('lets only an officer prepare, only an admin approve, reverse and complete, and only a reconciler record or fail', async () => {
    const asks: Array<[string, string, number]> = [
      ['post', '/api/ajo/groups/1/payouts', MEMBER],
      ['post', '/api/ajo/groups/1/payouts', RECONCILER],
      ['post', '/api/ajo/groups/1/payouts/prepare-all', STRANGER],
      ['post', '/api/ajo/payouts/4/approve', OFFICER],
      ['post', '/api/ajo/payouts/4/approve', RECONCILER],
      ['post', '/api/ajo/payouts/4/record-paid', OFFICER],
      ['post', '/api/ajo/payouts/4/record-paid', ADMIN],
      ['post', '/api/ajo/payouts/4/fail', OFFICER],
      ['post', '/api/ajo/payouts/4/reverse', OFFICER],
      ['post', '/api/ajo/payouts/4/reverse', RECONCILER],
      ['post', '/api/ajo/groups/1/complete', OFFICER],
      ['post', '/api/ajo/payouts/4/void', MEMBER],
      ['post', '/api/ajo/payouts/4/void', RECONCILER],
    ];
    for (const [method, url, user] of asks) {
      const res = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[method](url).set('x-test-user', as(user)).send({});
      expect(`${method} ${url} as ${user}: ${res.status}`).toBe(`${method} ${url} as ${user}: 403`);
    }
    for (const fn of Object.values(svc)) expect(fn).not.toHaveBeenCalled();
  });

  it('lets officers, reconcilers and admins read the payouts, and a plain member only their own', async () => {
    svc.previewPayout.mockResolvedValue({});
    svc.listPayouts.mockResolvedValue([]);
    svc.getPayout.mockResolvedValue({});
    svc.listOwnPayouts.mockResolvedValue([{ id: 1 }]);
    for (const user of [OFFICER, RECONCILER, ADMIN]) {
      for (const url of ['/api/ajo/groups/1/payouts/preview?round=1', '/api/ajo/groups/1/payouts', '/api/ajo/payouts/4']) {
        expect((await request(app).get(url).set('x-test-user', as(user))).status).toBe(200);
      }
    }
    for (const url of ['/api/ajo/groups/1/payouts/preview?round=1', '/api/ajo/groups/1/payouts', '/api/ajo/payouts/4']) expect((await request(app).get(url).set('x-test-user', as(MEMBER))).status).toBe(403);
    const mine = await request(app).get('/api/ajo/payouts/mine').set('x-test-user', as(MEMBER));
    expect(mine.status).toBe(200);
    expect(svc.listOwnPayouts).toHaveBeenCalledWith({ associationId: ASSOC, userId: MEMBER });
    expect(svc.getPayout).toHaveBeenCalledTimes(3); // "mine" was not mistaken for a payout number
  });

  it('shows the levy a group has been charged to officers and admins, not to members', async () => {
    svc.listAssociationLevy.mockResolvedValue({ owed: '₦3,750.00', items: [] });
    expect((await request(app).get('/api/ajo/levy').set('x-test-user', as(OFFICER))).status).toBe(200);
    expect((await request(app).get('/api/ajo/levy').set('x-test-user', as(ADMIN))).status).toBe(200);
    expect((await request(app).get('/api/ajo/levy').set('x-test-user', as(MEMBER))).status).toBe(403);
    expect(svc.listAssociationLevy).toHaveBeenCalledWith(ASSOC);
  });
});

describe('the add-on gate', () => {
  it('after the add-on expires, keeps payouts readable and refuses every write with ADDON_EXPIRED', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    svc.listPayouts.mockResolvedValue([]);
    svc.previewPayout.mockResolvedValue({});
    svc.listOwnPayouts.mockResolvedValue([]);
    svc.listAssociationLevy.mockResolvedValue({ items: [] });
    expect((await request(app).get('/api/ajo/groups/1/payouts').set('x-test-user', as(OFFICER))).status).toBe(200);
    expect((await request(app).get('/api/ajo/groups/1/payouts/preview?round=1').set('x-test-user', as(OFFICER))).status).toBe(200);
    expect((await request(app).get('/api/ajo/payouts/mine').set('x-test-user', as(MEMBER))).status).toBe(200);
    expect((await request(app).get('/api/ajo/levy').set('x-test-user', as(ADMIN))).status).toBe(200);

    const writes = [
      request(app).post('/api/ajo/groups/1/payouts').set('x-test-user', as(OFFICER)).send({ round: 1 }),
      request(app).post('/api/ajo/groups/1/payouts/prepare-all').set('x-test-user', as(OFFICER)).send({}),
      request(app).post('/api/ajo/payouts/4/approve').set('x-test-user', as(ADMIN)).send({}),
      request(app).post('/api/ajo/payouts/4/void').set('x-test-user', as(ADMIN)).send({ reason: 'Cancelling it for a reason' }),
      request(app).post('/api/ajo/payouts/4/fail').set('x-test-user', as(RECONCILER)).send({ reason: 'The bank returned it' }),
      request(app).post('/api/ajo/payouts/4/record-paid').set('x-test-user', as(RECONCILER)).send({ reference: 'GTB-100200' }),
      request(app).post('/api/ajo/payouts/4/reverse').set('x-test-user', as(ADMIN)).send({ reason: 'The money came back to the group' }),
      request(app).post('/api/ajo/groups/1/complete').set('x-test-user', as(ADMIN)).send({}),
    ];
    for (const res of await Promise.all(writes)) {
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADDON_EXPIRED', readOnly: true });
    }
    for (const name of ['preparePayout', 'prepareAllReady', 'approvePayout', 'voidPayout', 'recordPayoutPaid', 'reversePaidPayout', 'completeGroup'] as const) expect(svc[name]).not.toHaveBeenCalled();
  });

  it('gives a tenant that never had the add-on MODULE_DISABLED', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    mockDb.ajoGroup.findFirst.mockResolvedValue(null);
    const res = await request(app).post('/api/ajo/groups/1/payouts').set('x-test-user', as(OFFICER)).send({ round: 1 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MODULE_DISABLED');
  });
});

describe('what the services receive', () => {
  it('prepares for a round or a participant, and says when a repeat was recognised', async () => {
    svc.preparePayout.mockResolvedValue({ payout: { id: 4 }, replayed: false });
    const res = await request(app).post('/api/ajo/groups/1/payouts').set('x-test-user', as(OFFICER)).send({ round: '2' });
    expect(res.status).toBe(201);
    expect(svc.preparePayout).toHaveBeenCalledWith({ associationId: ASSOC, groupId: 1, actorUserId: OFFICER, round: 2, membershipId: undefined });
    svc.preparePayout.mockResolvedValue({ payout: { id: 4 }, replayed: true });
    const again = await request(app).post('/api/ajo/groups/1/payouts').set('x-test-user', as(OFFICER)).send({ membershipId: 9 });
    expect(again.status).toBe(200);
    expect(again.body.message).toBe('A payout for this is already waiting.');
    expect((await request(app).post('/api/ajo/groups/1/payouts').set('x-test-user', as(OFFICER)).send({ round: 0 })).status).toBe(400);
    expect((await request(app).post('/api/ajo/groups/1/payouts').set('x-test-user', as(OFFICER)).send({ membershipId: 'abc' })).status).toBe(400);
  });

  it('passes the self-approval confirmation and note, and nothing that would let a caller choose who they are', async () => {
    svc.approvePayout.mockResolvedValue({ payout: { id: 4 }, replayed: false });
    await request(app).post('/api/ajo/payouts/4/approve').set('x-test-user', as(ADMIN)).send({ confirmSelfApproval: true, note: 'We have only one admin', actorUserId: 999 });
    expect(svc.approvePayout).toHaveBeenCalledWith({ associationId: ASSOC, payoutId: 4, actorUserId: ADMIN, confirmSelfApproval: true, note: 'We have only one admin' });
  });

  it('tells an admin from an officer when voiding, so an officer can only cancel their own preparation', async () => {
    svc.voidPayout.mockResolvedValue({ payout: { id: 4 }, replayed: false });
    await request(app).post('/api/ajo/payouts/4/void').set('x-test-user', as(OFFICER)).send({ reason: 'Prepared for the wrong round' });
    expect(svc.voidPayout).toHaveBeenLastCalledWith({ associationId: ASSOC, payoutId: 4, actorUserId: OFFICER, actorIsAdmin: false, reason: 'Prepared for the wrong round' });
    await request(app).post('/api/ajo/payouts/4/void').set('x-test-user', as(ADMIN)).send({ reason: 'The treasurer is away' });
    expect(svc.voidPayout).toHaveBeenLastCalledWith(expect.objectContaining({ actorIsAdmin: true }));
    await request(app).post('/api/ajo/payouts/4/fail').set('x-test-user', as(RECONCILER)).send({ reason: 'The bank returned the transfer' });
    expect(svc.voidPayout).toHaveBeenLastCalledWith({ associationId: ASSOC, payoutId: 4, actorUserId: RECONCILER, actorIsAdmin: false, reason: 'The bank returned the transfer', failed: true });
  });

  it('records the bank’s reference with an optional proof, kept in memory and never echoed back', async () => {
    svc.recordPayoutPaid.mockResolvedValue({ payout: { id: 4, status: 'PAID' }, replayed: false });
    const png = Buffer.from('not-really-a-picture');
    const res = await request(app).post('/api/ajo/payouts/4/record-paid').set('x-test-user', as(RECONCILER)).field('reference', 'GTB 0099-887766').attach('proof', png, { filename: 'slip.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    const call = svc.recordPayoutPaid.mock.calls[0][0];
    expect(call).toMatchObject({ associationId: ASSOC, payoutId: 4, actorUserId: RECONCILER, reference: 'GTB 0099-887766' });
    expect(call.proof.buffer.equals(png)).toBe(true);
    expect(call.proof.mimeType).toBe('image/png');
    expect(JSON.stringify(res.body)).not.toMatch(/payout-proofs|slip\.png/);

    const noFile = await request(app).post('/api/ajo/payouts/4/record-paid').set('x-test-user', as(RECONCILER)).send({ reference: 'GTB-100200', confirmOwn: true, note: 'I am the only treasurer' });
    expect(noFile.status).toBe(200);
    expect(svc.recordPayoutPaid.mock.calls[1][0]).toMatchObject({ reference: 'GTB-100200', confirmOwn: true, note: 'I am the only treasurer' });
    expect(svc.recordPayoutPaid.mock.calls[1][0].proof).toBeUndefined();
  });

  it('turns away a proof that is not a picture or a PDF, or is too big, before any service runs', async () => {
    const wrong = await request(app).post('/api/ajo/payouts/4/record-paid').set('x-test-user', as(RECONCILER)).field('reference', 'GTB-100200').attach('proof', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toMatchObject({ code: 'INVALID_PROOF' });
    const big = await request(app).post('/api/ajo/payouts/4/record-paid').set('x-test-user', as(RECONCILER)).field('reference', 'GTB-100200').attach('proof', Buffer.alloc(5 * 1024 * 1024 + 10), { filename: 'huge.png', contentType: 'image/png' });
    expect(big.status).toBe(400);
    expect(svc.recordPayoutPaid).not.toHaveBeenCalled();
  });

  it('maps a rule error to its status and code, with the reason in words', async () => {
    svc.approvePayout.mockRejectedValue(new RuleError('The recipient changed their payout account, so this payout has been cancelled.', 409, 'ACCOUNT_CHANGED'));
    const res = await request(app).post('/api/ajo/payouts/4/approve').set('x-test-user', as(ADMIN)).send({});
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'ACCOUNT_CHANGED' });
    svc.preparePayout.mockRejectedValue(new RuleError('Round 1 has not been paid yet.', 409, 'PREVIOUS_ROUND_NOT_PAID'));
    expect((await request(app).post('/api/ajo/groups/1/payouts').set('x-test-user', as(OFFICER)).send({ round: 2 })).body.code).toBe('PREVIOUS_ROUND_NOT_PAID');
  });

  it('never sends the account number: a payout shows the masked account only', async () => {
    svc.getPayout.mockResolvedValue({ id: 4, account: { bankName: 'GTBank', accountName: 'Adaeze', masked: '••••6789' }, net: '₦20,000.00' });
    const res = await request(app).get('/api/ajo/payouts/4').set('x-test-user', as(RECONCILER));
    expect(JSON.stringify(res.body)).not.toContain('0123456789');
    expect(res.body.data.account.masked).toBe('••••6789');
  });
});

describe('the staff levy routes', () => {
  it('lets finance, support and super admins look, and only finance and super admins waive or void', async () => {
    svc.listLevy.mockResolvedValue({ total: 0, items: [] });
    svc.levyReport.mockResolvedValue({ associations: [], totals: {} });
    svc.setLevyStatus.mockResolvedValue({ levy: { id: 4, status: 'WAIVED' }, replayed: false });
    for (const role of ['SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_AGENT']) {
      expect((await request(app).get('/api/admin/ajo-levy').set('x-test-user', STAFF(role))).status).toBe(200);
      expect((await request(app).get('/api/admin/ajo-levy/report').set('x-test-user', STAFF(role))).status).toBe(200);
    }
    expect((await request(app).get('/api/admin/ajo-levy').set('x-test-user', STAFF('COMPLIANCE_ADMIN'))).status).toBe(403);
    expect((await request(app).get('/api/admin/ajo-levy').set('x-test-user', as(ADMIN))).status).toBe(403); // a group admin is not staff
    expect((await request(app).get('/api/admin/ajo-levy')).status).toBe(401);

    for (const role of ['SUPER_ADMIN', 'FINANCE_ADMIN']) {
      expect((await request(app).post('/api/admin/ajo-levy/4/waive').set('x-test-user', STAFF(role)).send({ reason: 'Goodwill after a billing mistake' })).status).toBe(200);
    }
    for (const role of ['SUPPORT_AGENT', 'COMPLIANCE_ADMIN']) {
      expect((await request(app).post('/api/admin/ajo-levy/4/waive').set('x-test-user', STAFF(role)).send({ reason: 'Goodwill after a billing mistake' })).status).toBe(403);
      expect((await request(app).post('/api/admin/ajo-levy/4/void').set('x-test-user', STAFF(role)).send({ reason: 'Charged to the wrong group' })).status).toBe(403);
    }
    expect(svc.setLevyStatus).toHaveBeenCalledTimes(2);
    expect(svc.setLevyStatus.mock.calls[0][0]).toMatchObject({ id: 4, to: 'WAIVED', reason: 'Goodwill after a billing mistake', staffId: 900, staffRole: 'SUPER_ADMIN' });
  });

  it('filters the list, validates input, and maps errors', async () => {
    svc.listLevy.mockResolvedValue({ total: 0, items: [] });
    await request(app).get('/api/admin/ajo-levy?status=ACCRUED&associationId=5&take=10').set('x-test-user', STAFF('FINANCE_ADMIN'));
    expect(svc.listLevy).toHaveBeenCalledWith({ status: 'ACCRUED', associationId: 5, take: 10 });
    expect((await request(app).get('/api/admin/ajo-levy?status=MAYBE').set('x-test-user', STAFF('FINANCE_ADMIN'))).status).toBe(400);
    expect((await request(app).post('/api/admin/ajo-levy/abc/void').set('x-test-user', STAFF('FINANCE_ADMIN')).send({ reason: 'Charged to the wrong group' })).status).toBe(400);
    svc.setLevyStatus.mockRejectedValue(new RuleError('A paid levy cannot be changed.', 409, 'INVALID_LEVY_STATE'));
    const res = await request(app).post('/api/admin/ajo-levy/4/void').set('x-test-user', STAFF('FINANCE_ADMIN')).send({ reason: 'Charged to the wrong group' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_LEVY_STATE');
  });
});
