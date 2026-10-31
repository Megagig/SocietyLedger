/**
 * The Ajo late-fee, dispute, default-case, repayment-plan and trust routes over HTTP (T6): the real router and controller, with sign-in,
 * permission checks, services and the database stood in for. What is under test is the wiring: who can reach what, the add-on gate and
 * read-only mode, whose records a member may open, and how input becomes what the services receive.
 */
import express from 'express';
import request from 'supertest';

const mockPerms = new Map<number, string[]>();
const svc = {
  listLateFees: jest.fn(),
  waiveLateFee: jest.fn(),
  reverseWaiver: jest.fn(),
  markFeeNotified: jest.fn(),
  raiseDispute: jest.fn(),
  listDisputes: jest.fn(),
  resolveDispute: jest.fn(),
  getEvidenceLink: jest.fn(),
  listCases: jest.fn(),
  getCase: jest.fn(),
  openCase: jest.fn(),
  addCaseNote: jest.fn(),
  proposePlan: jest.fn(),
  agreePlan: jest.fn(),
  cancelPlan: jest.fn(),
  closeCase: jest.fn(),
  getMembershipTrust: jest.fn(),
  listGroupTrust: jest.fn(),
};
const mockDb = { member: { findFirst: jest.fn() }, ajoMembership: { findFirst: jest.fn() }, ajoGroup: { findFirst: jest.fn() }, ajoContribution: { findFirst: jest.fn() }, ajoCollectorAssignment: { findFirst: jest.fn() }, ajoDefaultCase: { findFirst: jest.fn() } };
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
jest.mock('../../src/lib/reauth', () => ({
  ...jest.requireActual('../../src/lib/reauth'),
  confirmPassword: jest.fn(async (_userId: number, password: string) => (password === 'right' ? { ok: true } : { ok: false, reason: 'wrong' })),
}));
jest.mock('../../src/modules/ajo/ajo-capacity', () => ({ contributorCapacity: jest.fn(async () => ({ limit: 30, count: 3 })) }));
jest.mock('../../src/lib/storage', () => ({ uploadFile: jest.fn(), deleteFile: jest.fn(), getPresignedUrl: jest.fn() }));

const pass = <K extends keyof typeof svc>(name: K) => (...a: unknown[]) => svc[name](...a);
jest.mock('../../src/modules/ajo/ajo-latefee.service', () => ({ listLateFees: pass('listLateFees'), waiveLateFee: pass('waiveLateFee'), reverseWaiver: pass('reverseWaiver'), markFeeNotified: pass('markFeeNotified') }));
jest.mock('../../src/modules/ajo/ajo-dispute.service', () => ({ raiseDispute: pass('raiseDispute'), listDisputes: pass('listDisputes'), resolveDispute: pass('resolveDispute'), getEvidenceLink: pass('getEvidenceLink') }));
jest.mock('../../src/modules/ajo/ajo-default.service', () => ({ listCases: pass('listCases'), getCase: pass('getCase'), openCase: pass('openCase'), addCaseNote: pass('addCaseNote'), proposePlan: pass('proposePlan'), agreePlan: pass('agreePlan'), cancelPlan: pass('cancelPlan'), closeCase: pass('closeCase') }));
jest.mock('../../src/modules/ajo/ajo-trust.service', () => ({ getMembershipTrust: pass('getMembershipTrust'), listGroupTrust: pass('listGroupTrust') }));
// The other pieces the router also loads.
jest.mock('../../src/modules/ajo/ajo-payout.service', () => ({ previewPayout: jest.fn(), preparePayout: jest.fn(), prepareAllReady: jest.fn(), approvePayout: jest.fn(), voidPayout: jest.fn(), recordPayoutPaid: jest.fn(), reversePaidPayout: jest.fn(), listPayouts: jest.fn(), getPayout: jest.fn(), listOwnPayouts: jest.fn(), completeGroup: jest.fn() }));
jest.mock('../../src/modules/ajo/ajo-levy.service', () => ({ listAssociationLevy: jest.fn(), listLevy: jest.fn(), levyReport: jest.fn(), setLevyStatus: jest.fn() }));
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

