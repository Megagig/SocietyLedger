/**
 * The Ajo routes over HTTP (T2): the real routers, with sign-in, permission checks, services and the database stood in for.
 * What is under test is the wiring: who can reach what, what the add-on gate does, validation, error mapping, and what is never sent out.
 */
import express from 'express';
import request from 'supertest';

const mockPerms = new Map<number, string[]>(); // userId -> permission keys (the tenant side)
const mockServices = {
  approveMembership: jest.fn(),
  requestPhoneCode: jest.fn(),
  confirmPhoneCode: jest.fn(),
  getPayoutAccount: jest.fn(),
  setPayoutAccount: jest.fn(),
  revealAccountNumber: jest.fn(),
  resubmitVerification: jest.fn(),
  latestVerification: jest.fn(),
  decideVerification: jest.fn(),
  getVerificationDetail: jest.fn(),
  listVerificationQueue: jest.fn(),
};
const mockDb = {
  member: { findFirst: jest.fn() },
  ajoMembership: { findFirst: jest.fn() },
  ajoGroup: { findFirst: jest.fn() },
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
  requirePlatformRole: (roles: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) =>
    roles.includes(String(req.user!.platformRole)) ? next() : res.status(403).json({ success: false, code: 'FORBIDDEN' }),
}));
jest.mock('../../src/services/rbac.service', () => ({
  RBACService: { hasPermission: jest.fn(async (ctx: { userId: number }, key: string) => (mockPerms.get(ctx.userId) ?? []).includes(key)) },
}));
jest.mock('../../src/services/module-feature.service', () => ({
  ModuleFeatureService: { getModuleStatus: (...a: unknown[]) => mockModuleStatus(...a), getFeatureStatus: jest.fn() },
}));
const mockTenantKind = jest.fn(async () => 'ASSOCIATION');
jest.mock('../../src/modules/ajo/ajo-capacity', () => ({ contributorCapacity: jest.fn(async () => ({ limit: 30, count: 3 })), tenantKind: (...a: unknown[]) => (mockTenantKind as (...x: unknown[]) => unknown)(...a) }));
jest.mock('../../src/modules/ajo/ajo-membership.service', () => ({ approveMembership: (...a: unknown[]) => mockServices.approveMembership(...a) }));
jest.mock('../../src/modules/ajo/ajo-phone-code.service', () => ({
  requestPhoneCode: (...a: unknown[]) => mockServices.requestPhoneCode(...a),
  confirmPhoneCode: (...a: unknown[]) => mockServices.confirmPhoneCode(...a),
}));
jest.mock('../../src/modules/ajo/ajo-payout-account.service', () => ({
  getPayoutAccount: (...a: unknown[]) => mockServices.getPayoutAccount(...a),
  setPayoutAccount: (...a: unknown[]) => mockServices.setPayoutAccount(...a),
  revealAccountNumber: (...a: unknown[]) => mockServices.revealAccountNumber(...a),
}));
jest.mock('../../src/modules/ajo/ajo-verification.service', () => ({
  latestVerification: (...a: unknown[]) => mockServices.latestVerification(...a),
  resubmitVerification: (...a: unknown[]) => mockServices.resubmitVerification(...a),
  decideVerification: (...a: unknown[]) => mockServices.decideVerification(...a),
  getVerificationDetail: (...a: unknown[]) => mockServices.getVerificationDetail(...a),
  listVerificationQueue: (...a: unknown[]) => mockServices.listVerificationQueue(...a),
}));

import { RuleError } from '../../src/modules/finance/rule-error';
import ajoRoutes from '../../src/modules/ajo/ajo.routes';
import ajoAdminRoutes from '../../src/modules/ajo/ajo-admin.routes';

const app = express();
app.use(express.json());
app.use('/api/ajo', ajoRoutes);
app.use('/api/admin/ajo', ajoAdminRoutes);

const ASSOC = 5;
const as = (id: number, extra: Record<string, unknown> = {}) => JSON.stringify({ id, associationId: ASSOC, platformRole: null, ...extra });
const OFFICER = 1;
const MEMBER = 2;
const OTHER = 3;
const STAFF = (role: string) => JSON.stringify({ id: 900, associationId: null, platformRole: role });

