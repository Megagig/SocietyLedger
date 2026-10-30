/**
 * The Ajo contribution routes over HTTP (T4): the real routers and controller, with sign-in, permission checks, services and the database
 * stood in for. What is under test is the wiring: who can reach what, the add-on gate and read-only mode, the upload checks, how input
 * becomes what the services receive, and that nothing private (a storage key, a file hash) is ever sent out.
 */
import express from 'express';
import request from 'supertest';

const mockPerms = new Map<number, string[]>();
const svc = {
  recordCash: jest.fn(),
  reportTransfer: jest.fn(),
  confirmTransfer: jest.fn(),
  rejectContribution: jest.fn(),
  reverseContribution: jest.fn(),
  listMembershipContributions: jest.fn(),
  listGroupContributions: jest.fn(),
  recordReceivedTransfer: jest.fn(),
  listWaitingContributions: jest.fn(),
  countWaitingContributions: jest.fn(),
  getProofLink: jest.fn(),
  collectorDaySummary: jest.fn(),
  createHandover: jest.fn(),
  listHandovers: jest.fn(),
  getHandover: jest.fn(),
  reconcileHandover: jest.fn(),
  flushQueuedReceipts: jest.fn(),
  listReceipts: jest.fn(),
  queuedReceiptCount: jest.fn(),
};
const mockDb = {
  member: { findFirst: jest.fn() },
  ajoMembership: { findFirst: jest.fn() },
  ajoGroup: { findFirst: jest.fn() },
  ajoContribution: { findFirst: jest.fn() },
  ajoCollectorAssignment: { findFirst: jest.fn() },
};
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
  requirePlatformRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
jest.mock('../../src/services/rbac.service', () => ({
  RBACService: { hasPermission: jest.fn(async (ctx: { userId: number }, key: string) => (mockPerms.get(ctx.userId) ?? []).includes(key)) },
}));
jest.mock('../../src/services/module-feature.service', () => ({
  ModuleFeatureService: { getModuleStatus: (...a: unknown[]) => mockModuleStatus(...a), isFeatureEnabled: jest.fn(async () => true), getFeatureStatus: jest.fn() },
}));
jest.mock('../../src/modules/ajo/ajo-capacity', () => ({ contributorCapacity: jest.fn(async () => ({ limit: 30, count: 3 })) }));

const pass = <K extends keyof typeof svc>(name: K) => (...a: unknown[]) => svc[name](...a);
jest.mock('../../src/modules/ajo/ajo-contribution.service', () => ({
  recordCash: pass('recordCash'),
  reportTransfer: pass('reportTransfer'),
  confirmTransfer: pass('confirmTransfer'),
  rejectContribution: pass('rejectContribution'),
  reverseContribution: pass('reverseContribution'),
  listMembershipContributions: pass('listMembershipContributions'),
  listGroupContributions: pass('listGroupContributions'),
  recordReceivedTransfer: pass('recordReceivedTransfer'),
  listWaitingContributions: pass('listWaitingContributions'),
  countWaitingContributions: pass('countWaitingContributions'),
  getProofLink: pass('getProofLink'),
}));
jest.mock('../../src/modules/ajo/ajo-handover.service', () => ({
  collectorDaySummary: pass('collectorDaySummary'),
  createHandover: pass('createHandover'),
  listHandovers: pass('listHandovers'),
  getHandover: pass('getHandover'),
  reconcileHandover: pass('reconcileHandover'),
}));
jest.mock('../../src/modules/ajo/ajo-receipt.service', () => ({ flushQueuedReceipts: pass('flushQueuedReceipts'), listReceipts: pass('listReceipts'), queuedReceiptCount: pass('queuedReceiptCount') }));
// The T2 and T3 pieces the router also loads.
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

const app = express();
app.use(express.json());
app.use('/api/ajo', ajoRoutes);

const ASSOC = 5;
const as = (id: number) => JSON.stringify({ id, associationId: ASSOC, platformRole: null });
const MEMBER = 2;
const COLLECTOR = 4;
const RECONCILER = 5;
const OFFICER = 6;
const STRANGER = 7;
const KEY = 'idem-key-12345';

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms.set(MEMBER, ['ajo.view_own', 'ajo.contribute']);
  mockPerms.set(COLLECTOR, ['ajo.collect']);
  mockPerms.set(RECONCILER, ['ajo.reconcile']);
  mockPerms.set(OFFICER, ['ajo.view_own', 'ajo.manage']);
  mockPerms.set(STRANGER, ['ajo.view_own']);
  mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: true, source: 'addon' });
  mockDb.ajoGroup.findFirst.mockResolvedValue({ id: 1 });
  mockDb.ajoMembership.findFirst.mockResolvedValue({ member: { userId: MEMBER } });
  mockDb.ajoContribution.findFirst.mockResolvedValue({ membershipId: 9 });
  mockDb.ajoCollectorAssignment.findFirst.mockResolvedValue(null);
});