const app = express();
app.use(express.json());
app.use('/api/ajo', ajoRoutes);

const ASSOC = 5;
const as = (id: number) => JSON.stringify({ id, associationId: ASSOC, platformRole: null });
const MEMBER = 2; // owns membership 10
const OTHER = 8; // a member of the group, but not the owner of membership 10
const OFFICER = 6; // ajo.manage
const RECONCILER = 5; // ajo.reconcile
const ADMIN = 3; // ajo.approve_payout (and manage)
const STRANGER = 7;

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms.set(MEMBER, ['ajo.view_own', 'ajo.contribute']);
  mockPerms.set(OTHER, ['ajo.view_own', 'ajo.contribute']);
  mockPerms.set(OFFICER, ['ajo.view_own', 'ajo.manage']);
  mockPerms.set(RECONCILER, ['ajo.reconcile']);
  mockPerms.set(ADMIN, ['ajo.view_own', 'ajo.manage', 'ajo.approve_payout']);
  mockPerms.set(STRANGER, []);
  mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: true, source: 'addon' });
  mockDb.ajoGroup.findFirst.mockResolvedValue({ id: 1 });
  mockDb.ajoMembership.findFirst.mockResolvedValue({ member: { userId: MEMBER } });
  mockDb.ajoCollectorAssignment.findFirst.mockResolvedValue(null);
});

const call = (method: string, url: string, user: number, body: object = {}) => (request(app) as unknown as Record<string, (u: string) => request.Test>)[method](url).set('x-test-user', as(user)).send(body);

describe('who can reach what', () => {
  it('lets only an officer waive, reverse a waiver, record that someone was told, open a case, add a note, draft or cancel a plan', async () => {
    const asks: Array<[string, string, number]> = [
      ['post', '/api/ajo/late-fees/4/waive', MEMBER],
      ['post', '/api/ajo/late-fees/4/waive', RECONCILER],
      ['post', '/api/ajo/late-fees/4/reverse-waiver', MEMBER],
      ['post', '/api/ajo/late-fees/4/told', RECONCILER],
      ['post', '/api/ajo/memberships/10/cases', MEMBER],
      ['post', '/api/ajo/memberships/10/cases', RECONCILER],
      ['post', '/api/ajo/cases/3/notes', MEMBER],
      ['post', '/api/ajo/cases/3/plan', RECONCILER],
      ['post', '/api/ajo/plans/9/cancel', MEMBER],
      ['post', '/api/ajo/plans/9/cancel', STRANGER],
    ];
    for (const [method, url, user] of asks) expect(`${method} ${url} as ${user}: ${(await call(method, url, user)).status}`).toBe(`${method} ${url} as ${user}: 403`);
    for (const fn of Object.values(svc)) expect(fn).not.toHaveBeenCalled();
  });

  it('lets only an admin who can approve payouts close a case', async () => {
    svc.closeCase.mockResolvedValue({ caseId: 3, status: 'RESOLVED', replayed: false });
    for (const user of [MEMBER, OFFICER, RECONCILER]) expect((await call('post', '/api/ajo/cases/3/close', user, { outcome: 'RESOLVED', reason: 'She paid at the meeting' })).status).toBe(403);
    expect(svc.closeCase).not.toHaveBeenCalled();
    const noPassword = await call('post', '/api/ajo/cases/3/close', ADMIN, { outcome: 'RESOLVED', reason: 'She paid at the meeting' });
    expect(noPassword.body.code).toBe('PASSWORD_REQUIRED');
    expect((await call('post', '/api/ajo/cases/3/close', ADMIN, { password: 'nope', outcome: 'RESOLVED', reason: 'She paid at the meeting' })).status).toBe(403);
    expect(svc.closeCase).not.toHaveBeenCalled();
    const ok = await call('post', '/api/ajo/cases/3/close', ADMIN, { password: 'right', outcome: 'RESOLVED', reason: 'She paid at the meeting' });
    expect(ok.status).toBe(200);
    expect(svc.closeCase).toHaveBeenCalledWith({ associationId: ASSOC, caseId: 3, actorUserId: ADMIN, outcome: 'RESOLVED', reason: 'She paid at the meeting' });
  });

  it('shows the officers’ lists to officers (reconcilers too for fees, disputes and trust), never to a plain member', async () => {
    for (const fn of [svc.listLateFees, svc.listDisputes, svc.listCases, svc.listGroupTrust]) fn.mockResolvedValue([]);
    for (const url of ['/api/ajo/groups/1/late-fees', '/api/ajo/groups/1/disputes', '/api/ajo/groups/1/trust']) {
      for (const user of [OFFICER, RECONCILER, ADMIN]) expect(`${url} ${user}: ${(await call('get', url, user)).status}`).toBe(`${url} ${user}: 200`);
      expect((await call('get', url, MEMBER)).status).toBe(403);
    }
    for (const user of [OFFICER, ADMIN]) expect((await call('get', '/api/ajo/groups/1/cases', user)).status).toBe(200);
    for (const user of [MEMBER, RECONCILER]) expect((await call('get', '/api/ajo/groups/1/cases', user)).status).toBe(403);
  });
});

