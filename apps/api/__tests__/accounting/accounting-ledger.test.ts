/**
 * Opening an account: the ledger lists every posted line with a running balance, and opening + movement = closing — the same figure
 * the statement showed. The database is replaced by a small in-memory stand-in so the rules themselves are what is tested.
 */
import { Decimal } from '@prisma/client/runtime/library';

type Account = { id: number; associationId: number; code: string; name: string; type: string; normalBalance: string; parentId: number | null; isActive: boolean };
type Line = { id: number; entryId: number; accountId: number; debit: number; credit: number; date: Date; entryNumber: string; description: string; lineDescription?: string | null };

let accounts: Account[] = [];
let lines: Line[] = [];

const m = (...names: string[]) => Object.fromEntries(names.map((n) => [n, jest.fn()]));
const prismaMock: any = {
  chartOfAccount: m('findMany'),
  journalEntryLine: m('findMany', 'groupBy'),
  journalEntry: m('findFirst'),
  transaction: m('findFirst'),
  payment: m('findFirst'),
  welfareContribution: m('findFirst'),
  welfarePayoutRequest: m('findFirst'),
  savingsTransaction: m('findFirst'),
  loan: m('findFirst'),
  loanRepayment: m('findFirst'),
  cashLodgment: m('findFirst'),
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }));

import { accountingLedgerService } from '../../src/modules/accounting/accounting-ledger.service';
import { ledgerTotals, parseAccountIds, parseLedgerDate, withRunningBalance } from '../../src/modules/accounting/accounting-ledger';
import { AccountingRuleError } from '../../src/modules/accounting/accounting-rules';
import { resolveEntrySource, sourceTable } from '../../src/modules/accounting/accounting-source';

const acct = (id: number, type: string, over: Partial<Account> = {}): Account => ({
  id, associationId: 7, code: String(1000 + id), name: `Account ${id}`, type, parentId: null, isActive: true,
  normalBalance: type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT', ...over,
});
const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

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
  lines = [];
  prismaMock.chartOfAccount.findMany.mockImplementation(({ where }: any) => {
    let rows = accounts.filter((a) => a.associationId === where.associationId);
    if (where.id?.in) rows = rows.filter((a) => where.id.in.includes(a.id));
    if (where.type) rows = rows.filter((a) => a.type === where.type);
    if (where.parentId !== undefined) rows = rows.filter((a) => a.parentId === where.parentId);
    return Promise.resolve(rows);
  });
  prismaMock.journalEntryLine.groupBy.mockImplementation(({ where }: any) => {
    const f = where.journalEntry.entryDate;
    const rows = lines.filter((l) => where.accountId.in.includes(l.accountId) && inRange(l.date, f));
    const by = new Map<number, { d: number; c: number }>();
    rows.forEach((l) => by.set(l.accountId, { d: (by.get(l.accountId)?.d ?? 0) + l.debit, c: (by.get(l.accountId)?.c ?? 0) + l.credit }));
    return Promise.resolve([...by].map(([accountId, s]) => ({ accountId, _sum: { debitAmount: s.d, creditAmount: s.c } })));
  });
  prismaMock.journalEntryLine.findMany.mockImplementation((args: any) => {
    // The lines of the ledger (lean), the lines a search matches, or the details of one page
    if (args.where.id?.in) {
      return Promise.resolve(
        args.where.id.in.map((id: number) => {
          const l = lines.find((x) => x.id === id)!;
          const a = accounts.find((x) => x.id === l.accountId)!;
          return {
            id: l.id, description: l.lineDescription ?? null, account: { code: a.code, name: a.name },
            journalEntry: { entryNumber: l.entryNumber, entryDate: l.date, description: l.description, reference: null, sourceType: null, sourceId: null },
          };
        }),
      );
    }
    if (args.where.AND) {
      const text = args.where.AND[1].OR[1].journalEntry.OR[1].description.contains.toLowerCase();
      return Promise.resolve(lines.filter((l) => l.description.toLowerCase().includes(text)).map((l) => ({ id: l.id })));
    }
    const f = args.where.journalEntry.entryDate;
    return Promise.resolve(
      lines
        .filter((l) => args.where.accountId.in.includes(l.accountId) && inRange(l.date, f))
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.entryId - b.entryId || a.id - b.id)
        .map((l) => ({ id: l.id, journalEntryId: l.entryId, accountId: l.accountId, debitAmount: l.debit, creditAmount: l.credit })),
    );
  });
});

