/**
 * The Ajo group routes over HTTP (T3): the real routers, with sign-in, permission checks, services and the database stood in for.
 * What is under test is the wiring: who can reach what, the add-on gate and read-only mode, the plan's feature gate, validation, how
 * input becomes what the services receive, and that a full bank account number only ever comes from its one endpoint.
 */
import express from 'express';
import request from 'supertest';

const mockPerms = new Map<number, string[]>();
const svc = {
  listGroups: jest.fn(),
  createGroup: jest.fn(),
  getGroupDetail: jest.fn(),
  updateGroup: jest.fn(),
  openGroup: jest.fn(),
  startGroup: jest.fn(),
  cancelGroup: jest.fn(),
  getGroupBankAccount: jest.fn(),
  assertGroupVisible: jest.fn(),
  addMember: jest.fn(),
  setShares: jest.fn(),
  leaveMembership: jest.fn(),
  listGroupMembers: jest.fn(),
  listMembershipInstallments: jest.fn(),
  publishRuleVersion: jest.fn(),
  listRuleVersions: jest.fn(),
  acceptanceStats: jest.fn(),
  acceptRules: jest.fn(),
  rulesToAccept: jest.fn(),
  recordGuarantorConsent: jest.fn(),
  previewGuarantorWording: jest.fn(),
  runDraw: jest.fn(),
  getOrder: jest.fn(),
  requestSwap: jest.fn(),
  decideSwap: jest.fn(),
  emergencyException: jest.fn(),
  listSwapRequests: jest.fn(),
  assignCollector: jest.fn(),
  unassignCollector: jest.fn(),
  listGroupAssignments: jest.fn(),
  listAssignedContributors: jest.fn(),
};
const mockDb = {
  member: { findFirst: jest.fn() },
  ajoMembership: { findFirst: jest.fn() },
  ajoGroup: { findFirst: jest.fn() },
  ajoCollectorAssignment: { findFirst: jest.fn() },
};
const mockModuleStatus = jest.fn();
const mockFeature = jest.fn();

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
  ModuleFeatureService: { getModuleStatus: (...a: unknown[]) => mockModuleStatus(...a), isFeatureEnabled: (...a: unknown[]) => mockFeature(...a), getFeatureStatus: jest.fn() },
}));
jest.mock('../../src/modules/ajo/ajo-capacity', () => ({ contributorCapacity: jest.fn(async () => ({ limit: 30, count: 3 })) }));

const pass = <K extends keyof typeof svc>(name: K) => (...a: unknown[]) => svc[name](...a);
jest.mock('../../src/modules/ajo/ajo-group.service', () => ({
  listGroups: pass('listGroups'),
  createGroup: pass('createGroup'),
  getGroupDetail: pass('getGroupDetail'),
  updateGroup: pass('updateGroup'),
  openGroup: pass('openGroup'),
  startGroup: pass('startGroup'),
  cancelGroup: pass('cancelGroup'),
  getGroupBankAccount: pass('getGroupBankAccount'),
  assertGroupVisible: pass('assertGroupVisible'),
}));
jest.mock('../../src/modules/ajo/ajo-membership.service', () => ({
  approveMembership: jest.fn(),
  addMember: pass('addMember'),
  setShares: pass('setShares'),
  leaveMembership: pass('leaveMembership'),
}));
jest.mock('../../src/modules/ajo/ajo-views.service', () => ({ listGroupMembers: pass('listGroupMembers'), listMembershipInstallments: pass('listMembershipInstallments') }));
jest.mock('../../src/modules/ajo/ajo-rules.service', () => ({ publishRuleVersion: pass('publishRuleVersion'), listRuleVersions: pass('listRuleVersions'), acceptanceStats: pass('acceptanceStats') }));
jest.mock('../../src/modules/ajo/ajo-consent.service', () => ({ acceptRules: pass('acceptRules'), rulesToAccept: pass('rulesToAccept'), recordGuarantorConsent: pass('recordGuarantorConsent'), previewGuarantorWording: pass('previewGuarantorWording') }));
jest.mock('../../src/modules/ajo/ajo-order.service', () => ({ runDraw: pass('runDraw'), getOrder: pass('getOrder'), requestSwap: pass('requestSwap'), decideSwap: pass('decideSwap'), emergencyException: pass('emergencyException'), listSwapRequests: pass('listSwapRequests') }));
jest.mock('../../src/modules/ajo/ajo-collector.service', () => ({ assignCollector: pass('assignCollector'), unassignCollector: pass('unassignCollector'), listGroupAssignments: pass('listGroupAssignments'), listAssignedContributors: pass('listAssignedContributors') }));
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
const OFFICER = 1;
const MEMBER = 2;
const ADMIN = 3;
const COLLECTOR = 4;
const MEMBER_PERMS = ['ajo.view_own', 'ajo.contribute'];

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms.set(OFFICER, [...MEMBER_PERMS, 'ajo.manage']);
  mockPerms.set(MEMBER, MEMBER_PERMS);
  mockPerms.set(ADMIN, [...MEMBER_PERMS, 'ajo.manage', 'ajo.approve_payout']);
  mockPerms.set(COLLECTOR, ['ajo.collect']);
  mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: true, source: 'addon' });
  mockFeature.mockResolvedValue(true);
  mockDb.ajoGroup.findFirst.mockResolvedValue({ id: 1, model: 'COLLECTOR_THRIFT' });
  mockDb.ajoMembership.findFirst.mockResolvedValue({ member: { userId: MEMBER } });
  mockDb.ajoCollectorAssignment.findFirst.mockResolvedValue(null);
  mockDb.member.findFirst.mockResolvedValue({ id: 20 });
  svc.assertGroupVisible.mockResolvedValue({ id: 1 });
});

