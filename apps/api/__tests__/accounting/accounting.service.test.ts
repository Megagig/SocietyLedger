/**
 * The books: how an entry moves from draft to posted, what the statements add up, and the checks that keep a closed period closed.
 * The database is replaced by a small in-memory stand-in so the rules themselves are what is tested.
 */
import { Prisma } from '@prisma/client';

type Account = { id: number; associationId: number; code: string; name: string; type: string; subType: string | null; normalBalance: string; isActive: boolean; isSystemAccount?: boolean; parentId?: number | null; cash?: boolean };
type PostedLine = { accountId: number; debit: number; credit: number; date: Date; entryId: number; others?: number[] };

let accounts: Account[] = [];
let postedLines: PostedLine[] = [];
let periods: any[] = [];

const m = (...names: string[]) => Object.fromEntries(names.map((n) => [n, jest.fn()]));
const prismaMock: any = {
  journalEntry: m('create', 'findFirst', 'findMany', 'count', 'updateMany'),
  journalEntryLine: m('groupBy', 'findMany', 'deleteMany', 'createMany', 'count'),
  chartOfAccount: m('findMany', 'findFirst', 'findUnique', 'create', 'update', 'delete', 'count'),
  budget: m('create', 'findFirst', 'findMany', 'count', 'updateMany'),
  budgetItem: m('count', 'deleteMany', 'createMany'),
  accountingPeriod: m('findMany', 'findFirst', 'create', 'updateMany', 'findUniqueOrThrow'),
  auditLog: m('create'),
  $transaction: jest.fn((run: (c: unknown) => unknown) => run(prismaMock)),
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }));

import { accountingService } from '../../src/modules/accounting/accounting.service';
import { accountingPeriodsService } from '../../src/modules/accounting/accounting-periods.service';
import { AccountingRuleError, lagosDayEnd, lagosDayStart } from '../../src/modules/accounting/accounting-rules';

const acct = (id: number, type: string, over: Partial<Account> = {}): Account => ({
  id, associationId: 7, code: String(1000 + id), name: `Account ${id}`, type, subType: null, isActive: true,
  normalBalance: type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT', ...over,
});

async function code(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (error) {
    if (error instanceof AccountingRuleError) return error.code;
    throw error;
  }
  return 'NO_ERROR';
}

const inRange = (d: Date, f?: { gte?: Date; lte?: Date }) => !f || ((!f.gte || d >= f.gte) && (!f.lte || d <= f.lte));

beforeEach(() => {
  jest.clearAllMocks();
  accounts = [];
  postedLines = [];
  periods = [];
  prismaMock.accountingPeriod.findMany.mockImplementation(() => Promise.resolve(periods));
  prismaMock.chartOfAccount.findMany.mockImplementation(({ where }: any) => {
    let rows = accounts.filter((a) => a.associationId === where.associationId);
    if (where.id?.in) rows = rows.filter((a) => where.id.in.includes(a.id));
    if (where.type) rows = rows.filter((a) => (where.type.in ? where.type.in.includes(a.type) : a.type === where.type));
    if (where.subType) rows = rows.filter((a) => a.subType === where.subType);
    if (where.isActive !== undefined) rows = rows.filter((a) => a.isActive === where.isActive);
    if (where.OR) rows = rows.filter((a) => a.cash && a.type === 'ASSET');
    return Promise.resolve(rows);
  });
  prismaMock.journalEntryLine.groupBy.mockImplementation(({ where }: any) => {
    const f = where.journalEntry.entryDate;
    const rows = postedLines.filter((l) => (!where.accountId?.in || where.accountId.in.includes(l.accountId)) && inRange(l.date, f));
    const byAccount = new Map<number, { d: number; c: number }>();
    rows.forEach((l) => byAccount.set(l.accountId, { d: (byAccount.get(l.accountId)?.d ?? 0) + l.debit, c: (byAccount.get(l.accountId)?.c ?? 0) + l.credit }));
    return Promise.resolve([...byAccount].map(([accountId, s]) => ({ accountId, _sum: { debitAmount: s.d, creditAmount: s.c } })));
  });
  prismaMock.journalEntry.findFirst.mockResolvedValue(null);
});

// ---------------------------------------------------------------- creating