describe('running balance', () => {
  const input = (lineId: number, debit: number, credit: number, normal: 'DEBIT' | 'CREDIT') => ({
    lineId, entryId: lineId, accountId: 1, debit: new Decimal(debit), credit: new Decimal(credit), normal,
  });

  it('grows with debits for an asset and with credits for income, from the opening balance', () => {
    const asset = withRunningBalance(100, [input(1, 50, 0, 'DEBIT'), input(2, 0, 30, 'DEBIT')]);
    expect(asset.map((l) => l.balance.toString())).toEqual(['150', '120']);
    const income = withRunningBalance(0, [input(1, 0, 50, 'CREDIT'), input(2, 10, 0, 'CREDIT')]);
    expect(income.map((l) => l.balance.toString())).toEqual(['50', '40']);
  });

  it('closes at opening plus the net movement, to the kobo', () => {
    const rows = withRunningBalance('10.10', [input(1, 0.2, 0, 'DEBIT'), input(2, 0.1, 0, 'DEBIT')]);
    const totals = ledgerTotals('10.10', rows);
    expect(totals.net.toString()).toBe('0.3');
    expect(totals.closing.toString()).toBe('10.4');
    expect(rows[rows.length - 1].balance.equals(totals.closing)).toBe(true);
  });
});

describe('what a ledger is asked for', () => {
  it('reads one id or a list, and refuses nonsense', () => {
    expect(parseAccountIds('5', undefined)).toEqual([5]);
    expect(parseAccountIds(undefined, '3, 4,3')).toEqual([3, 4]);
    expect(() => parseAccountIds(undefined, undefined)).toThrow(AccountingRuleError);
    expect(() => parseAccountIds('abc', undefined)).toThrow(AccountingRuleError);
    expect(() => parseAccountIds(undefined, '1,-2')).toThrow(AccountingRuleError);
  });

  it('cuts a plain day in Lagos time and keeps a full moment as it is', () => {
    expect(parseLedgerDate('2026-10-01', 'From', false)?.toISOString()).toBe('2026-09-30T23:00:00.000Z');
    expect(parseLedgerDate('2026-10-31', 'To', true)?.toISOString()).toBe('2026-10-31T22:59:59.999Z');
    expect(parseLedgerDate('2026-10-05T10:00:00.000Z', 'From', false)?.toISOString()).toBe('2026-10-05T10:00:00.000Z');
    expect(parseLedgerDate('', 'From', false)).toBeUndefined();
    expect(() => parseLedgerDate('not a date', 'From', false)).toThrow(AccountingRuleError);
  });
});

describe('the ledger of an account', () => {
  beforeEach(() => {
    accounts = [acct(1, 'ASSET'), acct(2, 'INCOME'), acct(3, 'INCOME', { parentId: 2 }), acct(9, 'ASSET', { associationId: 99 })];
    lines = [
      { id: 1, entryId: 10, accountId: 1, debit: 500, credit: 0, date: day('2026-09-10'), entryNumber: 'JE-1', description: 'Dues Ada' },
      { id: 2, entryId: 10, accountId: 2, debit: 0, credit: 500, date: day('2026-09-10'), entryNumber: 'JE-1', description: 'Dues Ada' },
      { id: 3, entryId: 11, accountId: 1, debit: 300, credit: 0, date: day('2026-10-05'), entryNumber: 'JE-2', description: 'Dues Bola' },
      { id: 4, entryId: 11, accountId: 3, debit: 0, credit: 300, date: day('2026-10-05'), entryNumber: 'JE-2', description: 'Dues Bola' },
      { id: 5, entryId: 12, accountId: 1, debit: 0, credit: 200, date: day('2026-10-20'), entryNumber: 'JE-3', description: 'Bank charges' },
    ];
  });

  it('lists every line with a running balance, closing at the account balance', async () => {
    const ledger = await accountingLedgerService.getLedger(7, { accountIds: [1] });
    expect(ledger.lines.map((l) => l.entryNumber)).toEqual(['JE-1', 'JE-2', 'JE-3']);
    expect(ledger.lines.map((l) => l.balance.toString())).toEqual(['500', '800', '600']);
    expect(ledger.opening.toString()).toBe('0');
    expect(ledger.closing.toString()).toBe('600');
    expect(ledger.totalDebit.toString()).toBe('800');
    expect(ledger.totalCredit.toString()).toBe('200');
  });

  it('opens at what stood before the start, so opening + movement = closing for the dates', async () => {
    const ledger = await accountingLedgerService.getLedger(7, { accountIds: [1], from: new Date('2026-10-01T00:00:00.000Z'), to: new Date('2026-10-31T23:59:59.999Z') });
    expect(ledger.opening.toString()).toBe('500');
    expect(ledger.movement.toString()).toBe('100');
    expect(ledger.closing.toString()).toBe('600');
    expect(ledger.lines[0].balance.toString()).toBe('800');
  });

  it('adds several accounts of a section together, each counted in its own direction', async () => {
    const ledger = await accountingLedgerService.getLedger(7, { accountIds: [2, 3] });
    expect(ledger.closing.toString()).toBe('800'); // total income: 500 + 300
    expect(ledger.lines).toHaveLength(2);
  });

  it('lists sub-accounts with what they moved', async () => {
    const ledger = await accountingLedgerService.getLedger(7, { accountIds: [2] });
    expect(ledger.subAccounts).toEqual([expect.objectContaining({ id: 3, balance: expect.any(Decimal) })]);
    expect(ledger.subAccounts[0].balance.toString()).toBe('300');
  });

  it('narrows the lines by a search but keeps the balances of the whole ledger', async () => {
    const ledger = await accountingLedgerService.getLedger(7, { accountIds: [1], search: 'bank' });
    expect(ledger.lines).toHaveLength(1);
    expect(ledger.lines[0].balance.toString()).toBe('600');
    expect(ledger.closing.toString()).toBe('600');
    expect(ledger.pagination.totalCount).toBe(1);
  });

  it('pages through the lines', async () => {
    const ledger = await accountingLedgerService.getLedger(7, { accountIds: [1], page: 2, limit: 2 });
    expect(ledger.lines.map((l) => l.entryNumber)).toEqual(['JE-3']);
    expect(ledger.pagination).toMatchObject({ totalCount: 3, totalPages: 2, hasMore: false });
  });

  it('counts only posted entries of this association', async () => {
    await accountingLedgerService.getLedger(7, { accountIds: [1] });
    const where = prismaMock.journalEntryLine.findMany.mock.calls[0][0].where;
    expect(where.journalEntry).toMatchObject({ associationId: 7, status: 'POSTED' });
  });

  it('opens a whole section by its type, and refuses anything else', async () => {
    expect(await accountingLedgerService.accountsInScope(7, 'INCOME')).toEqual([2, 3]);
    expect(await code(accountingLedgerService.accountsInScope(7, 'banana'))).toBe('INVALID_SCOPE');
  });

  it('does not open an account that belongs to another association', async () => {
    expect(await code(accountingLedgerService.getLedger(7, { accountIds: [9] }))).toBe('ACCOUNT_NOT_FOUND');
    expect(await code(accountingLedgerService.getLedger(7, { accountIds: [1, 404] }))).toBe('ACCOUNT_NOT_FOUND');
  });
});