describe('a member and their own records', () => {
  it('lets a member read their own fees, disputes, cases and score, and refuses another member’s with a 404', async () => {
    svc.listLateFees.mockResolvedValue([]);
    svc.listDisputes.mockResolvedValue([]);
    svc.listCases.mockResolvedValue([]);
    svc.getMembershipTrust.mockResolvedValue({ band: 'GOOD' });
    for (const tail of ['late-fees', 'disputes', 'cases', 'trust']) {
      expect(`${tail} own: ${(await call('get', `/api/ajo/memberships/10/${tail}`, MEMBER)).status}`).toBe(`${tail} own: 200`);
      expect(`${tail} other: ${(await call('get', `/api/ajo/memberships/10/${tail}`, OTHER)).status}`).toBe(`${tail} other: 404`);
      expect(`${tail} officer: ${(await call('get', `/api/ajo/memberships/10/${tail}`, OFFICER)).status}`).toBe(`${tail} officer: 200`);
    }
    expect(svc.getMembershipTrust).toHaveBeenCalledWith({ associationId: ASSOC, membershipId: 10 });
  });

  it('lets a member raise a dispute about their own instalment, passing their claim', async () => {
    svc.raiseDispute.mockResolvedValue({ id: 1, status: 'OPEN' });
    const ok = await call('post', '/api/ajo/memberships/10/disputes', MEMBER, { installmentId: 7, claim: 'I paid the collector in cash on Monday morning' });
    expect(ok.status).toBe(201);
    expect(svc.raiseDispute).toHaveBeenCalledWith(expect.objectContaining({ associationId: ASSOC, membershipId: 10, installmentId: 7, claim: 'I paid the collector in cash on Monday morning', actorUserId: MEMBER, actorCanManage: false }));
    svc.raiseDispute.mockRejectedValue(new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND'));
    expect((await call('post', '/api/ajo/memberships/10/disputes', OTHER, { installmentId: 7, claim: 'I paid the collector in cash on Monday morning' })).status).toBe(404);
    expect((await call('post', '/api/ajo/memberships/10/disputes', MEMBER, { claim: 'no installment given at all here' })).status).toBe(400);
  });

  it('lets an officer or reconciler decide a dispute, passing who decided, and relays the service’s refusal', async () => {
    svc.resolveDispute.mockResolvedValue({ id: 1, status: 'RESOLVED' });
    expect((await call('post', '/api/ajo/disputes/1/resolve', MEMBER, { outcome: 'UPHELD', reason: 'I checked and it is right' })).status).toBe(403);
    const r = await call('post', '/api/ajo/disputes/1/resolve', RECONCILER, { outcome: 'UPHELD', reason: 'The collector confirms he took the cash' });
    expect(r.status).toBe(200);
    expect(svc.resolveDispute).toHaveBeenCalledWith({ associationId: ASSOC, disputeId: 1, actorUserId: RECONCILER, outcome: 'UPHELD', reason: 'The collector confirms he took the cash' });
    expect((await call('post', '/api/ajo/disputes/1/resolve', OFFICER, { outcome: 'MAYBE', reason: 'The collector confirms he took the cash' })).status).toBe(400);
    svc.resolveDispute.mockRejectedValue(new RuleError('You raised this yourself.', 409, 'SELF_RESOLUTION_NOT_ALLOWED'));
    const bad = await call('post', '/api/ajo/disputes/1/resolve', OFFICER, { outcome: 'UPHELD', reason: 'The collector confirms he took the cash' });
    expect(bad.status).toBe(409);
    expect(bad.body.code).toBe('SELF_RESOLUTION_NOT_ALLOWED');
  });

  it('lets a member add an explanation only to their own case', async () => {
    svc.addCaseNote.mockResolvedValue({ eventId: 1 });
    mockDb.ajoDefaultCase.findFirst.mockResolvedValue({ membership: { member: { userId: MEMBER } } });
    expect((await call('post', '/api/ajo/cases/3/member-response', MEMBER, { note: 'My shop was closed for two weeks' })).status).toBe(201);
    expect(svc.addCaseNote).toHaveBeenCalledWith({ associationId: ASSOC, caseId: 3, actorUserId: MEMBER, note: 'My shop was closed for two weeks', fromMember: true });
    svc.addCaseNote.mockClear();
    expect((await call('post', '/api/ajo/cases/3/member-response', OTHER, { note: 'My shop was closed for two weeks' })).status).toBe(404);
    mockDb.ajoDefaultCase.findFirst.mockResolvedValue(null);
    expect((await call('post', '/api/ajo/cases/3/member-response', MEMBER, { note: 'My shop was closed for two weeks' })).status).toBe(404);
    expect(svc.addCaseNote).not.toHaveBeenCalled();
  });

  it('lets the member or an officer agree a plan, saying whether the actor can manage', async () => {
    svc.agreePlan.mockResolvedValue({ planId: 9, status: 'ACTIVE', replayed: false });
    await call('post', '/api/ajo/plans/9/agree', MEMBER, {});
    expect(svc.agreePlan).toHaveBeenLastCalledWith({ associationId: ASSOC, planId: 9, actorUserId: MEMBER, actorCanManage: false, note: undefined });
    await call('post', '/api/ajo/plans/9/agree', OFFICER, { note: 'Agreed on the phone with her' });
    expect(svc.agreePlan).toHaveBeenLastCalledWith({ associationId: ASSOC, planId: 9, actorUserId: OFFICER, actorCanManage: true, note: 'Agreed on the phone with her' });
  });
});

describe('officer actions', () => {
  it('passes the fee, note and reason inputs through, and replies with the replay message when it is a repeat', async () => {
    svc.waiveLateFee.mockResolvedValue({ fee: {}, replayed: false });
    const r = await call('post', '/api/ajo/late-fees/4/waive', OFFICER, { reason: 'Goodwill: the collector was away' });
    expect(r.status).toBe(200);
    expect(svc.waiveLateFee).toHaveBeenCalledWith({ associationId: ASSOC, feeId: 4, actorUserId: OFFICER, reason: 'Goodwill: the collector was away' });
    svc.waiveLateFee.mockResolvedValue({ fee: {}, replayed: true });
    expect((await call('post', '/api/ajo/late-fees/4/waive', OFFICER, { reason: 'Goodwill: the collector was away' })).body.message).toBe('Already waived.');
    expect((await call('post', '/api/ajo/late-fees/4/waive', OFFICER, {})).status).toBe(400);
    svc.markFeeNotified.mockResolvedValue({ replayed: false });
    expect((await call('post', '/api/ajo/late-fees/4/told', OFFICER, { note: 'Told her in person' })).status).toBe(200);
    expect(svc.markFeeNotified).toHaveBeenCalledWith({ associationId: ASSOC, feeId: 4, actorUserId: OFFICER, note: 'Told her in person' });
  });

  it('opens a case and drafts a plan, with 201 only when something new was created', async () => {
    svc.openCase.mockResolvedValue({ caseId: 3, created: true, procedure: 'CASE_AND_PLAN' });
    expect((await call('post', '/api/ajo/memberships/10/cases', OFFICER)).status).toBe(201);
    expect(svc.openCase).toHaveBeenCalledWith({ associationId: ASSOC, membershipId: 10, actorUserId: OFFICER });
    svc.openCase.mockResolvedValue({ caseId: 3, created: false, procedure: 'CASE_AND_PLAN' });
    expect((await call('post', '/api/ajo/memberships/10/cases', OFFICER)).status).toBe(200);
    svc.openCase.mockRejectedValue(new RuleError('Only a rotating pot has defaults.', 409, 'NOT_A_ROTATING_POT'));
    expect((await call('post', '/api/ajo/memberships/10/cases', OFFICER)).body.code).toBe('NOT_A_ROTATING_POT');
    svc.proposePlan.mockResolvedValue({ planId: 9, schedule: [] });
    expect((await call('post', '/api/ajo/cases/3/plan', OFFICER, { periods: 4 })).status).toBe(201);
    expect(svc.proposePlan).toHaveBeenCalledWith({ associationId: ASSOC, caseId: 3, actorUserId: OFFICER, periods: 4 });
    expect((await call('post', '/api/ajo/cases/3/plan', OFFICER, { periods: 99 })).status).toBe(400);
  });
});

describe('the add-on gate', () => {
  it('after the add-on expires, keeps everything readable and refuses every write with ADDON_EXPIRED', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    for (const fn of [svc.listLateFees, svc.listDisputes, svc.listCases, svc.listGroupTrust]) fn.mockResolvedValue([]);
    svc.getMembershipTrust.mockResolvedValue({});
    for (const url of ['/api/ajo/groups/1/late-fees', '/api/ajo/groups/1/disputes', '/api/ajo/groups/1/cases', '/api/ajo/groups/1/trust', '/api/ajo/memberships/10/trust']) {
      expect(`${url}: ${(await call('get', url, ADMIN)).status}`).toBe(`${url}: 200`);
    }
    const writes: Array<[string, string, object]> = [
      ['/api/ajo/late-fees/4/waive', 'post', { reason: 'Goodwill: the collector was away' }],
      ['/api/ajo/memberships/10/disputes', 'post', { installmentId: 7, claim: 'I paid the collector in cash on Monday morning' }],
      ['/api/ajo/disputes/1/resolve', 'post', { outcome: 'UPHELD', reason: 'The collector confirms he took the cash' }],
      ['/api/ajo/memberships/10/cases', 'post', {}],
      ['/api/ajo/cases/3/close', 'post', { outcome: 'RESOLVED', reason: 'She paid at the meeting' }],
      ['/api/ajo/plans/9/agree', 'post', {}],
    ];
    for (const [url, method, body] of writes) {
      const res = await call(method, url, ADMIN, body);
      expect(`${url}: ${res.status} ${res.body.code}`).toBe(`${url}: 403 ADDON_EXPIRED`);
    }
    for (const name of ['waiveLateFee', 'raiseDispute', 'resolveDispute', 'openCase', 'closeCase', 'agreePlan'] as const) expect(svc[name]).not.toHaveBeenCalled();
  });

  it('gives a tenant that never had the add-on MODULE_DISABLED, even for reading', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    mockDb.ajoGroup.findFirst.mockResolvedValue(null);
    const res = await call('get', '/api/ajo/groups/1/late-fees', ADMIN);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MODULE_DISABLED');
    expect(svc.listLateFees).not.toHaveBeenCalled();
  });

  it('requires sign-in', async () => {
    expect((await request(app).get('/api/ajo/groups/1/trust')).status).toBe(401);
  });
});
