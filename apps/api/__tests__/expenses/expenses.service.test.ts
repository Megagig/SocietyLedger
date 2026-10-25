/**
 * Recording, approving and voiding spending. The database, storage and the books are replaced by small stand-ins so the rules
 * themselves are what is tested: who may do what, in which state, and that the books are only touched on approval and on a void.
 */
import { Decimal } from '@prisma/client/runtime/library';

type Voucher = Record<string, any>;
let vouchers: Voucher[] = [];
let nextId = 1;
const accounts = [
  { id: 5, associationId: 7, code: '5100', name: 'Hall hire', type: 'EXPENSE', isActive: true, normalBalance: 'DEBIT' },
  { id: 6, associationId: 7, code: '1200', name: 'Prepaid', type: 'ASSET', isActive: true, normalBalance: 'DEBIT' },
  { id: 2, associationId: 7, code: '1112', name: 'Bank', type: 'ASSET', isActive: true, normalBalance: 'DEBIT' },
  { id: 9, associationId: 99, code: '5100', name: 'Elsewhere', type: 'EXPENSE', isActive: true, normalBalance: 'DEBIT' },
];
let cashIds = [2];
let activeBudgets: any[] = [];
let budgetSpent = { debit: 0, credit: 0 };

const m = (...names: string[]) => Object.fromEntries(names.map((n) => [n, jest.fn()]));
const prismaMock: any = {
  expenseVoucher: m('findFirst', 'findMany', 'count', 'aggregate', 'create', 'updateMany', 'update', 'deleteMany'),
  chartOfAccount: m('findFirst', 'findMany', 'findUnique'),
  budget: m('findMany'),
  journalEntryLine: m('aggregate'),
  auditLog: m('create'),
  user: m('findMany'),
  userRole: m('findMany'),
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }));

const mockUpload = jest.fn();
const mockDelete = jest.fn();
jest.mock('../../src/lib/storage', () => ({
  uploadFile: (...a: unknown[]) => mockUpload(...a),
  deleteFile: (...a: unknown[]) => mockDelete(...a),
  getPresignedUrl: jest.fn().mockResolvedValue('https://files.example/receipt'),
}));
const mockReverse = jest.fn();
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: { reverseJournalEntry: (...a: unknown[]) => mockReverse(...a) } }));
const mockPostable = jest.fn();
jest.mock('../../src/modules/accounting/accounting-periods.service', () => ({ accountingPeriodsService: { assertDateIsPostable: (...a: unknown[]) => mockPostable(...a) } }));
const mockCreateEntry = jest.fn();
jest.mock('../../src/modules/accounting/accounting.service', () => ({
  accountingService: { createJournalEntry: (...a: unknown[]) => mockCreateEntry(...a) },
  cashAccountIds: jest.fn(() => Promise.resolve(cashIds)),
}));
let receiptSetting: unknown = 5000;
jest.mock('../../src/modules/settings/settings.service', () => ({ SettingsService: { getSetting: jest.fn(() => Promise.resolve(receiptSetting)) } }));

import { ExpenseRuleError } from '../../src/modules/expenses/expense-rules';
import { expensesService } from '../../src/modules/expenses/expenses.service';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const today = new Date().toISOString().slice(0, 10);
const input = (over: Record<string, unknown> = {}) => ({ payee: 'Ade Hall', description: 'Hall hire for the AGM', amount: 50000, expenseDate: today, categoryAccountId: 5, paidFromAccountId: 2, ...over }) as any;

async function code(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (error) {
    if (error instanceof ExpenseRuleError) return error.code;
    throw error;
  }
  return 'NO_ERROR';
}

const withNames = (v: Voucher) => ({
  ...v,
  category: accounts.find((a) => a.id === v.categoryAccountId) ?? { id: v.categoryAccountId, code: '', name: '' },
  paidFrom: accounts.find((a) => a.id === v.paidFromAccountId) ?? { id: v.paidFromAccountId, code: '', name: '' },
});
const matches = (v: Voucher, where: Record<string, any>) =>
  Object.entries(where).every(([k, cond]) => {
    if (k === 'AND' || k === 'OR') return true;
    if (cond && typeof cond === 'object' && 'in' in cond) return cond.in.includes(v[k]);
    if (cond && typeof cond === 'object' && 'not' in cond) return v[k] !== cond.not;
    return v[k] === cond;
  });