const png = Buffer.from('not-really-a-picture');

describe('who can reach what', () => {
  it('lets only a collector record cash, and only a reconciler decide', async () => {
    const asks: Array<[string, string, number]> = [
      ['post', '/api/ajo/groups/1/contributions/cash', MEMBER],
      ['post', '/api/ajo/groups/1/contributions/cash', OFFICER],
      ['post', '/api/ajo/groups/1/handovers', MEMBER],
      ['post', '/api/ajo/contributions/3/confirm', OFFICER],
      ['post', '/api/ajo/contributions/3/confirm', COLLECTOR],
      ['post', '/api/ajo/contributions/3/reject', MEMBER],
      ['post', '/api/ajo/contributions/3/reverse', COLLECTOR],
      ['post', '/api/ajo/handovers/8/reconcile', COLLECTOR],
      ['post', '/api/ajo/handovers/8/reconcile', OFFICER],
      ['get', '/api/ajo/groups/1/contributions', MEMBER],
      ['get', '/api/ajo/groups/1/handovers', COLLECTOR],
      ['get', '/api/ajo/handovers/8', MEMBER],
      ['post', '/api/ajo/receipts/send-queued', RECONCILER],
    ];
    for (const [method, url, user] of asks) {
      const res = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[method](url).set('x-test-user', as(user)).set('Idempotency-Key', KEY).send({});
      expect(`${method} ${url} as ${user}: ${res.status}`).toBe(`${method} ${url} as ${user}: 403`);
    }
    for (const fn of Object.values(svc)) expect(fn).not.toHaveBeenCalled();
  });

  it('lets a contributor or an officer report a transfer, and no one else', async () => {
    svc.reportTransfer.mockResolvedValue({ contribution: { id: 1 }, replayed: false, possibleDuplicate: false });
    const send = (user: number) => request(app).post('/api/ajo/groups/1/contributions/transfer').set('x-test-user', as(user)).set('Idempotency-Key', KEY).send({ membershipId: 9, amountKobo: 500000, bankReference: 'TRF-123456' });
    expect((await send(MEMBER)).status).toBe(201);
    expect((await send(OFFICER)).status).toBe(201);
    expect((await send(COLLECTOR)).status).toBe(403);
    expect((await send(RECONCILER)).status).toBe(403);
    expect(svc.reportTransfer).toHaveBeenCalledTimes(2);
  });

  it('lets only someone who can confirm record a payment already seen at the bank, and needs the bank reference and a note', async () => {
    svc.recordReceivedTransfer.mockResolvedValue({ contribution: { id: 9 }, replayed: false });
    const body = { membershipId: 3, amountKobo: '500000', bankReference: 'NIP-123456', note: 'seen in the 14 Nov statement' };
    const post = (user: number, b: object) => request(app).post('/api/ajo/groups/1/contributions/record-received').set('x-test-user', as(user)).set('Idempotency-Key', 'key-123456789').send(b);
    expect((await post(MEMBER, body)).status).toBe(403);
    expect((await post(COLLECTOR, body)).status).toBe(403);
    expect((await post(OFFICER, body)).status).toBe(403);
    expect((await post(RECONCILER, { ...body, bankReference: '' })).status).toBe(400);
    expect((await post(RECONCILER, { ...body, note: '' })).status).toBe(400);
    const ok = await post(RECONCILER, body);
    expect(ok.status).toBe(201);
    expect(svc.recordReceivedTransfer).toHaveBeenCalledWith(expect.objectContaining({ associationId: ASSOC, groupId: 1, membershipId: 3, bankReference: 'NIP-123456', actorUserId: RECONCILER }));
  });

  it('shows the all-circles queue and its count to reconcilers and officers only', async () => {
    svc.listWaitingContributions.mockResolvedValue({ total: 0, items: [] });
    svc.countWaitingContributions.mockResolvedValue({ transfersToConfirm: 2, cashToCount: 0 });
    for (const path of ['/api/ajo/payments/waiting', '/api/ajo/payments/waiting/count']) {
      expect((await request(app).get(path).set('x-test-user', as(MEMBER))).status).toBe(403);
      expect((await request(app).get(path).set('x-test-user', as(COLLECTOR))).status).toBe(403);
      expect((await request(app).get(path).set('x-test-user', as(RECONCILER))).status).toBe(200);
      expect((await request(app).get(path).set('x-test-user', as(OFFICER))).status).toBe(200);
    }
  });

  it('lets reconcilers and officers see the queue, and a collector see only their own day', async () => {
    svc.listGroupContributions.mockResolvedValue({ total: 0, items: [] });
    svc.collectorDaySummary.mockResolvedValue({ forDate: '2027-03-01' });
    expect((await request(app).get('/api/ajo/groups/1/contributions').set('x-test-user', as(RECONCILER))).status).toBe(200);
    expect((await request(app).get('/api/ajo/groups/1/contributions').set('x-test-user', as(OFFICER))).status).toBe(200);

    expect((await request(app).get('/api/ajo/groups/1/collector-day').set('x-test-user', as(COLLECTOR))).status).toBe(200);
    expect(svc.collectorDaySummary).toHaveBeenLastCalledWith({ associationId: ASSOC, groupId: 1, collectorUserId: COLLECTOR, forDate: undefined });
    // Asking for another collector's day is refused for a collector, and allowed for a reconciler.
    expect((await request(app).get(`/api/ajo/groups/1/collector-day?collectorUserId=${OFFICER}`).set('x-test-user', as(COLLECTOR))).status).toBe(403);
    expect((await request(app).get(`/api/ajo/groups/1/collector-day?collectorUserId=${COLLECTOR}&date=2027-03-01`).set('x-test-user', as(RECONCILER))).status).toBe(200);
    expect(svc.collectorDaySummary).toHaveBeenLastCalledWith(expect.objectContaining({ collectorUserId: COLLECTOR, forDate: new Date('2027-03-01T00:00:00.000Z') }));
  });

  it('shows a payment history to the person, to officers and to the assigned collector, and to no one else', async () => {
    svc.listMembershipContributions.mockResolvedValue([]);
    const ask = (user: number) => request(app).get('/api/ajo/memberships/9/contributions').set('x-test-user', as(user));
    mockPerms.set(COLLECTOR, ['ajo.collect', 'ajo.view_own']);
    expect((await ask(MEMBER)).status).toBe(200);
    expect(svc.listMembershipContributions).toHaveBeenLastCalledWith({ associationId: ASSOC, membershipId: 9, officer: false });
    expect((await ask(OFFICER)).status).toBe(200);
    expect(svc.listMembershipContributions).toHaveBeenLastCalledWith({ associationId: ASSOC, membershipId: 9, officer: true });
    expect((await ask(RECONCILER)).status).toBe(403); // no read permission at all on this route
    expect((await ask(STRANGER)).status).toBe(404);
    expect((await ask(COLLECTOR)).status).toBe(404);
    mockDb.ajoCollectorAssignment.findFirst.mockResolvedValue({ id: 1 });
    expect((await ask(COLLECTOR)).status).toBe(200);
    expect(svc.listMembershipContributions).toHaveBeenLastCalledWith({ associationId: ASSOC, membershipId: 9, officer: false });
  });

  it('keeps the receipts of one person’s payment from anyone who could not see that person’s payments', async () => {
    svc.listReceipts.mockResolvedValue([]);
    expect((await request(app).get('/api/ajo/contributions/3/receipts').set('x-test-user', as(MEMBER))).status).toBe(200);
    expect((await request(app).get('/api/ajo/contributions/3/receipts').set('x-test-user', as(STRANGER))).status).toBe(404);
    mockDb.ajoContribution.findFirst.mockResolvedValue(null);
    expect((await request(app).get('/api/ajo/contributions/3/receipts').set('x-test-user', as(OFFICER))).status).toBe(404);
  });
});