describe('where an entry came from', () => {
  it('reads the source from the kind recorded on the entry', () => {
    expect(sourceTable('auto_sync:Payment')).toBe('Payment');
    expect(sourceTable('manual')).toBeNull();
    expect(sourceTable('auto_sync:Something')).toBeNull();
    expect(sourceTable(null)).toBeNull();
  });

  it('has no source for an entry typed in by an officer', async () => {
    expect(await resolveEntrySource(7, 'manual', null)).toBeNull();
    expect(await resolveEntrySource(7, 'auto_sync:Payment', null)).toBeNull();
  });

  it('describes a charge in plain facts, looked up in this association only', async () => {
    prismaMock.transaction.findFirst.mockResolvedValue({
      id: 41, memberId: 5, amount: new Decimal('15000'), paymentDate: day('2026-10-02'), dueDate: null, createdAt: day('2026-09-01'), status: 'PAID', isVoided: false,
      referenceNumber: 'REF1', member: { id: 5, firstName: 'Ada', lastName: 'Obi' }, category: { name: 'Annual dues' },
    });
    const source = await resolveEntrySource(7, 'auto_sync:Transaction', 41);
    expect(prismaMock.transaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 41, associationId: 7 } }));
    expect(source).toMatchObject({ kind: 'charge', summary: 'Annual dues for Ada Obi', member: 'Ada Obi', status: 'Paid', reference: 'REF1', missing: false, ids: { transactionId: 41, memberId: 5 } });
  });

  it('names the charge a payment paid, so a screen can open it', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: 8, transactionId: 41, amountPaid: new Decimal('5000'), paymentDate: day('2026-10-02'), confirmedAt: day('2026-10-02'), receiptNumber: 'RCP-1',
      transaction: { memberId: 5, member: { id: 5, firstName: 'Ada', lastName: 'Obi' }, category: { name: 'Annual dues' } },
    });
    const source = await resolveEntrySource(7, 'auto_sync:Payment', 8);
    expect(source).toMatchObject({ kind: 'payment', status: 'Confirmed', reference: 'RCP-1', ids: { transactionId: 41, memberId: 5 } });
  });

  it('says so when the record is gone, and still answers', async () => {
    prismaMock.loan.findFirst.mockResolvedValue(null);
    const source = await resolveEntrySource(7, 'auto_sync:Loan', 3);
    expect(source).toMatchObject({ kind: 'loan', missing: true, summary: 'This loan can no longer be found.' });
  });

  it('points a reversal at the entry it reversed', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue({ id: 10, entryNumber: 'JE-1', description: 'Cash receipt', entryDate: day('2026-09-10') });
    const source = await resolveEntrySource(7, 'auto_sync:CashReversal', 10);
    expect(source).toMatchObject({ kind: 'reversal', reference: 'JE-1', ids: { entryId: 10 } });
  });
});