beforeEach(() => {
  jest.clearAllMocks();
  vouchers = [];
  nextId = 1;
  cashIds = [2];
  activeBudgets = [];
  budgetSpent = { debit: 0, credit: 0 };
  receiptSetting = 5000;
  mockPostable.mockResolvedValue(undefined);
  mockUpload.mockResolvedValue('k');
  mockCreateEntry.mockImplementation(() => Promise.resolve({ id: 900 }));
  mockReverse.mockImplementation(() => Promise.resolve({ id: 901 }));
  prismaMock.chartOfAccount.findFirst.mockImplementation(({ where }: any) => Promise.resolve(accounts.find((a) => a.id === where.id && a.associationId === where.associationId && (!where.type || a.type === where.type)) ?? null));
  prismaMock.chartOfAccount.findMany.mockImplementation(({ where }: any) => Promise.resolve(accounts.filter((a) => a.associationId === where.associationId && (!where.type || a.type === where.type) && (!where.id?.in || where.id.in.includes(a.id)))));
  prismaMock.chartOfAccount.findUnique.mockImplementation(({ where }: any) => Promise.resolve(accounts.find((a) => a.id === where.id) ?? null));
  prismaMock.user.findMany.mockResolvedValue([{ id: 1, email: 'treasurer@x.ng' }, { id: 3, email: 'chair@x.ng' }]);
  prismaMock.userRole.findMany.mockResolvedValue([{ userId: 3 }]);
  prismaMock.budget.findMany.mockImplementation(() => Promise.resolve(activeBudgets));
  prismaMock.journalEntryLine.aggregate.mockImplementation(() => Promise.resolve({ _sum: { debitAmount: budgetSpent.debit, creditAmount: budgetSpent.credit } }));
  prismaMock.expenseVoucher.findFirst.mockImplementation(({ where }: any) => {
    if (where.voucherNumber?.startsWith) {
      const same = vouchers.filter((v) => v.voucherNumber.startsWith(where.voucherNumber.startsWith)).sort((a, b) => b.voucherNumber.localeCompare(a.voucherNumber));
      return Promise.resolve(same[0] ? { voucherNumber: same[0].voucherNumber } : null);
    }
    const v = vouchers.find((x) => x.id === where.id && x.associationId === where.associationId);
    return Promise.resolve(v ? withNames(v) : null);
  });
  prismaMock.expenseVoucher.create.mockImplementation(({ data }: any) => {
    const v = { id: nextId++, status: 'DRAFT', receiptKey: null, receiptType: null, submittedAt: null, approvedBy: null, approvedAt: null, overBudget: false, rejectedBy: null, rejectedAt: null, rejectionReason: null, voidedBy: null, voidedAt: null, voidReason: null, journalEntryId: null, reversalEntryId: null, createdAt: new Date(), ...data };
    vouchers.push(v);
    return Promise.resolve(withNames(v));
  });
  prismaMock.expenseVoucher.updateMany.mockImplementation(({ where, data }: any) => {
    const hit = vouchers.filter((v) => matches(v, where));
    hit.forEach((v) => Object.assign(v, data));
    return Promise.resolve({ count: hit.length });
  });
  prismaMock.expenseVoucher.update.mockImplementation(({ where, data }: any) => {
    const v = vouchers.find((x) => x.id === where.id)!;
    Object.assign(v, data);
    return Promise.resolve(withNames(v));
  });
  prismaMock.expenseVoucher.deleteMany.mockImplementation(({ where }: any) => {
    const hit = vouchers.filter((v) => matches(v, where));
    vouchers = vouchers.filter((v) => !hit.includes(v));
    return Promise.resolve({ count: hit.length });
  });
});

/** A voucher recorded by officer 1, ready to be sent. */
const drafted = async (over: Record<string, unknown> = {}) => (await expensesService.create(7, 1, input(over))) as { id: number };
const pending = async (over: Record<string, unknown> = {}) => {
  const v = await drafted(over);
  await expensesService.attachReceipt(7, 1, v.id, { buffer: jpeg, size: jpeg.length });
  await expensesService.submit(7, 1, v.id);
  return v;
};