const NEW_GROUP = { name: 'Market Circle', model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', contributionKobo: 500000, startDate: '2027-03-01', cycleLength: 8, maxParticipants: 20 };

describe('who can reach what', () => {
  const ownerOnly: Array<[string, string, string]> = [
    ['post', '/api/ajo/groups', 'create a group'],
    ['patch', '/api/ajo/groups/1', 'edit a group'],
    ['post', '/api/ajo/groups/1/open', 'open a group'],
    ['post', '/api/ajo/groups/1/start', 'start a group'],
    ['post', '/api/ajo/groups/1/cancel', 'cancel a group'],
    ['get', '/api/ajo/groups/1/members', 'see the roster'],
    ['post', '/api/ajo/groups/1/members', 'add a person'],
    ['patch', '/api/ajo/memberships/9/shares', 'change shares'],
    ['post', '/api/ajo/groups/1/rules', 'publish rules'],
    ['post', '/api/ajo/memberships/9/guarantor', 'record a guarantor'],
    ['post', '/api/ajo/groups/1/draw', 'run the draw'],
    ['get', '/api/ajo/groups/1/swaps', 'see swap requests'],
    ['post', '/api/ajo/memberships/9/collector', 'assign a collector'],
    ['delete', '/api/ajo/memberships/9/collector', 'remove a collector'],
    ['get', '/api/ajo/groups/1/collectors', 'see assignments'],
  ];

  it.each(ownerOnly)('refuses an ordinary member who tries to %s %s', async (method, url) => {
    const res = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[method](url).set('x-test-user', as(MEMBER)).send({});
    expect(res.status).toBe(403);
    for (const fn of Object.values(svc)) expect(fn).not.toHaveBeenCalled();
  });

  it('keeps the admin-only decisions away from officers who do not hold ajo.approve_payout', async () => {
    expect((await request(app).post('/api/ajo/swaps/4/decision').set('x-test-user', as(OFFICER)).send({ decision: 'APPROVED' })).status).toBe(403);
    expect((await request(app).post('/api/ajo/groups/1/exceptions').set('x-test-user', as(OFFICER)).send({ slotId: 1, newPosition: 2, reason: 'A long enough reason' })).status).toBe(403);
    expect(svc.decideSwap).not.toHaveBeenCalled();
    expect(svc.emergencyException).not.toHaveBeenCalled();
  });

  it('lets an admin decide a swap and record an exception', async () => {
    svc.decideSwap.mockResolvedValue({ requestId: 4, status: 'APPROVED', applied: true });
    svc.emergencyException.mockResolvedValue({ eventId: 9, moved: [] });
    const decided = await request(app).post('/api/ajo/swaps/4/decision').set('x-test-user', as(ADMIN)).send({ decision: 'APPROVED', note: 'Agreed' });
    expect(decided.status).toBe(200);
    expect(svc.decideSwap).toHaveBeenCalledWith({ associationId: ASSOC, requestId: 4, actorUserId: ADMIN, decision: 'APPROVED', note: 'Agreed' });
    const exc = await request(app).post('/api/ajo/groups/1/exceptions').set('x-test-user', as(ADMIN)).send({ slotId: 5, newPosition: 3, reason: 'A long enough reason' });
    expect(exc.status).toBe(201);
    expect(svc.emergencyException).toHaveBeenCalledWith({ associationId: ASSOC, groupId: 1, actorUserId: ADMIN, slotId: 5, newPosition: 3, reason: 'A long enough reason' });
  });

  it('shows a collector only their own contributors, and only to someone who holds ajo.collect', async () => {
    svc.listAssignedContributors.mockResolvedValue([{ membershipId: 7 }]);
    expect((await request(app).get('/api/ajo/collector/contributors').set('x-test-user', as(MEMBER))).status).toBe(403);
    const res = await request(app).get('/api/ajo/collector/contributors').set('x-test-user', as(COLLECTOR));
    expect(res.status).toBe(200);
    expect(svc.listAssignedContributors).toHaveBeenCalledWith({ associationId: ASSOC, collectorUserId: COLLECTOR });
  });

  it('lets a member read their own groups, rules, order and bank account, and a stranger gets nothing', async () => {
    svc.listGroups.mockResolvedValue([]);
    svc.listRuleVersions.mockResolvedValue([]);
    svc.getOrder.mockResolvedValue({ drawn: false, slots: [], history: [] });
    svc.getGroupBankAccount.mockResolvedValue({ bankName: 'GTBank', accountName: 'Circle', accountNumber: '0123456789', masked: '••••6789' });
    for (const url of ['/api/ajo/groups', '/api/ajo/groups/1/rules', '/api/ajo/groups/1/order', '/api/ajo/groups/1/bank-account']) {
      expect((await request(app).get(url).set('x-test-user', as(MEMBER))).status).toBe(200);
    }
    expect((await request(app).get('/api/ajo/groups').set('x-test-user', as(999))).status).toBe(403);
    expect((await request(app).get('/api/ajo/groups')).status).toBe(401);
    // Rules for a member carry no acceptance statistics: those are for managers.
    expect(svc.acceptanceStats).not.toHaveBeenCalled();
  });

  it('treats a group the caller cannot see as missing', async () => {
    svc.getGroupDetail.mockRejectedValue(new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND'));
    const res = await request(app).get('/api/ajo/groups/77').set('x-test-user', as(MEMBER));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('GROUP_NOT_FOUND');
  });
});

describe('the add-on gate and the plan', () => {
  it('gives a tenant that never had the add-on (no groups, so no history to keep readable) MODULE_DISABLED on the new routes too', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    mockDb.ajoGroup.findFirst.mockResolvedValue(null);
    for (const [method, url] of [['get', '/api/ajo/groups'], ['post', '/api/ajo/groups'], ['get', '/api/ajo/groups/1/order']] as const) {
      const res = await request(app)[method](url).set('x-test-user', as(OFFICER));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MODULE_DISABLED');
    }
    expect(svc.createGroup).not.toHaveBeenCalled();
  });

  it('after the add-on expires, keeps groups readable and refuses every write with ADDON_EXPIRED', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    svc.listGroups.mockResolvedValue([{ id: 1 }]);
    svc.getOrder.mockResolvedValue({ drawn: true, slots: [], history: [] });
    expect((await request(app).get('/api/ajo/groups').set('x-test-user', as(OFFICER))).status).toBe(200);
    expect((await request(app).get('/api/ajo/groups/1/order').set('x-test-user', as(OFFICER))).status).toBe(200);

    const writes = [
      request(app).post('/api/ajo/groups').set('x-test-user', as(OFFICER)).send(NEW_GROUP),
      request(app).post('/api/ajo/groups/1/start').set('x-test-user', as(OFFICER)).send({}),
      request(app).post('/api/ajo/groups/1/draw').set('x-test-user', as(OFFICER)),
      request(app).post('/api/ajo/swaps/4/decision').set('x-test-user', as(ADMIN)).send({ decision: 'APPROVED' }),
      request(app).post('/api/ajo/memberships/9/accept-rules').set('x-test-user', as(MEMBER)).send({}),
      request(app).post('/api/ajo/memberships/9/collector').set('x-test-user', as(OFFICER)).send({ collectorUserId: 4 }),
    ];
    for (const res of await Promise.all(writes)) {
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADDON_EXPIRED', readOnly: true });
    }
    for (const name of ['createGroup', 'startGroup', 'runDraw', 'decideSwap', 'acceptRules', 'assignCollector'] as const) expect(svc[name]).not.toHaveBeenCalled();
  });

  it('refuses a model the plan’s tier does not include, when creating, opening or starting', async () => {
    mockFeature.mockResolvedValue(false);
    const create = await request(app).post('/api/ajo/groups').set('x-test-user', as(OFFICER)).send(NEW_GROUP);
    expect(create.status).toBe(403);
    expect(create.body.code).toBe('FEATURE_NOT_IN_PLAN');
    expect(mockFeature).toHaveBeenCalledWith(ASSOC, 'ajo.collector_thrift');
    expect((await request(app).post('/api/ajo/groups/1/open').set('x-test-user', as(OFFICER)).send({})).body.code).toBe('FEATURE_NOT_IN_PLAN');
    expect((await request(app).post('/api/ajo/groups/1/start').set('x-test-user', as(OFFICER)).send({})).body.code).toBe('FEATURE_NOT_IN_PLAN');

    mockDb.ajoGroup.findFirst.mockResolvedValue({ id: 1, model: 'ROTATING_POT' });
    await request(app).post('/api/ajo/groups/1/open').set('x-test-user', as(OFFICER)).send({});
    expect(mockFeature).toHaveBeenLastCalledWith(ASSOC, 'ajo.rotating_pot');
    expect(svc.createGroup).not.toHaveBeenCalled();
    expect(svc.openGroup).not.toHaveBeenCalled();
    expect(svc.startGroup).not.toHaveBeenCalled();
  });
});

