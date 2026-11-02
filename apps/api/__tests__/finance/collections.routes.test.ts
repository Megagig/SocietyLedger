/**
 * The record-payment, open-charges and export routes over HTTP: the real router and controllers, with sign-in, permission checks, the
 * services and the database stood in for. What is under test is the wiring: who can reach what, how a request becomes what the service
 * receives, that a refused charge is named in the answer, and that a file comes back as a file.
 */
import express from 'express';
import request from 'supertest';
import { Decimal } from '@prisma/client/runtime/library';

const mockPerms = new Map<number, string[]>();
const recorder = { record: jest.fn() };
const collections = { build: jest.fn(), openCharges: jest.fn() };
const mockDb = { auditLog: { create: jest.fn(async () => ({})) } };

jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: mockDb, prisma: mockDb }));
jest.mock('../../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const raw = req.header('x-test-user');
    if (!raw) return res.status(401).json({ success: false, message: 'Not signed in' });
    req.user = JSON.parse(raw);
    return next();
  },
}));
jest.mock('../../src/middleware/tenant.middleware', () => ({
  tenantMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
jest.mock('../../src/middleware/module-feature.middleware', () => ({
  requireFeature: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireModule: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
jest.mock('../../src/middleware/rbac', () => ({
  requirePermission: (key: string) => (req: express.Request, res: express.Response, next: express.NextFunction) =>
    (mockPerms.get(req.user!.id) ?? []).includes(key) ? next() : res.status(403).json({ success: false, code: 'FORBIDDEN' }),
  requireAnyPermission: (keys: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) =>
    keys.some((k) => (mockPerms.get(req.user!.id) ?? []).includes(k)) ? next() : res.status(403).json({ success: false, code: 'FORBIDDEN' }),
}));
jest.mock('../../src/modules/finance/payment-recording.service', () => {
  const actual = jest.requireActual('../../src/modules/finance/payment-recording.service');
  return { ...actual, paymentRecordingService: recorder };
});
jest.mock('../../src/modules/finance/collections/collections.service', () => ({ collectionsService: collections, memberBalances: jest.fn() }));

import { PaymentRuleError } from '../../src/modules/finance/payment-recording.service';
import financeRoutes from '../../src/modules/finance/finance.routes';

const app = express();
app.use(express.json());
app.use('/api/finance', financeRoutes);

const as = (id: number) => JSON.stringify({ id, associationId: 5, platformRole: null });
const TREASURER = 1;
const MEMBER = 2;
const ANALYST = 3;

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms.set(TREASURER, ['payments.manual_create', 'exports.financial']);
  mockPerms.set(MEMBER, []);
  mockPerms.set(ANALYST, ['exports.financial']);
});

const saved = (transactionId: number, receipt: string) => ({
  payment: { id: transactionId * 10, amountPaid: new Decimal(3000), receiptNumber: receipt },
  transactionId,
  label: 'Burial Levy (Ada Obi)',
  transactionStatus: 'paid',
  remainingBalance: new Decimal(0),
});

describe('POST /payments/batch', () => {
  const post = (user: string, body: unknown) => request(app).post('/api/finance/payments/batch').set('x-test-user', user).send(body as object);

  it('turns away someone without the payment permission', async () => {
    expect((await post(as(MEMBER), { items: [{ transactionId: 1, amountPaid: 100 }] })).status).toBe(403);
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it('hands the items, method, date and screen to the service and returns a receipt per charge', async () => {
    recorder.record.mockResolvedValue([saved(1, 'RCP000001-111111'), saved(2, 'RCP000002-111111')]);
    const res = await post(as(TREASURER), {
      items: [{ transactionId: 1, amountPaid: 3000 }, { transactionId: 2, amountPaid: 3000 }],
      paymentMethod: 'cash',
      paymentDate: '2026-11-02T10:00:00.000Z',
      source: 'member-ledger',
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('2 payments recorded successfully');
    expect(res.body.data.payments.map((p: { receiptNumber: string }) => p.receiptNumber)).toEqual(['RCP000001-111111', 'RCP000002-111111']);
    expect(recorder.record).toHaveBeenCalledWith(5, TREASURER, expect.objectContaining({ items: [{ transactionId: 1, amountPaid: 3000 }, { transactionId: 2, amountPaid: 3000 }], paymentMethod: 'cash', source: 'member-ledger' }));
    expect(recorder.record.mock.calls[0][2].paymentDate).toBeInstanceOf(Date);
  });

  it('names the charge that stopped the batch, with the real status', async () => {
    recorder.record.mockRejectedValue(new PaymentRuleError('Payment amount exceeds balance. Maximum: 1000', 400, 'OVER_BALANCE', 42));
    const res = await post(as(TREASURER), { items: [{ transactionId: 42, amountPaid: 5000 }] });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'OVER_BALANCE', transactionId: 42 });
  });

  it('answers 403 when an officer records their own debt', async () => {
    recorder.record.mockRejectedValue(new PaymentRuleError('Another officer needs to record your payment.', 403, 'SELF_PAYMENT_NOT_ALLOWED', 7));
    const res = await post(as(TREASURER), { items: [{ transactionId: 7, amountPaid: 100 }] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SELF_PAYMENT_NOT_ALLOWED');
  });

  it('refuses an empty list, a zero amount, an unknown method and an unknown screen before reaching the service', async () => {
    expect((await post(as(TREASURER), { items: [] })).status).toBe(400);
    expect((await post(as(TREASURER), { items: [{ transactionId: 1, amountPaid: 0 }] })).status).toBe(400);
    expect((await post(as(TREASURER), { items: [{ transactionId: 1, amountPaid: 5 }], paymentMethod: 'barter' })).status).toBe(400);
    expect((await post(as(TREASURER), { items: [{ transactionId: 1, amountPaid: 5 }], source: 'somewhere' })).status).toBe(400);
    expect(recorder.record).not.toHaveBeenCalled();
  });
});

describe('GET /collections/members/:memberId/open-charges', () => {
  it('needs the payment permission, then asks for that member’s debts on behalf of this officer', async () => {
    collections.openCharges.mockResolvedValue({ member: { id: 9 }, canRecord: true, reason: null, charges: [], totalOwed: 0 });
    expect((await request(app).get('/api/finance/collections/members/9/open-charges').set('x-test-user', as(ANALYST))).status).toBe(403);
    const ok = await request(app).get('/api/finance/collections/members/9/open-charges').set('x-test-user', as(TREASURER));
    expect(ok.status).toBe(200);
    expect(collections.openCharges).toHaveBeenCalledWith(5, 9, TREASURER);
  });
});

describe('GET /collections/export', () => {
  const doc = {
    title: 'Levy campaign: Mum Burial Levy',
    association: 'Savio 96 Alumni',
    filterLine: 'Showing: Yet to pay (part paid and not paid)',
    generatedAt: new Date('2026-11-02T10:00:00Z'),
    summary: [{ label: 'Outstanding', value: 6000, money: true }],
    columns: [{ header: 'Member no.', width: 12 }, { header: 'Member', width: 26 }, { header: 'Balance', width: 14, money: true }],
    rows: [['MEM0001', 'Ada Obi', 3000]],
  };
  const file = (url: string, user: string) =>
    request(app)
      .get(url)
      .set('x-test-user', user)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

  it('sends an Excel file and a PDF, each named for what it holds, and records the export', async () => {
    collections.build.mockResolvedValue(doc);
    const xlsx = await file('/api/finance/collections/export?screen=levy-campaign&id=11&status=owing&search=ada&format=xlsx', as(ANALYST));
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect(xlsx.headers['content-disposition']).toMatch(/levy-campaign-owing-\d{4}-\d{2}-\d{2}\.xlsx/);
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    expect(collections.build).toHaveBeenCalledWith(5, { screen: 'levy-campaign', id: 11, allocationId: undefined, status: 'owing', search: 'ada' });

    const pdf = await file('/api/finance/collections/export?screen=donations&status=all&format=pdf', as(ANALYST));
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(mockDb.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it('turns away someone without the export permission, and refuses an unknown screen or format', async () => {
    expect((await file('/api/finance/collections/export?screen=donations&format=pdf', as(MEMBER))).status).toBe(403);
    expect((await file('/api/finance/collections/export?screen=secrets&format=pdf', as(ANALYST))).status).toBe(400);
    expect((await file('/api/finance/collections/export?screen=donations&format=doc', as(ANALYST))).status).toBe(400);
    expect((await file('/api/finance/collections/export?screen=donations&status=everything&format=pdf', as(ANALYST))).status).toBe(400);
  });
});
