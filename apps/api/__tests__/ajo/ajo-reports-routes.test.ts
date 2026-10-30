/**
 * The Ajo report routes over HTTP (T10): the real router and controller, with sign-in, permission checks, the report service and the
 * database stood in for. What is under test is the wiring: who can reach the reports, that an officer and a collector are told apart,
 * how the query becomes what the service receives, the file headers, and that an expired add-on can still read and export.
 */
import express from 'express';
import request from 'supertest';

const mockPerms = new Map<number, string[]>();
const svc = { listReports: jest.fn(), runReport: jest.fn(), exportReport: jest.fn() };
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
jest.mock('../../src/modules/ajo/reports/report.service', () => ({
  listReports: (...a: unknown[]) => svc.listReports(...a),
  runReport: (...a: unknown[]) => svc.runReport(...a),
  exportReport: (...a: unknown[]) => svc.exportReport(...a),
}));
// The other Ajo pieces the router also loads.
jest.mock('../../src/modules/ajo/ajo-payout.service', () => ({ previewPayout: jest.fn(), preparePayout: jest.fn(), prepareAllReady: jest.fn(), approvePayout: jest.fn(), voidPayout: jest.fn(), recordPayoutPaid: jest.fn(), reversePaidPayout: jest.fn(), listPayouts: jest.fn(), getPayout: jest.fn(), listOwnPayouts: jest.fn(), completeGroup: jest.fn() }));
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
const MEMBER = 2; // ajo.view_own
const OFFICER = 6; // ajo.manage + ajo.reports
const COLLECTOR = 8; // ajo.collect + ajo.reports, no officer permission
const RECONCILER = 5; // ajo.reconcile + ajo.reports
const NO_REPORTS = 9; // ajo.manage but not ajo.reports

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms.set(MEMBER, ['ajo.view_own', 'ajo.contribute']);
  mockPerms.set(OFFICER, ['ajo.view_own', 'ajo.manage', 'ajo.reports']);
  mockPerms.set(COLLECTOR, ['ajo.collect', 'ajo.reports']);
  mockPerms.set(RECONCILER, ['ajo.reconcile', 'ajo.reports']);
  mockPerms.set(NO_REPORTS, ['ajo.view_own', 'ajo.manage']);
  mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: true, source: 'addon' });
  mockDb.ajoGroup.findFirst.mockResolvedValue({ id: 1 });
  svc.listReports.mockResolvedValue([]);
  svc.runReport.mockResolvedValue({ name: 'contributions', blocks: [], rows: [] });
  svc.exportReport.mockResolvedValue({ body: 'a,b\r\n', contentType: 'text/csv; charset=utf-8', fileName: 'ajo-contributions-2027-03-01-to-2027-03-31.csv' });
});

describe('who can reach the reports', () => {
  it('needs the reports permission for the list, a report and an export; a member and an officer without it are refused', async () => {
    for (const url of ['/api/ajo/reports', '/api/ajo/reports/contributions', '/api/ajo/reports/contributions/export']) {
      expect((await request(app).get(url)).status).toBe(401);
      for (const user of [MEMBER, NO_REPORTS]) expect(`${url} as ${user}: ${(await request(app).get(url).set('x-test-user', as(user))).status}`).toBe(`${url} as ${user}: 403`);
    }
    for (const fn of Object.values(svc)) expect(fn).not.toHaveBeenCalled();
  });

  it('tells an officer from a collector: anyone who manages, reconciles or approves is an officer, anyone else with the permission is a collector', async () => {
    await request(app).get('/api/ajo/reports').set('x-test-user', as(OFFICER));
    await request(app).get('/api/ajo/reports').set('x-test-user', as(RECONCILER));
    await request(app).get('/api/ajo/reports').set('x-test-user', as(COLLECTOR));
    const scopes = svc.listReports.mock.calls.map((c) => c[0].scope);
    expect(scopes).toEqual([{ userId: OFFICER, collectorOnly: false }, { userId: RECONCILER, collectorOnly: false }, { userId: COLLECTOR, collectorOnly: true }]);
    expect(svc.listReports.mock.calls[0][0]).toMatchObject({ associationId: ASSOC, access: 'FULL' });
  });
});