describe('createJournalEntry', () => {
  const data = (over: object = {}) => ({
    entryDate: '2026-10-20T10:00:00.000Z',
    description: ' Hall hire ',
    lines: [{ accountId: 1, debitAmount: 5000 }, { accountId: 2, creditAmount: 5000 }],
    ...over,
  });
  beforeEach(() => {
    accounts = [acct(1, 'EXPENSE'), acct(2, 'ASSET')];
    prismaMock.journalEntry.create.mockImplementation(({ data: d }: any) => Promise.resolve({ id: 50, ...d, createdAt: new Date(), lines: [] }));
  });

  it('starts a person\'s entry as a draft with exact totals, and records it', async () => {
    await accountingService.createJournalEntry(7, 3, data() as any);
    const created = prismaMock.journalEntry.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ associationId: 7, status: 'DRAFT', sourceType: 'manual', createdBy: 3, description: 'Hall hire', postedAt: null });
    expect(created.totalDebit.toString()).toBe('5000');
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('JOURNAL_CREATED');
  });

  it('refuses a date inside a closed period', async () => {
    periods = [{ id: 1, name: 'October 2026', status: 'CLOSED', startDate: lagosDayStart('2026-10-01'), endDate: lagosDayEnd('2026-10-31') }];
    expect(await code(accountingService.createJournalEntry(7, 3, data() as any))).toBe('PERIOD_CLOSED');
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });

  it('refuses an entry that does not balance to the kobo', async () => {
    const lines = [{ accountId: 1, debitAmount: 5000 }, { accountId: 2, creditAmount: 4999.99 }];
    expect(await code(accountingService.createJournalEntry(7, 3, data({ lines }) as any))).toBe('UNBALANCED');
  });

  it('refuses an account that is not this association\'s or is switched off', async () => {
    accounts = [acct(1, 'EXPENSE'), acct(2, 'ASSET', { associationId: 9 })];
    expect(await code(accountingService.createJournalEntry(7, 3, data() as any))).toBe('INVALID_ACCOUNT');
    accounts = [acct(1, 'EXPENSE'), acct(2, 'ASSET', { isActive: false })];
    expect(await code(accountingService.createJournalEntry(7, 3, data() as any))).toBe('INVALID_ACCOUNT');
  });

  it('writes an automatic entry already posted, labelled with where it came from, rounding to the kobo first', async () => {
    const lines = [{ accountId: 1, debitAmount: 100.004 }, { accountId: 2, creditAmount: 100.0049 }];
    await accountingService.createJournalEntry(7, 3, data({ lines }) as any, { source: { type: 'Payment', id: 88 }, autoPost: true });
    const created = prismaMock.journalEntry.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ status: 'POSTED', sourceType: 'auto_sync:Payment', sourceId: 88 });
    expect(created.postedAt).toBeInstanceOf(Date);
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('takes the next number when another entry just took this one', async () => {
    const clash = new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });
    prismaMock.journalEntry.create.mockRejectedValueOnce(clash);
    await accountingService.createJournalEntry(7, 3, data() as any);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------- the workflow

