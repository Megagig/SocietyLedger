/**
 * The cooperative enhancement routes over HTTP: the real router and controller, with sign-in, permission checks, the services and the
 * database stood in for. What is under test is the wiring: who can reach what, how a request becomes what the services receive, that bad
 * input is refused with a message rather than a crash, and that the two withdrawal stages are different permissions.
 */
import express from 'express';
import request from 'supertest';
import { Decimal } from '@prisma/client/runtime/library';

const mockPerms = new Map<number, string[]>();
const types = { listAccountTypes: jest.fn(), createAccountType: jest.fn(), updateAccountType: jest.fn(), listLoanCategories: jest.fn() };
const payments = { validateNewRequest: jest.fn(), createRequest: jest.fn(), listRequests: jest.fn(), approve: jest.fn(), reject: jest.fn() };
const withdrawals = { create: jest.fn(), list: jest.fn(), review: jest.fn(), approve: jest.fn(), reject: jest.fn() };
const member = { cashbook: jest.fn(), transactions: jest.fn(), dashboard: jest.fn() };
const mockDb = { association: { findUnique: jest.fn(async () => ({ name: 'Oko Youth Forum' })) }, auditLog: { create: jest.fn() } };

jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: mockDb, prisma: mockDb }));
jest.mock('../../src/lib/storage', () => ({ uploadFile: jest.fn(async () => undefined), getPresignedUrl: jest.fn() }));
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
}));
jest.mock('../../src/middleware/module-feature.middleware', () => ({
  requireModule: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
jest.mock('../../src/services/rbac.service', () => ({
  RBACService: { hasAnyPermission: jest.fn(async (c: { userId: number }, keys: string[]) => keys.some((k) => (mockPerms.get(c.userId) ?? []).includes(k))) },
}));
// The older cooperative controller is not under test here; any handler it is asked for is a no-op.
jest.mock('../../src/modules/cooperatives/cooperatives.controller', () => ({
  cooperativesController: new Proxy({}, { get: () => (_req: unknown, res: express.Response) => res.json({ legacy: true }) }),
}));
jest.mock('../../src/modules/cooperatives/cooperative-deposit-compat', () => ({
  cooperativeDepositCompat: new Proxy({}, { get: () => (_req: unknown, res: express.Response) => res.json({ legacy: true }) }),
}));
jest.mock('../../src/modules/cooperatives/cooperative-types.service', () => ({ cooperativeTypesService: types }));
jest.mock('../../src/modules/cooperatives/cooperative-payments.service', () => ({ cooperativePaymentsService: payments, formatPaymentRequest: jest.fn() }));
jest.mock('../../src/modules/cooperatives/cooperative-withdrawals.service', () => ({ cooperativeWithdrawalsService: withdrawals }));
jest.mock('../../src/modules/cooperatives/cooperative-member.service', () => ({ cooperativeMemberService: member }));
jest.mock('../../src/modules/cooperatives/cooperative-settings', () => ({ getTwoStageWithdrawal: jest.fn(async () => true), setTwoStageWithdrawal: jest.fn() }));

import { RuleError } from '../../src/modules/finance/rule-error';
import coopRoutes from '../../src/modules/cooperatives/cooperatives.routes';

const app = express();
app.use(express.json());
app.use('/api/cooperatives', coopRoutes);

const ASSOC = 5;
const as = (id: number, memberId: number | null = null) => JSON.stringify({ id, associationId: ASSOC, memberId, platformRole: null });
const MEMBER = 1;
const REVIEWER = 2;
const APPROVER = 3;
const TREASURER = 4;

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms.set(MEMBER, ['cooperatives.view_own', 'cooperatives.savings_deposit_own', 'cooperatives.withdraw_own']);
  mockPerms.set(REVIEWER, ['cooperatives.withdrawals.review']);
  mockPerms.set(APPROVER, ['cooperatives.withdrawals.approve']);
  mockPerms.set(TREASURER, ['cooperatives.manage_types', 'ledger.create', 'cooperatives.view_own']);
});

const get = (path: string, user: string | null) => {
  const r = request(app).get(`/api/cooperatives${path}`);
  return user ? r.set('x-test-user', user) : r;
};

describe('who can reach what', () => {
  it('turns away someone who is not signed in', async () => {
    expect((await get('/account-types', null)).status).toBe(401);
  });

  it('lets only the type managers create account types', async () => {
    types.createAccountType.mockResolvedValue({ id: 1, name: 'Christmas savings' });
    const body = { name: 'Christmas savings', accountClass: 'CONTRIBUTION' };
    expect((await request(app).post('/api/cooperatives/account-types').set('x-test-user', as(MEMBER, 10)).send(body)).status).toBe(403);
    const ok = await request(app).post('/api/cooperatives/account-types').set('x-test-user', as(TREASURER, 11)).send(body);
    expect(ok.status).toBe(201);
    expect(types.createAccountType).toHaveBeenCalledWith(ASSOC, expect.objectContaining({ name: 'Christmas savings' }));
  });

  it('keeps the two withdrawal stages on different permissions', async () => {
    withdrawals.review.mockResolvedValue({ id: 7, status: 'PENDING_APPROVAL' });
    withdrawals.approve.mockResolvedValue({ id: 7, status: 'APPROVED' });
    const review = (u: number) => request(app).post('/api/cooperatives/withdrawal-requests/7/review').set('x-test-user', as(u, 20)).send({ decision: 'FORWARD' });
    const approve = (u: number) => request(app).post('/api/cooperatives/withdrawal-requests/7/approve').set('x-test-user', as(u, 21)).send({ payoutMethod: 'BANK_TRANSFER' });
    expect((await review(APPROVER)).status).toBe(403);
    expect((await review(REVIEWER)).status).toBe(200);
    expect((await approve(REVIEWER)).status).toBe(403);
    expect((await approve(APPROVER)).status).toBe(200);
  });

  it('lets a member ask to withdraw but not decide', async () => {
    withdrawals.create.mockResolvedValue({ id: 8, status: 'PENDING_REVIEW' });
    const asked = await request(app).post('/api/cooperatives/withdrawal-requests').set('x-test-user', as(MEMBER, 30)).send({ savingsAccountId: 4, amount: 5000 });
    expect(asked.status).toBe(201);
    expect(withdrawals.create).toHaveBeenCalledWith(ASSOC, 30, expect.objectContaining({ savingsAccountId: 4, amount: 5000 }));
    expect((await request(app).post('/api/cooperatives/withdrawal-requests/8/approve').set('x-test-user', as(MEMBER, 30)).send({})).status).toBe(403);
  });

  it("keeps an officer's view of one member away from the member", async () => {
    expect((await get('/members/9/cashbook', as(MEMBER, 30))).status).toBe(403);
    expect((await get('/members/9/cashbook.pdf', as(MEMBER, 30))).status).toBe(403);
  });
});

describe('what the services receive', () => {
  it('reads the date range as real dates', async () => {
    member.cashbook.mockResolvedValue({ rows: [] });
    const res = await get('/my-cashbook?from=2026-01-01&to=2026-03-31', as(MEMBER, 30));
    expect(res.status).toBe(200);
    const range = member.cashbook.mock.calls[0][2];
    expect(range.from).toBeInstanceOf(Date);
    expect(range.to.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('refuses a date that only looks like one', async () => {
    const res = await get('/my-cashbook?from=2026-13-45', as(MEMBER, 30));
    expect(res.status).toBe(400);
    expect(member.cashbook).not.toHaveBeenCalled();
  });

  it('refuses a payment whose lines are not valid JSON', async () => {
    const res = await request(app)
      .post('/api/cooperatives/payment-requests')
      .set('x-test-user', as(MEMBER, 30))
      .field('paymentDate', '2026-03-04')
      .field('lines', '{not json')
      .attach('file', Buffer.from('x'), { filename: 'proof.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(payments.createRequest).not.toHaveBeenCalled();
  });

  it('asks for proof before accepting a payment', async () => {
    const res = await request(app)
      .post('/api/cooperatives/payment-requests')
      .set('x-test-user', as(MEMBER, 30))
      .field('paymentDate', '2026-03-04')
      .field('lines', JSON.stringify([{ accountTypeId: 1, amount: 5000, periodMonth: 3, periodYear: 2026 }]));
    expect(res.status).toBe(400);
    expect(payments.createRequest).not.toHaveBeenCalled();
  });

  it('turns a rule refusal into its own status and code, not a crash', async () => {
    withdrawals.create.mockRejectedValue(new RuleError('You already have a withdrawal waiting for a decision on this account.', 409, 'WITHDRAWAL_PENDING'));
    const res = await request(app).post('/api/cooperatives/withdrawal-requests').set('x-test-user', as(MEMBER, 30)).send({ savingsAccountId: 4, amount: 5000 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('WITHDRAWAL_PENDING');
  });
});

describe('the cashbook as a PDF', () => {
  it('sends a PDF file for the member, and for an officer opening one member', async () => {
    const zero = new Decimal(0);
    member.cashbook.mockResolvedValue({
      member: { name: 'Anthony Obi', memberNumber: 'M-1' },
      period: { from: null, to: null },
      tiles: { totalShares: zero, totalSavings: zero, totalLoans: zero, totalLoanInterest: zero },
      rows: [],
      totals: { shares: zero, savingsDr: zero, savingsCr: zero, loansDr: zero, loansCr: zero, interestDr: zero, interestCr: zero },
    });
    const own = await get('/my-cashbook.pdf', as(MEMBER, 30))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toContain('application/pdf');
    expect((own.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(member.cashbook).toHaveBeenLastCalledWith(ASSOC, 30, expect.anything());

    await get('/members/42/cashbook.pdf', as(TREASURER, 11));
    expect(member.cashbook).toHaveBeenLastCalledWith(ASSOC, 42, expect.anything());
  });
});