describe('running a report', () => {
  it('hands the filters and the page to the service, from the signed-in association and never from the request', async () => {
    const res = await request(app).get('/api/ajo/reports/payouts?groupId=4&from=2027-03-01&to=2027-03-31&membershipId=9&page=2&pageSize=25&associationId=999').set('x-test-user', as(OFFICER));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const arg = svc.runReport.mock.calls[0][0];
    expect(arg).toMatchObject({ associationId: ASSOC, name: 'payouts', page: 2, pageSize: 25, scope: { userId: OFFICER, collectorOnly: false } });
    expect(arg.query).toMatchObject({ groupId: '4', from: '2027-03-01', to: '2027-03-31', membershipId: '9' });
  });

  it('refuses a page size above 200 and a page below 1', async () => {
    expect((await request(app).get('/api/ajo/reports/contributions?pageSize=1000').set('x-test-user', as(OFFICER))).status).toBe(400);
    expect((await request(app).get('/api/ajo/reports/contributions?page=0').set('x-test-user', as(OFFICER))).status).toBe(400);
    expect(svc.runReport).not.toHaveBeenCalled();
  });

  it('passes a refusal from the service through with its status and code, so the apps can show it', async () => {
    svc.runReport.mockRejectedValueOnce(new RuleError('Advanced reports are not part of your Ajo tier. Upgrade the tier to use this report.', 403, 'REPORT_NOT_IN_TIER'));
    const tier = await request(app).get('/api/ajo/reports/collectors').set('x-test-user', as(OFFICER));
    expect(tier.status).toBe(403);
    expect(tier.body).toMatchObject({ success: false, code: 'REPORT_NOT_IN_TIER' });
    svc.runReport.mockRejectedValueOnce(new RuleError('Pick a range of 12 months or less.', 400, 'RANGE_TOO_LONG'));
    expect((await request(app).get('/api/ajo/reports/contributions').set('x-test-user', as(OFFICER))).body.code).toBe('RANGE_TOO_LONG');
    svc.runReport.mockRejectedValueOnce(new Error('connection string postgres://user:secret@host/db'));
    const boom = await request(app).get('/api/ajo/reports/contributions').set('x-test-user', as(OFFICER));
    expect(boom.status).toBe(500);
    expect(JSON.stringify(boom.body)).not.toContain('secret');
  });
});

describe('exporting a report', () => {
  it('sends the file as an attachment that is never cached, a CSV unless a PDF is asked for', async () => {
    const csv = await request(app).get('/api/ajo/reports/contributions/export?from=2027-03-01&to=2027-03-31').set('x-test-user', as(OFFICER));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toBe('attachment; filename="ajo-contributions-2027-03-01-to-2027-03-31.csv"');
    expect(csv.headers['cache-control']).toBe('no-store');
    expect(svc.exportReport.mock.calls[0][0]).toMatchObject({ associationId: ASSOC, name: 'contributions', format: 'csv', actorUserId: OFFICER });

    svc.exportReport.mockResolvedValueOnce({ body: Buffer.from('%PDF-1.3'), contentType: 'application/pdf', fileName: 'ajo-contributions-x.pdf' });
    const pdf = await request(app).get('/api/ajo/reports/contributions/export?format=pdf').set('x-test-user', as(OFFICER));
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(svc.exportReport.mock.calls[1][0]).toMatchObject({ format: 'pdf' });
  });

  it('refuses a format that is not csv or pdf, before making anything', async () => {
    expect((await request(app).get('/api/ajo/reports/contributions/export?format=xlsx').set('x-test-user', as(OFFICER))).status).toBe(400);
    expect(svc.exportReport).not.toHaveBeenCalled();
  });
});

describe('an expired add-on', () => {
  it('still lets the reports be read and exported, because both are GETs, and tells the service it is read-only', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'addon' });
    expect((await request(app).get('/api/ajo/reports/contributions').set('x-test-user', as(OFFICER))).status).toBe(200);
    expect((await request(app).get('/api/ajo/reports/contributions/export').set('x-test-user', as(OFFICER))).status).toBe(200);
    expect(svc.runReport.mock.calls[0][0].access).toBe('READ_ONLY');
    expect(svc.exportReport.mock.calls[0][0].access).toBe('READ_ONLY');
  });

  it('closes the reports when the tenant never had Ajo', async () => {
    mockModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    mockDb.ajoGroup.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/ajo/reports').set('x-test-user', as(OFFICER));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MODULE_DISABLED');
    expect(svc.listReports).not.toHaveBeenCalled();
  });
});