describe('the approval workflow', () => {
  const entry = (over: object = {}) => ({
    id: 50, associationId: 7, entryNumber: 'JE-2026-00001', status: 'APPROVED', createdBy: 3, entryDate: new Date('2026-10-20T10:00:00.000Z'),
    totalDebit: 5000, lines: [{ accountId: 1, debitAmount: 5000, creditAmount: 0 }, { accountId: 2, debitAmount: 0, creditAmount: 5000 }], ...over,
  });
  beforeEach(() => {
    accounts = [acct(1, 'EXPENSE'), acct(2, 'ASSET')];
    prismaMock.journalEntry.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('posting', () => {
    it('posts an approved entry once, and records who posted it', async () => {
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry());
      await accountingService.postJournalEntry(7, 50, 9);
      expect(prismaMock.journalEntry.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 50, associationId: 7, status: 'APPROVED' }, data: { status: 'POSTED' } });
      expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'JOURNAL_POSTED', userId: 9, recordId: 50 });
    });

    it('refuses an entry that is not approved, or is already posted', async () => {
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry({ status: 'DRAFT' }));
      expect(await code(accountingService.postJournalEntry(7, 50, 9))).toBe('WRONG_STATUS');
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry({ status: 'POSTED' }));
      expect(await code(accountingService.postJournalEntry(7, 50, 9))).toBe('ALREADY_POSTED');
    });

    it('does not post twice when two people press Post together', async () => {
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry());
      prismaMock.journalEntry.updateMany.mockResolvedValue({ count: 0 });
      expect(await code(accountingService.postJournalEntry(7, 50, 9))).toBe('ALREADY_POSTED');
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('refuses to post into a period that was closed after the entry was written', async () => {
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry());
      periods = [{ id: 1, name: 'October 2026', status: 'LOCKED', startDate: lagosDayStart('2026-10-01'), endDate: lagosDayEnd('2026-10-31') }];
      expect(await code(accountingService.postJournalEntry(7, 50, 9))).toBe('PERIOD_CLOSED');
      expect(prismaMock.journalEntry.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to post when an account has been switched off since', async () => {
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry());
      accounts = [acct(1, 'EXPENSE', { isActive: false }), acct(2, 'ASSET')];
      expect(await code(accountingService.postJournalEntry(7, 50, 9))).toBe('INVALID_ACCOUNT');
    });

    it('refuses to post an entry whose stored lines do not balance', async () => {
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry({ lines: [{ accountId: 1, debitAmount: 5000, creditAmount: 0 }, { accountId: 2, debitAmount: 0, creditAmount: 4000 }] }));
      expect(await code(accountingService.postJournalEntry(7, 50, 9))).toBe('UNBALANCED');
    });
  });

  describe('approving and rejecting', () => {
    beforeEach(() => prismaMock.journalEntry.findFirst.mockResolvedValue(entry({ status: 'PENDING_APPROVAL' })));

    it('never lets the person who wrote an entry decide it', async () => {
      expect(await code(accountingService.processApproval(7, 50, 3, 'approve'))).toBe('OWN_ENTRY');
      expect(await code(accountingService.processApproval(7, 50, 3, 'reject', 'no'))).toBe('OWN_ENTRY');
    });

    it('records an approval once', async () => {
      await accountingService.processApproval(7, 50, 9, 'approve');
      expect(prismaMock.journalEntry.updateMany.mock.calls[0][0]).toMatchObject({ where: { status: 'PENDING_APPROVAL' }, data: { status: 'APPROVED', approvedBy: 9 } });
      expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('JOURNAL_APPROVED');
    });

    it('does not let a second officer decide an entry that was just decided', async () => {
      prismaMock.journalEntry.updateMany.mockResolvedValue({ count: 0 });
      expect(await code(accountingService.processApproval(7, 50, 9, 'approve'))).toBe('ALREADY_DECIDED');
      expect(await code(accountingService.processApproval(7, 50, 9, 'reject', 'wrong'))).toBe('ALREADY_DECIDED');
    });

    it('needs a reason to reject, and keeps it', async () => {
      expect(await code(accountingService.processApproval(7, 50, 9, 'reject', '  '))).toBe('REASON_REQUIRED');
      await accountingService.processApproval(7, 50, 9, 'reject', 'Wrong account');
      expect(prismaMock.journalEntry.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'REJECTED', rejectionReason: 'Wrong account', rejectedBy: 9 });
    });

    it('refuses to decide an entry that is not waiting', async () => {
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry({ status: 'DRAFT' }));
      expect(await code(accountingService.processApproval(7, 50, 9, 'approve'))).toBe('WRONG_STATUS');
    });
  });

  describe('submitting and editing', () => {
    it('checks the entry again when it is sent for approval', async () => {
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry({ status: 'DRAFT' }));
      periods = [{ id: 1, name: 'October 2026', status: 'CLOSED', startDate: lagosDayStart('2026-10-01'), endDate: lagosDayEnd('2026-10-31') }];
      expect(await code(accountingService.submitForApproval(7, 50, 3))).toBe('PERIOD_CLOSED');
    });

    it('only changes a draft or a rejected entry, and a rejected one becomes a draft again', async () => {
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry({ status: 'POSTED' }));
      expect(await code(accountingService.updateJournalEntry(7, 50, { description: 'x' }))).toBe('WRONG_STATUS');

      prismaMock.journalEntry.findFirst.mockResolvedValue(entry({ status: 'REJECTED' }));
      await code(accountingService.updateJournalEntry(7, 50, { description: 'Fixed' }, 3));
      expect(prismaMock.journalEntry.updateMany.mock.calls[0][0]).toMatchObject({
        where: { status: { in: ['DRAFT', 'REJECTED'] } },
        data: { status: 'DRAFT', rejectionReason: null, rejectedBy: null },
      });
    });

    it('replaces the lines in the same step, after checking them', async () => {
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry({ status: 'DRAFT' }));
      await code(accountingService.updateJournalEntry(7, 50, { lines: [{ accountId: 1, debitAmount: 10 }, { accountId: 2, creditAmount: 10 }] }, 3));
      expect(prismaMock.journalEntryLine.deleteMany).toHaveBeenCalledWith({ where: { journalEntryId: 50 } });
      expect(prismaMock.journalEntryLine.createMany).toHaveBeenCalled();

      jest.clearAllMocks();
      prismaMock.accountingPeriod.findMany.mockResolvedValue([]);
      prismaMock.journalEntry.findFirst.mockResolvedValue(entry({ status: 'DRAFT' }));
      expect(await code(accountingService.updateJournalEntry(7, 50, { lines: [{ accountId: 1, debitAmount: 10 }, { accountId: 2, creditAmount: 9 }] }))).toBe('UNBALANCED');
      expect(prismaMock.journalEntryLine.deleteMany).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------- statements

describe('the statements', () => {
  const d = (s: string) => new Date(`${s}T12:00:00.000Z`);
  beforeEach(() => {
    accounts = [
      acct(1, 'ASSET', { subType: 'current_asset', cash: true, name: 'Bank' }),
      acct(2, 'ASSET', { subType: 'current_asset', cash: true, name: 'Cash in hand' }),
      acct(3, 'INCOME'),
      acct(4, 'EXPENSE'),
      acct(5, 'LIABILITY', { subType: 'current_liability' }),
      acct(6, 'LIABILITY', { subType: null }),
      acct(7, 'EQUITY'),
      acct(8, 'ASSET', { subType: 'fixed_asset', name: 'Equipment' }),
    ];
  });

  it('adds up the income statement for the period only, not everything since the books began', async () => {
    postedLines = [
      { accountId: 1, debit: 9000, credit: 0, date: d('2026-08-10'), entryId: 1 },
      { accountId: 3, debit: 0, credit: 9000, date: d('2026-08-10'), entryId: 1 },
      { accountId: 1, debit: 4000, credit: 0, date: d('2026-10-10'), entryId: 2 },
      { accountId: 3, debit: 0, credit: 4000, date: d('2026-10-10'), entryId: 2 },
      { accountId: 4, debit: 1500, credit: 0, date: d('2026-10-12'), entryId: 3 },
      { accountId: 1, debit: 0, credit: 1500, date: d('2026-10-12'), entryId: 3 },
    ];
    const report = await accountingService.generateIncomeStatement(7, { startDate: lagosDayStart('2026-10-01'), endDate: lagosDayEnd('2026-10-31') });
    expect(report.revenue.total.toNumber()).toBe(4000);
    expect(report.expenses.total.toNumber()).toBe(1500);
    expect(report.netIncome.toNumber()).toBe(2500);
    const where = prismaMock.journalEntryLine.groupBy.mock.calls[0][0].where.journalEntry;
    expect(where.status).toBe('POSTED');
    expect(where.entryDate.gte).toEqual(lagosDayStart('2026-10-01'));
    expect(where.entryDate.lte).toEqual(lagosDayEnd('2026-10-31'));
  });

  it('compares with the stretch of the same length just before', async () => {
    postedLines = [
      { accountId: 3, debit: 0, credit: 2000, date: d('2026-09-15'), entryId: 1 },
      { accountId: 3, debit: 0, credit: 3000, date: d('2026-10-15'), entryId: 2 },
    ];
    const report = await accountingService.generateIncomeStatement(7, { startDate: lagosDayStart('2026-10-01'), endDate: lagosDayEnd('2026-10-31') }, true);
    expect(report.comparison?.previousPeriod.revenue.toNumber()).toBe(2000);
    expect(report.comparison?.changes.revenue.amount.toNumber()).toBe(1000);
    expect(report.comparison?.changes.revenue.percentage).toBe(50);
  });

  it('counts every liability, including the ones that are neither current nor long term, so the sheet adds up', async () => {
    postedLines = [
      { accountId: 1, debit: 10000, credit: 0, date: d('2026-10-01'), entryId: 1 },
      { accountId: 6, debit: 0, credit: 4000, date: d('2026-10-01'), entryId: 1 },
      { accountId: 5, debit: 0, credit: 3000, date: d('2026-10-01'), entryId: 1 },
      { accountId: 7, debit: 0, credit: 3000, date: d('2026-10-01'), entryId: 1 },
    ];
    const sheet = await accountingService.generateBalanceSheet(7, new Date('2026-10-31T12:00:00.000Z'));
    expect(sheet.liabilities.totalCurrent.toNumber()).toBe(3000);
    expect(sheet.liabilities.totalOther.toNumber()).toBe(4000);
    expect(sheet.liabilities.total.toNumber()).toBe(7000);
    expect(sheet.assets.total.toNumber()).toBe(10000);
    expect(sheet.isBalanced).toBe(true);
  });

  it('includes earnings so far in equity, and shows an account that has been switched off but still holds money', async () => {
    accounts[1] = acct(2, 'ASSET', { subType: 'current_asset', cash: true, isActive: false });
    postedLines = [
      { accountId: 2, debit: 500, credit: 0, date: d('2026-10-01'), entryId: 1 },
      { accountId: 3, debit: 0, credit: 500, date: d('2026-10-01'), entryId: 1 },
    ];
    const sheet = await accountingService.generateBalanceSheet(7, new Date('2026-10-31T12:00:00.000Z'));
    expect(sheet.assets.total.toNumber()).toBe(500);
    expect(sheet.equity.retainedEarnings.toNumber()).toBe(500);
    expect(sheet.isBalanced).toBe(true);
  });

  it('opens the cash flow with what stood before the period, skips moves between cash accounts, and reconciles', async () => {
    const line = (id: number, accountId: number, debit: number, credit: number, date: string, entryId: number) => ({ id, accountId, debitAmount: debit, creditAmount: credit, date: d(date), entryId });
    const entries: Record<number, any[]> = {
      10: [line(1, 1, 3000, 0, '2026-10-05', 10), line(2, 3, 0, 3000, '2026-10-05', 10)],
      11: [line(3, 1, 0, 800, '2026-10-06', 11), line(4, 4, 800, 0, '2026-10-06', 11)],
      12: [line(5, 2, 500, 0, '2026-10-07', 12), line(6, 1, 0, 500, '2026-10-07', 12)],
    };
    postedLines = [
      { accountId: 1, debit: 1000, credit: 0, date: d('2026-09-20'), entryId: 9 },
      ...Object.values(entries).flat().map((l) => ({ accountId: l.accountId, debit: l.debitAmount, credit: l.creditAmount, date: l.date, entryId: l.entryId })),
    ];
    // Real Decimals are needed for the arithmetic, so give the mock lines proper ones
    const { Decimal } = jest.requireActual('@prisma/client/runtime/library');
    prismaMock.journalEntryLine.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(
        Object.values(entries)
          .flat()
          .filter((l) => where.accountId.in.includes(l.accountId) && inRange(l.date, where.journalEntry.entryDate))
          .map((l) => ({
            ...l,
            debitAmount: new Decimal(l.debitAmount),
            creditAmount: new Decimal(l.creditAmount),
            journalEntry: { description: `Entry ${l.entryId}`, lines: entries[l.entryId]!.map((o) => ({ ...o, account: accounts.find((a) => a.id === o.accountId) })) },
          })),
      ),
    );

    const report = await accountingService.generateCashFlowStatement(7, { startDate: lagosDayStart('2026-10-01'), endDate: lagosDayEnd('2026-10-31') });
    expect(report.beginningCash.toNumber()).toBe(1000);
    expect(report.operating.inflows).toHaveLength(1); // the 3,000 received
    expect(report.operating.outflows).toHaveLength(1); // the 800 spent
    expect(report.netCashChange.toNumber()).toBe(2200); // the 500 moved between cash accounts is neither
    expect(report.endingCash.toNumber()).toBe(3200); // 1,000 + 3,000 - 800, and the move nets to nothing
    expect(report.reconciles).toBe(true);
  });
});