describe('recording a voucher', () => {
  it('numbers it, starts it as a draft and does not touch the books', async () => {
    const v: any = await drafted();
    expect(v.voucherNumber).toMatch(/^EXP-\d{4}-00001$/);
    expect(v.status).toBe('DRAFT');
    expect(mockCreateEntry).not.toHaveBeenCalled();
    const second: any = await drafted();
    expect(second.voucherNumber).toMatch(/00002$/);
  });

  it('takes the category from the expense accounts and the paid-from from the cash accounts only', async () => {
    expect(await code(drafted({ categoryAccountId: 6 }))).toBe('INVALID_CATEGORY'); // an asset, not an expense
    expect(await code(drafted({ categoryAccountId: 9 }))).toBe('INVALID_CATEGORY'); // another association's account
    expect(await code(drafted({ paidFromAccountId: 6 }))).toBe('INVALID_PAID_FROM'); // not a cash or bank account
    expect(await code(drafted({ paidFromAccountId: 5 }))).toBe('INVALID_PAID_FROM');
  });

  it('refuses a switched-off category', async () => {
    accounts[0].isActive = false;
    expect(await code(drafted())).toBe('INVALID_CATEGORY');
    accounts[0].isActive = true;
  });

  it('can be changed only by the officer who recorded it', async () => {
    const v = await drafted();
    expect(await code(expensesService.update(7, 3, v.id, input({ amount: 100 })))).toBe('NOT_YOURS');
    const changed: any = await expensesService.update(7, 1, v.id, input({ amount: 100 }));
    expect(new Decimal(changed.amount).toString()).toBe('100');
  });

  it('cannot be found from another association', async () => {
    const v = await drafted();
    expect(await code(expensesService.get(99, v.id))).toBe('EXPENSE_NOT_FOUND');
  });

  it('can be deleted only while a draft', async () => {
    const v = await pending();
    expect(await code(expensesService.remove(7, 1, v.id))).toBe('WRONG_STATUS');
    const d = await drafted();
    expect(await expensesService.remove(7, 1, d.id)).toEqual({ removed: true });
  });
});

