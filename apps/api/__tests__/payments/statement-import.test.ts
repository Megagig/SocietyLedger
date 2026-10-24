/**
 * Importing a statement. These guard the bugs this replaced: a web import that always failed, the same file imported twice
 * duplicating every line, and a bank account from another association being importable into.
 */
const tx: any = {
  bankStatementImport: { create: jest.fn(), update: jest.fn() },
  bankStatementEntry: { createMany: jest.fn(), count: jest.fn() },
  associationBankAccount: { update: jest.fn() },
};
const mockPrisma: any = {
  associationBankAccount: { findFirst: jest.fn() },
  bankStatementEntry: { findMany: jest.fn() },
  $transaction: jest.fn(async (fn: any) => fn(tx)),
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, prisma: mockPrisma, default: mockPrisma }));

import { importStatement, parseMappingInput, previewStatement } from '../../src/modules/nigerian-payments/statement-import';

const csv = (rows: string[]) => Buffer.from(['Txn Date,Narration,Ref No,Withdrawal,Deposit,Balance', ...rows].join('\n'));
const FILE = csv(['01/10/2026,TRF ADA OBI,S1,,"5,000.00","105,000.00"', '02/10/2026,POS,S2,"500.00",,"104,500.00"']);
const input = { bankAccountId: 4, filename: 'stmt.csv', buffer: FILE };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.associationBankAccount.findFirst.mockResolvedValue({ id: 4, bankName: 'GTB', accountNumber: '0123456789', statementMapping: null });
  mockPrisma.bankStatementEntry.findMany.mockResolvedValue([]);
  tx.bankStatementImport.create.mockResolvedValue({ id: 10 });
  tx.bankStatementEntry.createMany.mockImplementation(async ({ data }: any) => ({ count: data.length }));
  tx.bankStatementEntry.count.mockResolvedValue(1);
  tx.bankStatementImport.update.mockImplementation(async ({ data }: any) => ({ id: 10, ...data }));
});

describe('the preview', () => {
  it("shows how the columns were read, what is new and what money is coming in, and saves nothing", async () => {
    const pv = await previewStatement(1, input);
    expect(pv.layout.source).toBe('detected');
    expect(pv.counts).toMatchObject({ lines: 2, credits: 1, debits: 1, newLines: 2, alreadyImported: 0, newCreditTotal: '5000.00' });
    expect(pv.canImport).toBe(true);
    expect(pv.sample[0]).toMatchObject({ description: 'TRF ADA OBI', creditAmount: '5000.00' });
    expect(tx.bankStatementImport.create).not.toHaveBeenCalled();
  });

  it('counts the lines already imported before, and says there is nothing to import when all are', async () => {
    mockPrisma.bankStatementEntry.findMany.mockImplementation(async ({ where }: any) => where.fingerprint.in.map((f: string) => ({ fingerprint: f })));
    const pv = await previewStatement(1, input);
    expect(pv.counts).toMatchObject({ alreadyImported: 2, newLines: 0 });
    expect(pv.canImport).toBe(false);
  });

  it("uses the mapping remembered for the account, so the next statement from the same bank needs no correction", async () => {
    mockPrisma.associationBankAccount.findFirst.mockResolvedValue({ id: 4, bankName: 'GTB', accountNumber: '1', statementMapping: { date: 'Txn Date', description: 'Narration', debit: 'Withdrawal', credit: 'Deposit' } });
    expect((await previewStatement(1, input)).layout.source).toBe('saved');
  });

  it("only looks at the caller's own association's bank accounts", async () => {
    mockPrisma.associationBankAccount.findFirst.mockResolvedValue(null);
    await expect(previewStatement(1, input)).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    expect(mockPrisma.associationBankAccount.findFirst.mock.calls[0][0].where).toEqual({ id: 4, associationId: 1 });
  });

  it('explains an incomplete mapping instead of importing', async () => {
    const pv = await previewStatement(1, { ...input, manualMapping: { date: 0 }, headerRow: 0 });
    expect(pv.problems.length).toBeGreaterThan(0);
    expect(pv.canImport).toBe(false);
  });
});

describe('the import', () => {
  it('saves each new line with its identity and the bank account, in one transaction, and remembers the column mapping', async () => {
    const result = await importStatement(1, 7, input);
    const rows = tx.bankStatementEntry.createMany.mock.calls[0][0];
    expect(rows.data).toHaveLength(2);
    expect(rows.data[0]).toMatchObject({ importId: 10, bankAccountId: 4, matchStatus: 'UNMATCHED' });
    expect(rows.data[0].fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(rows.skipDuplicates).toBe(true);
    expect(tx.associationBankAccount.update.mock.calls[0][0].data.statementMapping).toMatchObject({ date: 'Txn Date', credit: 'Deposit' });
    expect(result.entriesCreated).toBe(2);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('a file whose lines were all imported before adds nothing and says so', async () => {
    mockPrisma.bankStatementEntry.findMany.mockImplementation(async ({ where }: any) => where.fingerprint.in.map((f: string) => ({ fingerprint: f })));
    await expect(importStatement(1, 7, input)).rejects.toMatchObject({ code: 'NOTHING_NEW' });
    expect(tx.bankStatementImport.create).not.toHaveBeenCalled();
  });

  it('an overlapping statement adds only the lines that are new', async () => {
    const first = await previewStatement(1, input);
    expect(first.counts.newLines).toBe(2);
    mockPrisma.bankStatementEntry.findMany.mockImplementation(async ({ where }: any) => [{ fingerprint: where.fingerprint.in[0] }]);
    await importStatement(1, 7, input);
    expect(tx.bankStatementEntry.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it('reports the lines the database refused as already imported (two imports at once)', async () => {
    tx.bankStatementEntry.createMany.mockResolvedValue({ count: 1 });
    const result = await importStatement(1, 7, input);
    expect(result.alreadyImported).toBe(1);
  });
});

describe('column choices sent by a client', () => {
  it('keeps known columns that are whole numbers and refuses anything else', () => {
    expect(parseMappingInput('{"date":0,"credit":3,"junk":9}')).toEqual({ date: 0, credit: 3 });
    expect(parseMappingInput(undefined)).toBeNull();
    expect(parseMappingInput('')).toBeNull();
    expect(() => parseMappingInput('{"date":"A"}')).toThrow(expect.objectContaining({ code: 'BAD_MAPPING' }));
    expect(() => parseMappingInput('{"date":-1}')).toThrow(expect.objectContaining({ code: 'BAD_MAPPING' }));
    expect(() => parseMappingInput('not json')).toThrow(expect.objectContaining({ code: 'BAD_MAPPING' }));
    expect(() => parseMappingInput('[1,2]')).toThrow(expect.objectContaining({ code: 'BAD_MAPPING' }));
  });
});