// ---------------------------------------------------------------- chart of accounts

describe('the chart of accounts', () => {
  beforeEach(() => {
    prismaMock.chartOfAccount.findUnique.mockResolvedValue(null);
    prismaMock.chartOfAccount.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 99, isActive: true, isSystemAccount: false, ...data }));
  });

  it('gives a new account the normal balance of its type unless one is given', async () => {
    await accountingService.createAccount(7, { code: '4950', name: 'Hall hire income', type: 'INCOME' });
    expect(prismaMock.chartOfAccount.create.mock.calls[0][0].data.normalBalance).toBe('CREDIT');
    await accountingService.createAccount(7, { code: '1240', name: 'Accumulated depreciation', type: 'ASSET', normalBalance: 'CREDIT' });
    expect(prismaMock.chartOfAccount.create.mock.calls[1][0].data.normalBalance).toBe('CREDIT');
  });

  it('refuses a repeated code, and a parent of another type', async () => {
    prismaMock.chartOfAccount.findUnique.mockResolvedValue({ id: 1 });
    expect(await code(accountingService.createAccount(7, { code: '4110', name: 'x', type: 'INCOME' }))).toBe('CODE_EXISTS');
    prismaMock.chartOfAccount.findUnique.mockResolvedValue(null);
    prismaMock.chartOfAccount.findFirst.mockResolvedValue({ id: 5, type: 'EXPENSE' });
    expect(await code(accountingService.createAccount(7, { code: '4955', name: 'x', type: 'INCOME', parentId: 5 }))).toBe('PARENT_TYPE');
  });

  it('keeps a built-in account switched on', async () => {
    prismaMock.chartOfAccount.findFirst.mockResolvedValue({ id: 1, associationId: 7, isSystemAccount: true, type: 'ASSET', name: 'Bank' });
    expect(await code(accountingService.updateAccount(7, 1, { isActive: false }))).toBe('SYSTEM_ACCOUNT');
  });

  it('will not put an account under itself or under one of its own sub-accounts', async () => {
    prismaMock.chartOfAccount.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.id === 1 ? { id: 1, type: 'ASSET', isSystemAccount: false, parentId: null, name: 'A' } : { id: where.id, type: 'ASSET', parentId: 1 }),
    );
    expect(await code(accountingService.updateAccount(7, 1, { parentId: 1 }))).toBe('PARENT_CYCLE');
    expect(await code(accountingService.updateAccount(7, 1, { parentId: 2 }))).toBe('PARENT_CYCLE');
  });

  it('refuses to delete an account that has sub-accounts or a budget line', async () => {
    prismaMock.chartOfAccount.findFirst.mockResolvedValue({ id: 4, associationId: 7, isSystemAccount: false, code: '5999', name: 'x' });
    prismaMock.chartOfAccount.count.mockResolvedValue(2);
    expect(await code(accountingService.deleteAccount(7, 4))).toBe('HAS_CHILDREN');
    prismaMock.chartOfAccount.count.mockResolvedValue(0);
    prismaMock.budgetItem.count.mockResolvedValue(1);
    expect(await code(accountingService.deleteAccount(7, 4))).toBe('IN_BUDGET');
  });

  it('switches off a used account and removes an unused one', async () => {
    prismaMock.chartOfAccount.findFirst.mockResolvedValue({ id: 4, associationId: 7, isSystemAccount: false, code: '5999', name: 'x' });
    prismaMock.chartOfAccount.count.mockResolvedValue(0);
    prismaMock.budgetItem.count.mockResolvedValue(0);
    prismaMock.journalEntryLine.count.mockResolvedValue(3);
    expect(await accountingService.deleteAccount(7, 4)).toEqual({ removed: false });
    expect(prismaMock.chartOfAccount.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { isActive: false } });
    prismaMock.journalEntryLine.count.mockResolvedValue(0);
    expect(await accountingService.deleteAccount(7, 4)).toEqual({ removed: true });
    expect(prismaMock.chartOfAccount.delete).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- budgets

describe('budgets', () => {
  const input = (items: object[]) => ({ name: 'Budget 2026', fiscalYear: 2026, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', items }) as any;
  beforeEach(() => {
    accounts = [acct(3, 'INCOME'), acct(4, 'EXPENSE'), acct(1, 'ASSET')];
    prismaMock.budget.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 5, ...data, items: [] }));
  });

  it('covers income and expense accounts only, each once, in whole kobo', async () => {
    expect(await code(accountingService.createBudget(7, 3, input([{ accountId: 1, annualAmount: 100 }])))).toBe('INVALID_ACCOUNT');
    expect(await code(accountingService.createBudget(7, 3, input([{ accountId: 4, annualAmount: 100 }, { accountId: 4, annualAmount: 50 }])))).toBe('DUPLICATE_ACCOUNT');
    expect(await code(accountingService.createBudget(7, 3, input([{ accountId: 4, annualAmount: 100.005 }])))).toBe('INVALID_AMOUNT');
    expect(await code(accountingService.createBudget(7, 3, input([{ accountId: 4, annualAmount: 0 }])))).toBe('INVALID_AMOUNT');
  });

  it('works out the monthly amount to the kobo and totals the year', async () => {
    await accountingService.createBudget(7, 3, input([{ accountId: 4, annualAmount: 1000 }, { accountId: 3, annualAmount: 5000 }]));
    const data = prismaMock.budget.create.mock.calls[0][0].data;
    expect(data.totalBudget.toString()).toBe('6000');
    expect(data.items.create[0].monthlyAmount.toString()).toBe('83.33');
  });

  it('refuses dates that run backwards', async () => {
    expect(await code(accountingService.createBudget(7, 3, { ...input([{ accountId: 4, annualAmount: 10 }]), startDate: '2026-12-31T00:00:00.000Z', endDate: '2026-01-01T00:00:00.000Z' }))).toBe('INVALID_DATE');
  });

  it('is approved by someone other than its author, once', async () => {
    prismaMock.budget.findFirst.mockResolvedValue({ id: 5, associationId: 7, status: 'DRAFT', createdBy: 3, name: 'B' });
    expect(await code(accountingService.approveBudget(7, 5, 3))).toBe('OWN_BUDGET');
    prismaMock.budget.updateMany.mockResolvedValue({ count: 0 });
    expect(await code(accountingService.approveBudget(7, 5, 9))).toBe('ALREADY_DECIDED');
  });

  it('closes the year\'s other active budget in the same step it activates one', async () => {
    prismaMock.budget.findFirst.mockResolvedValue({ id: 5, associationId: 7, status: 'APPROVED', fiscalYear: 2026, name: 'B', items: [] });
    prismaMock.budget.updateMany.mockResolvedValue({ count: 1 });
    await code(accountingService.activateBudget(7, 5, 9));
    expect(prismaMock.budget.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ status: 'APPROVED' }), data: { status: 'ACTIVE' } }));
    expect(prismaMock.budget.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { status: 'CLOSED' } }));
  });

  it('measures actual inside the budget\'s dates and keeps income apart from spending', async () => {
    postedLines = [
      { accountId: 4, debit: 90000, credit: 0, date: new Date('2025-06-01T12:00:00.000Z'), entryId: 1 }, // last year: not counted
      { accountId: 4, debit: 300, credit: 0, date: new Date('2026-03-01T12:00:00.000Z'), entryId: 2 },
      { accountId: 3, debit: 0, credit: 2000, date: new Date('2026-03-01T12:00:00.000Z'), entryId: 3 },
    ];
    prismaMock.budget.findFirst.mockResolvedValue({
      id: 5, associationId: 7, name: 'B', fiscalYear: 2026, status: 'ACTIVE',
      startDate: lagosDayStart('2026-01-01'), endDate: lagosDayEnd('2026-12-31'), totalBudget: 0, description: null,
      items: [
        { id: 1, accountId: 4, annualAmount: 1000, account: { code: '1004', name: 'Hall' }, monthlyAmount: 0, q1Amount: null, q2Amount: null, q3Amount: null, q4Amount: null, notes: null },
        { id: 2, accountId: 3, annualAmount: 10000, account: { code: '1003', name: 'Dues' }, monthlyAmount: 0, q1Amount: null, q2Amount: null, q3Amount: null, q4Amount: null, notes: null },
      ],
    });
    const report = await accountingService.getBudgetVariance(7, 5);
    const hall = report.items.find((i) => i.accountId === 4)!;
    expect(hall.actualAmount.toNumber()).toBe(300);
    expect(hall.variance.toNumber()).toBe(700);
    expect(hall.status).toBe('under');
    expect(report.expenseSummary.totalBudget.toNumber()).toBe(1000);
    expect(report.expenseSummary.totalActual.toNumber()).toBe(300);
    expect(report.incomeSummary.totalBudget.toNumber()).toBe(10000);
    expect(report.incomeSummary.totalActual.toNumber()).toBe(2000);
  });
});