describe('what the services receive', () => {
  it('turns a kobo amount, sent as a number or a string, into a bigint, and passes the bank account and rules through', async () => {
    svc.createGroup.mockResolvedValue({ id: 3, status: 'DRAFT' });
    const res = await request(app)
      .post('/api/ajo/groups')
      .set('x-test-user', as(OFFICER))
      .send({ ...NEW_GROUP, contributionKobo: '500000', collectorFeeType: 'FIXED', collectorFeeValue: 20000, bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle' }, rules: { graceDays: 5, lateFeeType: 'FIXED', lateFeeValue: 50000, lateFeeCapKobo: null } });
    expect(res.status).toBe(201);
    const call = svc.createGroup.mock.calls[0][0];
    expect(call).toMatchObject({ associationId: ASSOC, actorUserId: OFFICER });
    expect(call.fields.contributionKobo).toBe(500000n);
    expect(call.fields.collectorFeeValue).toBe(20000n);
    expect(call.fields.maxParticipants).toBe(20);
    expect(call.bank).toEqual({ bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Market Circle' });
    expect(call.rules).toMatchObject({ graceDays: 5, lateFeeType: 'FIXED', lateFeeValue: 50000n, lateFeeCapKobo: null });
  });

  it('rejects input of the wrong shape with INVALID_INPUT before any service runs', async () => {
    for (const body of [{ ...NEW_GROUP, model: 'PYRAMID' }, { ...NEW_GROUP, contributionKobo: -5 }, { ...NEW_GROUP, contributionKobo: '12.5' }, { ...NEW_GROUP, maxParticipants: 'many' }]) {
      const res = await request(app).post('/api/ajo/groups').set('x-test-user', as(OFFICER)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    }
    expect((await request(app).post('/api/ajo/groups/abc/open').set('x-test-user', as(OFFICER)).send({})).status).toBe(400);
    expect((await request(app).post('/api/ajo/swaps/4/decision').set('x-test-user', as(ADMIN)).send({ decision: 'MAYBE' })).status).toBe(400);
    expect(svc.createGroup).not.toHaveBeenCalled();
    expect(svc.decideSwap).not.toHaveBeenCalled();
  });

  it('maps a rule error to its status and code', async () => {
    svc.startGroup.mockRejectedValue(new RuleError('Run the draw before starting.', 409, 'DRAW_REQUIRED'));
    const res = await request(app).post('/api/ajo/groups/1/start').set('x-test-user', as(OFFICER)).send({ confirmSmallerGroup: true });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'DRAW_REQUIRED' });
    expect(svc.startGroup).toHaveBeenCalledWith(expect.objectContaining({ associationId: ASSOC, groupId: 1, confirmSmallerGroup: true }));
  });

  it('records an officer’s acceptance with the note, and treats the caller as an officer only when they hold ajo.manage', async () => {
    svc.acceptRules.mockResolvedValue({ acceptanceId: 1, ruleVersion: 1, channel: 'officer', replayed: false, activation: { activated: true } });
    const asOfficer = await request(app).post('/api/ajo/memberships/9/accept-rules').set('x-test-user', as(OFFICER)).send({ note: 'read aloud, agreed' });
    expect(asOfficer.status).toBe(200);
    expect(svc.acceptRules).toHaveBeenLastCalledWith(expect.objectContaining({ actorUserId: OFFICER, actorIsOfficer: true, note: 'read aloud, agreed', membershipId: 9 }));
    // The member's own login: allowed because the membership is theirs, and never marked as an officer.
    await request(app).post('/api/ajo/memberships/9/accept-rules').set('x-test-user', as(MEMBER)).send({});
    expect(svc.acceptRules).toHaveBeenLastCalledWith(expect.objectContaining({ actorUserId: MEMBER, actorIsOfficer: false }));
    // Someone else's membership: refused before the service runs.
    mockDb.ajoMembership.findFirst.mockResolvedValue({ member: { userId: 12345 } });
    svc.acceptRules.mockClear();
    expect((await request(app).post('/api/ajo/memberships/9/accept-rules').set('x-test-user', as(MEMBER)).send({})).status).toBe(403);
    expect(svc.acceptRules).not.toHaveBeenCalled();
  });

  it('lets a participant ask for a swap, marking officers as officers', async () => {
    svc.requestSwap.mockResolvedValue({ requestId: 4, status: 'PENDING' });
    await request(app).post('/api/ajo/groups/1/swaps').set('x-test-user', as(MEMBER)).send({ slotAId: 1, slotBId: 2 });
    expect(svc.requestSwap).toHaveBeenLastCalledWith({ associationId: ASSOC, groupId: 1, actorUserId: MEMBER, actorIsOfficer: false, slotAId: 1, slotBId: 2 });
    await request(app).post('/api/ajo/groups/1/swaps').set('x-test-user', as(OFFICER)).send({ slotAId: 1, slotBId: 2, reason: 'Agreed' });
    expect(svc.requestSwap).toHaveBeenLastCalledWith(expect.objectContaining({ actorIsOfficer: true, reason: 'Agreed' }));
  });

  it('only lets a collector read the schedule of someone assigned to them', async () => {
    svc.listMembershipInstallments.mockResolvedValue({ installments: [] });
    mockDb.ajoMembership.findFirst.mockResolvedValue({ member: { userId: 12345 } });
    // The member's collector must also hold a read permission to reach the route; give them view_own as well.
    mockPerms.set(COLLECTOR, ['ajo.collect', 'ajo.view_own']);
    expect((await request(app).get('/api/ajo/memberships/9/installments').set('x-test-user', as(COLLECTOR))).status).toBe(404);
    mockDb.ajoCollectorAssignment.findFirst.mockResolvedValue({ id: 1 });
    expect((await request(app).get('/api/ajo/memberships/9/installments').set('x-test-user', as(COLLECTOR))).status).toBe(200);
    // Another member with no assignment and no manage permission sees nothing.
    mockDb.ajoCollectorAssignment.findFirst.mockResolvedValue(null);
    expect((await request(app).get('/api/ajo/memberships/9/installments').set('x-test-user', as(MEMBER))).status).toBe(404);
  });
});

describe('the bank account', () => {
  it('appears in full only from its own endpoint, never cached, and never in the group views', async () => {
    svc.getGroupBankAccount.mockResolvedValue({ bankName: 'GTBank', accountName: 'Circle', accountNumber: '0123456789', masked: '••••6789' });
    svc.getGroupDetail.mockResolvedValue({ id: 1, bankAccount: { bankName: 'GTBank', accountName: 'Circle', masked: '••••6789' } });
    svc.listGroups.mockResolvedValue([{ id: 1, bankAccount: { masked: '••••6789' } }]);
    svc.createGroup.mockResolvedValue({ id: 1, bankAccount: { masked: '••••6789' } });

    const full = await request(app).get('/api/ajo/groups/1/bank-account').set('x-test-user', as(MEMBER));
    expect(full.body.data.accountNumber).toBe('0123456789');
    expect(full.headers['cache-control']).toBe('no-store');

    for (const res of [await request(app).get('/api/ajo/groups/1').set('x-test-user', as(MEMBER)), await request(app).get('/api/ajo/groups').set('x-test-user', as(MEMBER)), await request(app).post('/api/ajo/groups').set('x-test-user', as(OFFICER)).send(NEW_GROUP)]) {
      expect(JSON.stringify(res.body)).not.toContain('0123456789');
    }
  });

  it('is not echoed back in an error caused by a bad account number', async () => {
    svc.updateGroup.mockRejectedValue(new RuleError('A bank account number is exactly 10 digits.', 400, 'INVALID_BANK_ACCOUNT'));
    const res = await request(app).patch('/api/ajo/groups/1').set('x-test-user', as(OFFICER)).send({ bank: { bankName: 'GTBank', accountNumber: '12345', accountName: 'Circle' } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BANK_ACCOUNT');
    expect(JSON.stringify(res.body)).not.toContain('12345');
  });
});