describe('the add-on gate', () => {
  it('after the add-on expires, keeps payments readable and refuses every write with ADDON_EXPIRED', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    svc.listGroupContributions.mockResolvedValue({ total: 0, items: [] });
    svc.listHandovers.mockResolvedValue([]);
    svc.collectorDaySummary.mockResolvedValue({});
    svc.listMembershipContributions.mockResolvedValue([]);
    expect((await request(app).get('/api/ajo/groups/1/contributions').set('x-test-user', as(RECONCILER))).status).toBe(200);
    expect((await request(app).get('/api/ajo/groups/1/handovers').set('x-test-user', as(RECONCILER))).status).toBe(200);
    expect((await request(app).get('/api/ajo/groups/1/collector-day').set('x-test-user', as(COLLECTOR))).status).toBe(200);
    expect((await request(app).get('/api/ajo/memberships/9/contributions').set('x-test-user', as(MEMBER))).status).toBe(200);

    const writes = [
      request(app).post('/api/ajo/groups/1/contributions/cash').set('x-test-user', as(COLLECTOR)).set('Idempotency-Key', KEY).send({ membershipId: 9, amountKobo: 500000 }),
      request(app).post('/api/ajo/groups/1/contributions/transfer').set('x-test-user', as(MEMBER)).set('Idempotency-Key', KEY).send({ membershipId: 9, amountKobo: 500000, bankReference: 'TRF-123456' }),
      request(app).post('/api/ajo/contributions/3/confirm').set('x-test-user', as(RECONCILER)).send({}),
      request(app).post('/api/ajo/contributions/3/reject').set('x-test-user', as(RECONCILER)).send({ reason: 'The bank does not show it' }),
      request(app).post('/api/ajo/contributions/3/reverse').set('x-test-user', as(RECONCILER)).send({ reason: 'Recorded against the wrong person' }),
      request(app).post('/api/ajo/groups/1/handovers').set('x-test-user', as(COLLECTOR)).set('Idempotency-Key', KEY).send({ handedOverKobo: 500000 }),
      request(app).post('/api/ajo/handovers/8/reconcile').set('x-test-user', as(RECONCILER)).send({ countedKobo: 500000 }),
      request(app).post('/api/ajo/receipts/send-queued').set('x-test-user', as(OFFICER)).send({}),
    ];
    for (const res of await Promise.all(writes)) {
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADDON_EXPIRED', readOnly: true });
    }
    for (const name of ['recordCash', 'reportTransfer', 'confirmTransfer', 'rejectContribution', 'reverseContribution', 'createHandover', 'reconcileHandover', 'flushQueuedReceipts'] as const) expect(svc[name]).not.toHaveBeenCalled();
  });

  it('gives a tenant that never had the add-on MODULE_DISABLED', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    mockDb.ajoGroup.findFirst.mockResolvedValue(null);
    const res = await request(app).post('/api/ajo/groups/1/contributions/cash').set('x-test-user', as(COLLECTOR)).set('Idempotency-Key', KEY).send({ membershipId: 9, amountKobo: 500000 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MODULE_DISABLED');
    expect(svc.recordCash).not.toHaveBeenCalled();
  });
});