// ---------------------------------------------------------------- periods

describe('accounting periods', () => {
  const period = (over: object = {}) => ({ id: 3, associationId: 7, name: 'October 2026', status: 'OPEN', startDate: lagosDayStart('2026-10-01'), endDate: lagosDayEnd('2026-10-31'), ...over });
  beforeEach(() => {
    prismaMock.accountingPeriod.findFirst.mockResolvedValue(period());
    prismaMock.accountingPeriod.findUniqueOrThrow.mockResolvedValue(period({ status: 'CLOSED' }));
    prismaMock.accountingPeriod.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.journalEntry.count.mockResolvedValue(0);
  });

  it('makes a period cover its whole first and last day in Lagos time, and refuses one that shares a day with another', async () => {
    prismaMock.accountingPeriod.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 4, ...data }));
    await accountingPeriodsService.createPeriod(7, { name: ' November ', periodType: 'month', startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-30T00:00:00.000Z' }, 3);
    const created = prismaMock.accountingPeriod.create.mock.calls[0][0].data;
    expect(created.startDate).toEqual(lagosDayStart('2026-11-01'));
    expect(created.endDate).toEqual(lagosDayEnd('2026-11-30'));
    expect(created.name).toBe('November');

    periods = [period()];
    expect(await code(accountingPeriodsService.createPeriod(7, { name: 'x', periodType: 'month', startDate: '2026-10-31T00:00:00.000Z', endDate: '2026-11-15T00:00:00.000Z' }))).toBe('PERIOD_OVERLAP');
  });

  it('will not close a period while entries in it are still waiting', async () => {
    prismaMock.journalEntry.count.mockResolvedValue(2);
    expect(await code(accountingPeriodsService.closePeriod(7, 3, 9))).toBe('ENTRIES_WAITING');
    expect(prismaMock.accountingPeriod.updateMany).not.toHaveBeenCalled();
  });

  it('closes once, records who, and refuses a period that is not open', async () => {
    await accountingPeriodsService.closePeriod(7, 3, 9);
    expect(prismaMock.accountingPeriod.updateMany.mock.calls[0][0]).toMatchObject({ where: { status: 'OPEN' }, data: { status: 'CLOSED', closedBy: 9 } });
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('PERIOD_CLOSED');
    prismaMock.accountingPeriod.findFirst.mockResolvedValue(period({ status: 'CLOSED' }));
    expect(await code(accountingPeriodsService.closePeriod(7, 3, 9))).toBe('WRONG_STATUS');
  });

  it('never reopens a locked period, and records a reopening', async () => {
    prismaMock.accountingPeriod.findFirst.mockResolvedValue(period({ status: 'LOCKED' }));
    expect(await code(accountingPeriodsService.reopenPeriod(7, 3, 9))).toBe('PERIOD_LOCKED');
    prismaMock.accountingPeriod.findFirst.mockResolvedValue(period({ status: 'CLOSED' }));
    await accountingPeriodsService.reopenPeriod(7, 3, 9);
    expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'PERIOD_REOPENED', userId: 9 });
  });

  it('locks only a closed period, once', async () => {
    expect(await code(accountingPeriodsService.lockPeriod(7, 3, 9))).toBe('WRONG_STATUS');
    prismaMock.accountingPeriod.findFirst.mockResolvedValue(period({ status: 'CLOSED' }));
    prismaMock.accountingPeriod.updateMany.mockResolvedValue({ count: 0 });
    expect(await code(accountingPeriodsService.lockPeriod(7, 3, 9))).toBe('WRONG_STATUS');
  });
});