const MEMBER_PERMS = ['ajo.view_own', 'ajo.contribute'];
const OFFICER_PERMS = [...MEMBER_PERMS, 'ajo.manage', 'ajo.collect', 'ajo.reconcile', 'ajo.reports'];

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms.set(OFFICER, OFFICER_PERMS);
  mockPerms.set(MEMBER, MEMBER_PERMS);
  mockPerms.set(OTHER, MEMBER_PERMS);
  mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: true, source: 'addon' });
  mockDb.ajoGroup.findFirst.mockResolvedValue(null);
  // User 2 is member 20; user 3 is member 30.
  mockDb.member.findFirst.mockImplementation(async ({ where }: { where: { userId: number } }) => ({ id: where.userId * 10 }));
});

describe('the add-on gate', () => {
  it('turns away a request that is not signed in', async () => {
    expect((await request(app).get('/api/ajo/status')).status).toBe(401);
  });

  it('gives a tenant without the add-on MODULE_DISABLED on every route', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    for (const [method, url] of [['get', '/api/ajo/status'], ['post', '/api/ajo/memberships/9/approve'], ['get', '/api/ajo/members/me/payout-account']] as const) {
      const res = await request(app)[method](url).set('x-test-user', as(OFFICER));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MODULE_DISABLED');
    }
    expect(mockServices.approveMembership).not.toHaveBeenCalled();
  });

  it('tells the web what the account can do and whether it is a standalone thrift group', async () => {
    const ok = await request(app).get('/api/ajo/status').set('x-test-user', as(MEMBER));
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ module: 'ajo', access: 'FULL', readOnly: false, tenantKind: 'ASSOCIATION', contributors: { limit: 30, count: 3, remaining: 27 } });
    mockTenantKind.mockResolvedValueOnce('THRIFT_GROUP');
    expect((await request(app).get('/api/ajo/status').set('x-test-user', as(MEMBER))).body.data.tenantKind).toBe('THRIFT_GROUP');
  });

  it('after the add-on expires still lets people read, but refuses every write with ADDON_EXPIRED', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    mockDb.ajoGroup.findFirst.mockResolvedValue({ id: 1 });
    mockServices.getPayoutAccount.mockResolvedValue(null);

    expect((await request(app).get('/api/ajo/members/me/payout-account').set('x-test-user', as(MEMBER))).status).toBe(200);

    const writes = [
      request(app).post('/api/ajo/memberships/9/approve').set('x-test-user', as(OFFICER)),
      request(app).put('/api/ajo/members/me/payout-account').set('x-test-user', as(MEMBER)).send({ bankName: 'GTBank', accountNumber: '0123456789', accountName: 'A B' }),
      request(app).post('/api/ajo/memberships/9/phone-code').set('x-test-user', as(MEMBER)),
    ];
    for (const res of await Promise.all(writes)) {
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ADDON_EXPIRED', readOnly: true });
    }
    expect(mockServices.approveMembership).not.toHaveBeenCalled();
    expect(mockServices.setPayoutAccount).not.toHaveBeenCalled();
  });
});