describe('the receipt', () => {
  it('is stored under the association, and the old one is removed when it is replaced', async () => {
    const v = await drafted();
    await expensesService.attachReceipt(7, 1, v.id, { buffer: jpeg, size: jpeg.length });
    expect(mockUpload.mock.calls[0][0]).toMatch(new RegExp(`^expense-receipts/7/${v.id}-\\d+\\.jpg$`));
    await expensesService.attachReceipt(7, 1, v.id, { buffer: jpeg, size: jpeg.length });
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('must really be a picture or a PDF, and no more than 5MB', async () => {
    const v = await drafted();
    const script = Buffer.from('<script>alert(1)</script>'.padEnd(40, ' '));
    expect(await code(expensesService.attachReceipt(7, 1, v.id, { buffer: script, size: script.length }))).toBe('RECEIPT_TYPE');
    expect(await code(expensesService.attachReceipt(7, 1, v.id, { buffer: jpeg, size: 6 * 1024 * 1024 }))).toBe('RECEIPT_TOO_LARGE');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('says plainly when file storage cannot be reached, and leaves the voucher as it was', async () => {
    const v = await drafted();
    mockUpload.mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9000'), { code: 'ECONNREFUSED' }));
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await code(expensesService.attachReceipt(7, 1, v.id, { buffer: jpeg, size: jpeg.length }))).toBe('STORAGE_UNAVAILABLE');
    quiet.mockRestore();
    expect(prismaMock.expenseVoucher.update).not.toHaveBeenCalled();
    expect(((await expensesService.get(7, v.id)) as any).hasReceipt).toBe(false);
  });

  it('can be attached only by the officer who recorded it', async () => {
    const v = await drafted();
    expect(await code(expensesService.attachReceipt(7, 3, v.id, { buffer: jpeg, size: jpeg.length }))).toBe('NOT_YOURS');
  });
});

describe('sending for approval', () => {
  it('needs the receipt above the limit', async () => {
    const v = await drafted({ amount: 50000 });
    expect(await code(expensesService.submit(7, 1, v.id))).toBe('RECEIPT_REQUIRED');
  });

  it('needs a reason when a small amount has no receipt', async () => {
    const v = await drafted({ amount: 800 });
    expect(await code(expensesService.submit(7, 1, v.id))).toBe('RECEIPT_OR_REASON');
    await expensesService.update(7, 1, v.id, input({ amount: 800, noReceiptReason: 'Bus fare, no receipt' }));
    expect(await code(expensesService.submit(7, 1, v.id))).toBe('NO_ERROR');
  });

  it('uses the limit the association set', async () => {
    receiptSetting = 100000;
    const v = await drafted({ amount: 50000, noReceiptReason: 'Paid in cash at the gate' });
    expect(await code(expensesService.submit(7, 1, v.id))).toBe('NO_ERROR');
  });

  it('is refused for a date in a closed period', async () => {
    const v = await drafted({ amount: 800, noReceiptReason: 'no receipt' });
    mockPostable.mockRejectedValueOnce(new ExpenseRuleError('The period is closed.', 409, 'PERIOD_CLOSED'));
    expect(await code(expensesService.submit(7, 1, v.id))).toBe('PERIOD_CLOSED');
  });

  it('can be taken back by the officer who sent it, and then changed', async () => {
    const v = await pending();
    expect(await code(expensesService.update(7, 1, v.id, input()))).toBe('WRONG_STATUS');
    const back: any = await expensesService.withdraw(7, 1, v.id);
    expect(back.status).toBe('DRAFT');
    expect(await code(expensesService.withdraw(7, 3, v.id))).toBe('NOT_YOURS');
    expect(await code(expensesService.withdraw(7, 1, v.id))).toBe('WRONG_STATUS'); // it is a draft again
  });
});

describe('who can decide a voucher that is waiting', () => {
  it('counts the other officers who can approve payments, never the one who recorded it', async () => {
    const v = await pending();
    const waiting: any = await expensesService.get(7, v.id);
    expect(waiting.otherApprovers).toBe(1);
    const where = prismaMock.userRole.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ associationId: 7, isActive: true, userId: { not: 1 }, user: { isActive: true } });
    expect(where.role.permissions.some.permission.key).toBe('payments.approve');
  });

  it('says zero when nobody else can decide it, so the screens can say so', async () => {
    prismaMock.userRole.findMany.mockResolvedValue([]);
    const v = await pending();
    expect(((await expensesService.get(7, v.id)) as any).otherApprovers).toBe(0);
  });

  it('has nothing to say once it is no longer waiting', async () => {
    const d: any = await drafted();
    expect(((await expensesService.get(7, d.id)) as any).otherApprovers).toBeNull();
    expect(prismaMock.userRole.findMany).not.toHaveBeenCalled();
  });
});

describe('approving', () => {
  it('is refused for the officer who recorded it', async () => {
    const v = await pending();
    expect(await code(expensesService.approve(7, 1, v.id))).toBe('OWN_EXPENSE');
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  it('posts the books: debit the category, credit the account it was paid from, with the voucher as the source', async () => {
    const v = await pending();
    const approved: any = await expensesService.approve(7, 3, v.id);
    expect(approved.status).toBe('APPROVED');
    expect(approved.journalEntryId).toBe(900);
    const [associationId, userId, entry, options] = mockCreateEntry.mock.calls[0];
    expect(associationId).toBe(7);
    expect(userId).toBe(3);
    expect(entry.lines).toEqual([
      expect.objectContaining({ accountId: 5, debitAmount: 50000, creditAmount: 0 }),
      expect.objectContaining({ accountId: 2, debitAmount: 0, creditAmount: 50000 }),
    ]);
    expect(entry.reference).toMatch(/^EXP-/);
    expect(options).toEqual({ source: { type: 'ExpenseVoucher', id: v.id }, autoPost: true });
  });

  it('cannot post twice when two officers approve at the same moment', async () => {
    const v = await pending();
    await expensesService.approve(7, 3, v.id);
    expect(await code(expensesService.approve(7, 4, v.id))).toBe('WRONG_STATUS');
    expect(mockCreateEntry).toHaveBeenCalledTimes(1);
  });

  it('goes back to waiting when the books refuse the entry', async () => {
    const v = await pending();
    mockCreateEntry.mockRejectedValueOnce(new ExpenseRuleError('The period is closed.', 409, 'PERIOD_CLOSED'));
    expect(await code(expensesService.approve(7, 3, v.id))).toBe('PERIOD_CLOSED');
    const after: any = await expensesService.get(7, v.id);
    expect(after.status).toBe('PENDING_APPROVAL');
    expect(after.approvedBy).toBeNull();
    expect(after.journalEntryId).toBeNull();
  });

  it('records that it went over budget, without refusing', async () => {
    activeBudgets = [{ id: 4, name: '2026 budget', startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-31T22:59:59Z'), items: [{ annualAmount: 100000 }] }];
    budgetSpent = { debit: 80000, credit: 0 };
    const v = await pending({ amount: 50000, expenseDate: '2026-10-10' });
    const approved: any = await expensesService.approve(7, 3, v.id);
    expect(approved.status).toBe('APPROVED');
    expect(approved.overBudget).toBe(true);
  });

  it('is not marked over budget when it stays inside the plan, or when no budget covers the category', async () => {
    const v = await pending({ amount: 1000 });
    expect(((await expensesService.approve(7, 3, v.id)) as any).overBudget).toBe(false);
    activeBudgets = [{ id: 4, name: 'b', startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-31T22:59:59Z'), items: [{ annualAmount: 100000 }] }];
    budgetSpent = { debit: 10000, credit: 0 };
    const w = await pending({ amount: 1000, expenseDate: '2026-10-10' });
    expect(((await expensesService.approve(7, 3, w.id)) as any).overBudget).toBe(false);
  });
});

describe('where the category stands against the budget', () => {
  it('shows used and left, and how far over this voucher would take it', async () => {
    activeBudgets = [{ id: 4, name: '2026 budget', startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-31T22:59:59Z'), items: [{ annualAmount: 200000 }] }];
    budgetSpent = { debit: 120000, credit: 0 };
    const within: any = await expensesService.checkBudget(7, 5, 50000, '2026-10-10');
    expect(within.left.toString()).toBe('30000');
    expect(within.overBy.toString()).toBe('0');
    const over: any = await expensesService.checkBudget(7, 5, 100000, '2026-10-10');
    expect(over.overBy.toString()).toBe('20000');
  });

  it('shows nothing for a category with no budget line', async () => {
    expect(await expensesService.checkBudget(7, 5, 50000, '2026-10-10')).toBeNull();
  });

  it('shows nothing when the date is outside the budget year', async () => {
    activeBudgets = [{ id: 4, name: 'b', startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-31T22:59:59Z'), items: [{ annualAmount: 1000 }] }];
    expect(await expensesService.checkBudget(7, 5, 50000, '2025-10-10')).toBeNull();
  });
});

describe('rejecting', () => {
  it('stores the reason, and the writer can then change it and send it again', async () => {
    const v = await pending();
    const rejected: any = await expensesService.reject(7, 3, v.id, 'The receipt is for another event');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('The receipt is for another event');
    const changed: any = await expensesService.update(7, 1, v.id, input());
    expect(changed.status).toBe('DRAFT');
    expect(changed.rejectionReason).toBeNull();
  });

  it('is refused for the officer who recorded it, and for anything not waiting', async () => {
    const v = await pending();
    expect(await code(expensesService.reject(7, 1, v.id, 'my own mistake'))).toBe('OWN_EXPENSE');
    await expensesService.approve(7, 3, v.id);
    expect(await code(expensesService.reject(7, 4, v.id, 'too late'))).toBe('WRONG_STATUS');
  });
});

describe('voiding', () => {
  it('posts the reversal and keeps the voucher, as voided', async () => {
    const v = await pending();
    await expensesService.approve(7, 3, v.id);
    const voided: any = await expensesService.voidVoucher(7, 3, v.id, 'Paid twice');
    expect(voided.status).toBe('VOIDED');
    expect(voided.voidReason).toBe('Paid twice');
    expect(voided.reversalEntryId).toBe(901);
    expect(mockReverse.mock.calls[0][2]).toBe(900); // the original entry
    expect(vouchers).toHaveLength(1); // never deleted
  });

  it('is only for an approved voucher, and only once', async () => {
    const d = await drafted();
    expect(await code(expensesService.voidVoucher(7, 3, d.id, 'x'))).toBe('WRONG_STATUS');
    const v = await pending();
    await expensesService.approve(7, 3, v.id);
    await expensesService.voidVoucher(7, 3, v.id, 'Paid twice');
    expect(await code(expensesService.voidVoucher(7, 3, v.id, 'again'))).toBe('WRONG_STATUS');
    expect(mockReverse).toHaveBeenCalledTimes(1);
  });

  it('changes nothing when the reversal cannot be posted', async () => {
    const v = await pending();
    await expensesService.approve(7, 3, v.id);
    mockReverse.mockRejectedValueOnce(new ExpenseRuleError('The period is closed.', 409, 'PERIOD_CLOSED'));
    expect(await code(expensesService.voidVoucher(7, 3, v.id, 'Paid twice'))).toBe('PERIOD_CLOSED');
    const after: any = await expensesService.get(7, v.id);
    expect(after.status).toBe('APPROVED');
    expect(after.voidReason).toBeNull();
  });
});