describe('what the services receive', () => {
  it('passes the idempotency key, the amount as a bigint and who is asking, and says when a repeat was recognised', async () => {
    svc.recordCash.mockResolvedValue({ contribution: { id: 1 }, replayed: false });
    const res = await request(app).post('/api/ajo/groups/1/contributions/cash').set('x-test-user', as(COLLECTOR)).set('Idempotency-Key', KEY).send({ membershipId: 9, amountKobo: '500000' });
    expect(res.status).toBe(201);
    expect(svc.recordCash).toHaveBeenCalledWith({ associationId: ASSOC, groupId: 1, membershipId: 9, amountKobo: 500000n, idempotencyKey: KEY, actorUserId: COLLECTOR, actorCanManage: false });

    svc.recordCash.mockResolvedValue({ contribution: { id: 1 }, replayed: true });
    const again = await request(app).post('/api/ajo/groups/1/contributions/cash').set('x-test-user', as(COLLECTOR)).set('Idempotency-Key', KEY).send({ membershipId: 9, amountKobo: 500000 });
    expect(again.status).toBe(200);
    expect(again.body.message).toBe('Already recorded.');
  });

  it('marks an officer as able to manage, so the service lets them record for anyone', async () => {
    mockPerms.set(OFFICER, ['ajo.view_own', 'ajo.manage', 'ajo.collect']);
    svc.recordCash.mockResolvedValue({ contribution: { id: 1 }, replayed: false });
    await request(app).post('/api/ajo/groups/1/contributions/cash').set('x-test-user', as(OFFICER)).set('Idempotency-Key', KEY).send({ membershipId: 9, amountKobo: 500000 });
    expect(svc.recordCash).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: OFFICER, actorCanManage: true }));
  });

  it('rejects an amount of the wrong shape before any service runs', async () => {
    for (const amountKobo of [0, -5, '12.5', 'lots', 1.5, null]) {
      const res = await request(app).post('/api/ajo/groups/1/contributions/cash').set('x-test-user', as(COLLECTOR)).set('Idempotency-Key', KEY).send({ membershipId: 9, amountKobo });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    }
    expect((await request(app).post('/api/ajo/contributions/abc/confirm').set('x-test-user', as(RECONCILER)).send({})).status).toBe(400);
    expect((await request(app).post('/api/ajo/handovers/8/reconcile').set('x-test-user', as(RECONCILER)).send({ countedKobo: -1 })).status).toBe(400);
    expect(svc.recordCash).not.toHaveBeenCalled();
    expect(svc.reconcileHandover).not.toHaveBeenCalled();
  });

  it('passes a confirmation’s acknowledgement and note, and a reconcile’s ticked payments', async () => {
    svc.confirmTransfer.mockResolvedValue({ contributionId: 3, replayed: false, allocations: [{ installmentId: 1, amountKobo: 500000n }] });
    const res = await request(app).post('/api/ajo/contributions/3/confirm').set('x-test-user', as(RECONCILER)).send({ acknowledgeDuplicate: true, note: 'Different payment, checked', confirmOwn: false });
    expect(res.status).toBe(200);
    expect(svc.confirmTransfer).toHaveBeenCalledWith({ associationId: ASSOC, contributionId: 3, actorUserId: RECONCILER, acknowledgeDuplicate: true, note: 'Different payment, checked', confirmOwn: false });
    expect(res.body.data.allocations[0].amountKobo).toBe('500000'); // a bigint cannot travel as JSON, so it goes out as text

    svc.reconcileHandover.mockResolvedValue({ handoverId: 8, replayed: false, confirmed: 2, missing: 1 });
    await request(app).post('/api/ajo/handovers/8/reconcile').set('x-test-user', as(RECONCILER)).send({ countedKobo: '800000', receivedContributionIds: [11, 12], note: 'One was not handed in' });
    expect(svc.reconcileHandover).toHaveBeenCalledWith({ associationId: ASSOC, handoverId: 8, actorUserId: RECONCILER, countedKobo: 800000n, receivedContributionIds: [11, 12], note: 'One was not handed in', confirmOwn: undefined });
  });

  it('maps a rule error to its status and code', async () => {
    svc.confirmTransfer.mockRejectedValue(new RuleError('This proof already backs a confirmed payment.', 409, 'DUPLICATE_PROOF'));
    const res = await request(app).post('/api/ajo/contributions/3/confirm').set('x-test-user', as(RECONCILER)).send({});
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'DUPLICATE_PROOF' });
    svc.createHandover.mockRejectedValue(new RuleError('You have already handed over.', 409, 'ALREADY_HANDED_OVER'));
    expect((await request(app).post('/api/ajo/groups/1/handovers').set('x-test-user', as(COLLECTOR)).set('Idempotency-Key', KEY).send({ handedOverKobo: 0 })).body.code).toBe('ALREADY_HANDED_OVER');
  });

  it('hands over with the key and the collector’s own id, never anyone else’s', async () => {
    svc.createHandover.mockResolvedValue({ handoverId: 8, replayed: false });
    await request(app).post('/api/ajo/groups/1/handovers').set('x-test-user', as(COLLECTOR)).set('Idempotency-Key', KEY).send({ handedOverKobo: 600000, note: 'Kept bus fare', forDate: '2027-03-01', collectorUserId: 999 });
    expect(svc.createHandover).toHaveBeenCalledWith({ associationId: ASSOC, groupId: 1, collectorUserId: COLLECTOR, handedOverKobo: 600000n, note: 'Kept bus fare', forDate: new Date('2027-03-01T00:00:00.000Z'), idempotencyKey: KEY });
  });
});