describe('approval', () => {
  it('needs the ajo.manage permission', async () => {
    const res = await request(app).post('/api/ajo/memberships/9/approve').set('x-test-user', as(MEMBER));
    expect(res.status).toBe(403);
    expect(mockServices.approveMembership).not.toHaveBeenCalled();
  });

  it('passes the tenant, the membership and who approved, never anything from the body', async () => {
    mockServices.approveMembership.mockResolvedValue({ membershipId: 9, status: 'ACTIVE', activated: true, unmet: [], blockedByLimit: null, replayed: false });
    const res = await request(app).post('/api/ajo/memberships/9/approve').set('x-test-user', as(OFFICER)).send({ associationId: 999, actorUserId: 999 });
    expect(res.status).toBe(200);
    expect(mockServices.approveMembership).toHaveBeenCalledWith({ associationId: ASSOC, membershipId: 9, actorUserId: OFFICER });
    expect(res.body.message).toMatch(/can now take part/);
  });

  it('tells the officer plainly when the plan has no room', async () => {
    mockServices.approveMembership.mockResolvedValue({
      membershipId: 9, status: 'PENDING', activated: false, unmet: [], replayed: false,
      blockedByLimit: { code: 'AJO_CONTRIBUTOR_LIMIT', limit: 30, count: 30, message: 'Your Ajo plan allows 30 active contributors and you have 30. Move to a bigger tier to add more.' },
    });
    const res = await request(app).post('/api/ajo/memberships/9/approve').set('x-test-user', as(OFFICER));
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Move to a bigger tier');
    expect(res.body.data.blockedByLimit.code).toBe('AJO_CONTRIBUTOR_LIMIT');
  });

  it('maps a rule error to its status and code, and rejects a bad id', async () => {
    mockServices.approveMembership.mockRejectedValue(new RuleError('You cannot approve your own membership. Ask another officer.', 403, 'SELF_APPROVAL'));
    const res = await request(app).post('/api/ajo/memberships/9/approve').set('x-test-user', as(OFFICER));
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'SELF_APPROVAL' });
    expect((await request(app).post('/api/ajo/memberships/abc/approve').set('x-test-user', as(OFFICER))).status).toBe(400);
  });
});

describe('payout account', () => {
  const body = { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Adaeze Okafor' };

  it('lets a member set their own with "me", acting only on the member linked to their login', async () => {
    mockServices.setPayoutAccount.mockResolvedValue({ account: { accountMasked: '••••6789' }, replayed: false, voidedPayoutIds: [], verification: 'NONE' });
    const res = await request(app).put('/api/ajo/members/me/payout-account').set('x-test-user', as(MEMBER)).send(body);
    expect(res.status).toBe(200);
    expect(mockServices.setPayoutAccount).toHaveBeenCalledWith({ associationId: ASSOC, memberId: 20, actorUserId: MEMBER, ...body });
  });

  it('treats a member asking for their own id by number as themselves', async () => {
    mockServices.getPayoutAccount.mockResolvedValue(null);
    expect((await request(app).get('/api/ajo/members/20/payout-account').set('x-test-user', as(MEMBER))).status).toBe(200);
  });

  it('refuses a member acting on someone else, and never calls the service', async () => {
    for (const res of [
      await request(app).get('/api/ajo/members/30/payout-account').set('x-test-user', as(MEMBER)),
      await request(app).put('/api/ajo/members/30/payout-account').set('x-test-user', as(MEMBER)).send(body),
      await request(app).post('/api/ajo/members/30/payout-account/reveal').set('x-test-user', as(MEMBER)),
      await request(app).get('/api/ajo/members/30/verification').set('x-test-user', as(MEMBER)),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    }
    expect(mockServices.getPayoutAccount).not.toHaveBeenCalled();
    expect(mockServices.setPayoutAccount).not.toHaveBeenCalled();
    expect(mockServices.revealAccountNumber).not.toHaveBeenCalled();
  });

  it('lets an officer set another member\'s account in their own association', async () => {
    mockServices.setPayoutAccount.mockResolvedValue({ account: {}, replayed: false, voidedPayoutIds: [], verification: 'NONE' });
    const res = await request(app).put('/api/ajo/members/30/payout-account').set('x-test-user', as(OFFICER)).send(body);
    expect(res.status).toBe(200);
    expect(mockServices.setPayoutAccount).toHaveBeenCalledWith(expect.objectContaining({ associationId: ASSOC, memberId: 30, actorUserId: OFFICER }));
  });

  it('refuses a body that is not a payout account before reaching the service', async () => {
    for (const bad of [{}, { ...body, bankName: '' }, { ...body, accountName: 'x' }, { bankName: 'GTBank' }]) {
      const res = await request(app).put('/api/ajo/members/me/payout-account').set('x-test-user', as(MEMBER)).send(bad);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    }
    expect(mockServices.setPayoutAccount).not.toHaveBeenCalled();
  });

  it('sends the full number only from reveal, and tells caches not to keep it', async () => {
    mockServices.revealAccountNumber.mockResolvedValue('0123456789');
    mockServices.getPayoutAccount.mockResolvedValue({ bankName: 'GTBank', accountName: 'Adaeze Okafor', accountMasked: '••••6789' });
    const masked = await request(app).get('/api/ajo/members/me/payout-account').set('x-test-user', as(MEMBER));
    expect(JSON.stringify(masked.body)).not.toContain('0123456789');

    const reveal = await request(app).post('/api/ajo/members/me/payout-account/reveal').set('x-test-user', as(MEMBER));
    expect(reveal.body.data.accountNumber).toBe('0123456789');
    expect(reveal.headers['cache-control']).toBe('no-store');
  });

  it('reports an unexpected failure without its message in the response or the log', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockServices.setPayoutAccount.mockRejectedValue(new Error('insert failed for account 0123456789'));
    const res = await request(app).put('/api/ajo/members/me/payout-account').set('x-test-user', as(MEMBER)).send(body);
    const logged = JSON.stringify(spy.mock.calls);
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('0123456789');
    expect(logged).not.toContain('0123456789');
  });
});

describe('phone code', () => {
  beforeEach(() => {
    // Membership 7 belongs to user 2 (the member); membership 8 to user 3.
    mockDb.ajoMembership.findFirst.mockImplementation(async ({ where }: { where: { id: number } }) =>
      where.id === 7 ? { member: { userId: MEMBER } } : where.id === 8 ? { member: { userId: OTHER } } : null,
    );
    mockServices.requestPhoneCode.mockResolvedValue({ sentTo: '234803•••••567', expiresAt: new Date('2027-01-01') });
    mockServices.confirmPhoneCode.mockResolvedValue({ confirmed: true, activation: { activated: true } });
  });

  it('lets the member ask for and enter their own code', async () => {
    expect((await request(app).post('/api/ajo/memberships/7/phone-code').set('x-test-user', as(MEMBER))).status).toBe(200);
    expect(mockServices.requestPhoneCode).toHaveBeenCalledWith({ associationId: ASSOC, membershipId: 7 });
    const done = await request(app).post('/api/ajo/memberships/7/phone-code/confirm').set('x-test-user', as(MEMBER)).send({ code: '123456' });
    expect(done.status).toBe(200);
    expect(mockServices.confirmPhoneCode).toHaveBeenCalledWith({ associationId: ASSOC, membershipId: 7, code: '123456', actorUserId: MEMBER });
  });

  it('does not let one member trigger or answer another member\'s code', async () => {
    expect((await request(app).post('/api/ajo/memberships/8/phone-code').set('x-test-user', as(MEMBER))).status).toBe(403);
    expect((await request(app).post('/api/ajo/memberships/8/phone-code/confirm').set('x-test-user', as(MEMBER)).send({ code: '123456' })).status).toBe(403);
    expect(mockServices.requestPhoneCode).not.toHaveBeenCalled();
    expect(mockServices.confirmPhoneCode).not.toHaveBeenCalled();
  });

  it('lets an officer help a member in person', async () => {
    expect((await request(app).post('/api/ajo/memberships/8/phone-code').set('x-test-user', as(OFFICER))).status).toBe(200);
  });

  it('reports a membership from another association as missing', async () => {
    const res = await request(app).post('/api/ajo/memberships/999/phone-code').set('x-test-user', as(OFFICER));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('MEMBERSHIP_NOT_FOUND');
  });

  it('refuses a missing code', async () => {
    const res = await request(app).post('/api/ajo/memberships/7/phone-code/confirm').set('x-test-user', as(MEMBER)).send({});
    expect(res.status).toBe(400);
  });
});

describe('verification status and resubmission', () => {
  it('shows a member where SocietyLedger\'s check stands, and why if it was rejected', async () => {
    mockServices.latestVerification.mockResolvedValue({ status: 'REJECTED', rejectionReason: 'There is no address on file.', reviewedAt: new Date('2027-01-02') });
    const res = await request(app).get('/api/ajo/members/me/verification').set('x-test-user', as(MEMBER));
    expect(res.body.data).toMatchObject({ status: 'REJECTED', rejectionReason: 'There is no address on file.' });
  });

  it('says NOT_REQUESTED for someone no group has approved yet', async () => {
    mockServices.latestVerification.mockResolvedValue(null);
    expect((await request(app).get('/api/ajo/members/me/verification').set('x-test-user', as(MEMBER))).body.data.status).toBe('NOT_REQUESTED');
  });

  it('lets only an officer send someone back for checking', async () => {
    mockServices.resubmitVerification.mockResolvedValue({ row: { status: 'PENDING' }, replayed: false });
    expect((await request(app).post('/api/ajo/members/20/verification/resubmit').set('x-test-user', as(MEMBER))).status).toBe(403);
    const res = await request(app).post('/api/ajo/members/20/verification/resubmit').set('x-test-user', as(OFFICER));
    expect(res.status).toBe(200);
    expect(mockServices.resubmitVerification).toHaveBeenCalledWith({ associationId: ASSOC, memberId: 20, actorUserId: OFFICER });
  });
});

describe('SocietyLedger staff review', () => {
  const decision = { decision: 'VERIFIED', checklist: { nameMatchesAccount: true, phoneConfirmed: true, addressFilled: true } };

  it('is closed to association users and to anyone not signed in', async () => {
    expect((await request(app).get('/api/admin/ajo/verifications')).status).toBe(401);
    expect((await request(app).get('/api/admin/ajo/verifications').set('x-test-user', as(OFFICER))).status).toBe(403);
    expect((await request(app).post('/api/admin/ajo/verifications/4/decision').set('x-test-user', as(OFFICER)).send(decision)).status).toBe(403);
  });

  it('lets support staff look but not decide', async () => {
    mockServices.listVerificationQueue.mockResolvedValue({ total: 0, items: [] });
    mockServices.getVerificationDetail.mockResolvedValue({ id: 4 });
    expect((await request(app).get('/api/admin/ajo/verifications?status=PENDING').set('x-test-user', STAFF('SUPPORT_AGENT'))).status).toBe(200);
    expect((await request(app).get('/api/admin/ajo/verifications/4').set('x-test-user', STAFF('SUPPORT_AGENT'))).status).toBe(200);
    const res = await request(app).post('/api/admin/ajo/verifications/4/decision').set('x-test-user', STAFF('SUPPORT_AGENT')).send(decision);
    expect(res.status).toBe(403);
    expect(mockServices.decideVerification).not.toHaveBeenCalled();
  });

  it('lets compliance and super admins decide, recording who and in what role', async () => {
    mockServices.decideVerification.mockResolvedValue({ id: 4, status: 'VERIFIED' });
    for (const role of ['COMPLIANCE_ADMIN', 'SUPER_ADMIN']) {
      const res = await request(app).post('/api/admin/ajo/verifications/4/decision').set('x-test-user', STAFF(role)).send(decision);
      expect(res.status).toBe(200);
      expect(mockServices.decideVerification).toHaveBeenLastCalledWith(expect.objectContaining({ verificationId: 4, reviewerId: 900, reviewerRole: role, decision: 'VERIFIED' }));
    }
  });

  it('refuses a malformed decision and filters the queue only by known statuses', async () => {
    for (const bad of [{}, { decision: 'MAYBE', checklist: decision.checklist }, { decision: 'VERIFIED' }, { decision: 'VERIFIED', checklist: { nameMatchesAccount: 'yes' } }]) {
      expect((await request(app).post('/api/admin/ajo/verifications/4/decision').set('x-test-user', STAFF('COMPLIANCE_ADMIN')).send(bad)).status).toBe(400);
    }
    expect((await request(app).get('/api/admin/ajo/verifications?status=ANYTHING').set('x-test-user', STAFF('COMPLIANCE_ADMIN'))).status).toBe(400);
    expect((await request(app).get('/api/admin/ajo/verifications?associationId=abc').set('x-test-user', STAFF('COMPLIANCE_ADMIN'))).status).toBe(400);
    expect(mockServices.decideVerification).not.toHaveBeenCalled();
  });

  it('passes a rule error through, such as a reviewer who lost the race', async () => {
    mockServices.decideVerification.mockRejectedValue(new RuleError('This verification was just decided by someone else.', 409, 'ALREADY_DECIDED'));
    const res = await request(app).post('/api/admin/ajo/verifications/4/decision').set('x-test-user', STAFF('COMPLIANCE_ADMIN')).send(decision);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_DECIDED');
  });
});