describe('the proof upload', () => {
  const send = (user = MEMBER) => request(app).post('/api/ajo/groups/1/contributions/transfer').set('x-test-user', as(user)).set('Idempotency-Key', KEY);

  it('hands the file to the service in memory, with the fields that came with it', async () => {
    svc.reportTransfer.mockResolvedValue({ contribution: { id: 1 }, replayed: false, possibleDuplicate: false });
    const res = await send().field('membershipId', '9').field('amountKobo', '500000').field('bankReference', 'TRF-998877').field('paidOn', '2027-03-02').attach('proof', png, { filename: 'receipt.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const call = svc.reportTransfer.mock.calls[0][0];
    expect(call).toMatchObject({ associationId: ASSOC, groupId: 1, membershipId: 9, amountKobo: 500000n, idempotencyKey: KEY, actorUserId: MEMBER, actorCanManage: false, bankReference: 'TRF-998877' });
    expect(call.proof.mimeType).toBe('image/png');
    expect(Buffer.isBuffer(call.proof.buffer)).toBe(true);
    expect(call.proof.buffer.equals(png)).toBe(true);
    expect(call.paidOn).toEqual(new Date('2027-03-02T00:00:00.000Z'));
  });

  it('works without a file, as plain JSON, when there is a bank reference', async () => {
    svc.reportTransfer.mockResolvedValue({ contribution: { id: 1 }, replayed: false, possibleDuplicate: false });
    const res = await send().send({ membershipId: 9, amountKobo: 500000, bankReference: 'TRF-998877' });
    expect(res.status).toBe(201);
    expect(svc.reportTransfer.mock.calls[0][0].proof).toBeUndefined();
  });

  it('turns away a file that is not a picture or a PDF, or is too big, with a clear message', async () => {
    const wrongType = await send().field('membershipId', '9').field('amountKobo', '500000').attach('proof', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body).toMatchObject({ code: 'INVALID_PROOF' });
    expect(wrongType.body.message).toMatch(/JPEG, PNG or WebP/);

    const tooBig = await send().field('membershipId', '9').field('amountKobo', '500000').attach('proof', Buffer.alloc(5 * 1024 * 1024 + 10), { filename: 'huge.png', contentType: 'image/png' });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.message).toMatch(/5 MB/);
    expect(svc.reportTransfer).not.toHaveBeenCalled();
  });

  it('tells the contributor when a repeat was recognised, and whether the proof looks like one already used', async () => {
    svc.reportTransfer.mockResolvedValue({ contribution: { id: 1 }, replayed: true, possibleDuplicate: true });
    const res = await send().send({ membershipId: 9, amountKobo: 500000, bankReference: 'TRF-998877' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Already reported.');
    expect(res.body.data.possibleDuplicate).toBe(true);
  });
});

describe('what is never sent out', () => {
  it('gives the proof as a short-lived link that is never cached, and never the storage key', async () => {
    svc.getProofLink.mockResolvedValue({ url: 'https://files.test/signed?token=abc' });
    const res = await request(app).get('/api/ajo/contributions/3/proof').set('x-test-user', as(MEMBER));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(svc.getProofLink).toHaveBeenCalledWith(expect.objectContaining({ associationId: ASSOC, contributionId: 3, viewerUserId: MEMBER, viewerIsOfficer: false }));
    await request(app).get('/api/ajo/contributions/3/proof').set('x-test-user', as(OFFICER));
    expect(svc.getProofLink).toHaveBeenLastCalledWith(expect.objectContaining({ viewerIsOfficer: true }));
  });

  it('does not echo a bank reference or a file name back in an error', async () => {
    svc.reportTransfer.mockRejectedValue(new RuleError('That is more than this person still owes.', 409, 'EXCEEDS_OWED'));
    const res = await request(app).post('/api/ajo/groups/1/contributions/transfer').set('x-test-user', as(MEMBER)).set('Idempotency-Key', KEY).send({ membershipId: 9, amountKobo: 999999999, bankReference: 'TRF-SECRET-998877' });
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain('TRF-SECRET-998877');
  });

  it('reports the queue of waiting receipts when asked to send them', async () => {
    svc.flushQueuedReceipts.mockResolvedValue({ attempted: 3, sent: 1, stillQueued: 2 });
    svc.queuedReceiptCount.mockResolvedValue(2);
    const res = await request(app).post('/api/ajo/receipts/send-queued').set('x-test-user', as(OFFICER)).send({});
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/2 still waiting/);
    expect(res.body.data).toMatchObject({ sent: 1, stillQueued: 2, waiting: 2 });
    expect(svc.flushQueuedReceipts).toHaveBeenCalledWith({ associationId: ASSOC });
  });
});
