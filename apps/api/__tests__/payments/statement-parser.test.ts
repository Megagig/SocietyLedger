/**
 * Reading a bank statement of any layout. Banks differ in column names, in separate debit and credit columns versus one signed amount,
 * in date style, and in how many lines of account details sit above the table.
 */
import { Decimal } from '@prisma/client/runtime/library';
import {
  applySavedMapping,
  detectMapping,
  findHeaderRow,
  fingerprints,
  parseAmount,
  parseDate,
  readStatement,
  toSavedMapping,
  type Grid,
} from '../../src/modules/nigerian-payments/statement-parser';

const iso = (d: Date | null) => (d ? new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10) : null);

describe('dates the way Nigerian banks write them', () => {
  it('reads day-first and year-first styles, with or without a time', () => {
    expect(iso(parseDate('31/10/2026'))).toBe('2026-10-31');
    expect(iso(parseDate('01-02-26'))).toBe('2026-02-01');
    expect(iso(parseDate('31-Oct-2026'))).toBe('2026-10-31');
    expect(iso(parseDate('5 September 2026'))).toBe('2026-09-05');
    expect(iso(parseDate('2026-10-31 14:22:10'))).toBe('2026-10-31');
  });

  it('reads an Excel date and an Excel day-number', () => {
    expect(iso(parseDate(new Date(Date.UTC(2026, 9, 31))))).toBe('2026-10-31');
    expect(iso(parseDate(46326))).toBe('2026-10-31');
  });

  it('refuses days that do not exist and text that is not a date', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('Opening balance')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate(12)).toBeNull();
  });

  it('a Lagos day starts an hour before midnight UTC', () => {
    expect(parseDate('01/11/2026')!.toISOString()).toBe('2026-10-31T23:00:00.000Z');
  });
});

describe('amounts', () => {
  it('reads commas, currency signs, brackets and Dr/Cr', () => {
    expect(parseAmount('1,250,000.00')!.toString()).toBe('1250000');
    expect(parseAmount('₦5,000')!.toString()).toBe('5000');
    expect(parseAmount('NGN 750.50')!.toString()).toBe('750.5');
    expect(parseAmount('(500.00)')!.toString()).toBe('-500');
    expect(parseAmount('-500')!.toString()).toBe('-500');
    expect(parseAmount('500 Dr')!.toString()).toBe('-500');
    expect(parseAmount('500 CR')!.toString()).toBe('500');
    expect(parseAmount(1200.5)!.toString()).toBe('1200.5');
  });

  it('returns nothing for what is not a number', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('12.3.4')).toBeNull();
  });
});

describe('recognising the columns', () => {
  it('knows the common names, and does not mistake "value date" for the date', () => {
    const m = detectMapping(['Txn Date', 'Value Date', 'Narration', 'Ref No', 'Withdrawal', 'Deposit', 'Balance']);
    expect(m).toEqual({ date: 0, valueDate: 1, description: 2, reference: 3, debit: 4, credit: 5, balance: 6 });
  });

  it('knows a single signed amount column, and ignores it when there are separate debit and credit columns', () => {
    expect(detectMapping(['Date', 'Description', 'Amount', 'Reference', 'Balance'])).toEqual({ date: 0, description: 1, amount: 2, reference: 3, balance: 4 });
    expect(detectMapping(['Date', 'Details', 'Debit', 'Credit', 'Amount'])).not.toHaveProperty('amount');
  });

  it('finds the table below lines of account details', () => {
    const grid: Grid = [
      ['STATEMENT OF ACCOUNT'],
      ['Account name', 'OKO YOUTH FORUM'],
      ['Account number', '0123456789'],
      [],
      ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
      ['01/10/2026', 'TRF from ADA OBI', '', '5,000.00', '105,000.00'],
    ];
    expect(findHeaderRow(grid)?.index).toBe(4);
  });

  it('remembers a mapping by header text, and drops it if the bank renamed a column', () => {
    const headers = ['Txn Date', 'Narration', 'Withdrawal', 'Deposit'];
    const mapping = detectMapping(headers);
    const saved = toSavedMapping(headers, mapping);
    expect(applySavedMapping(['Narration', 'Deposit', 'Txn Date', 'Withdrawal'], saved)).toEqual({ date: 2, description: 0, debit: 3, credit: 1 });
    expect(applySavedMapping(['Txn Date', 'Details', 'Withdrawal', 'Deposit'], saved)).toBeNull();
  });
});

describe('reading a whole statement', () => {
  const bankA: Grid = [
    ['GTBank statement'],
    ['Trans Date', 'Value Date', 'Narration', 'Reference', 'Debit', 'Credit', 'Balance'],
    ['01-Oct-2026', '01-Oct-2026', 'NIP TRF FROM ADA OBI DUE-2026-0001', 'S123', '', '10,000.00', '110,000.00'],
    ['02-Oct-2026', '02-Oct-2026', 'POS PURCHASE', 'S124', '2,500.00', '', '107,500.00'],
    ['', '', 'Closing Balance', '', '', '', '107,500.00'],
    [],
    ['03-Oct-2026', '03-Oct-2026', 'NIP TRF FROM BOLA ADE', 'S125', '', '7,500.00', '115,000.00'],
  ];

  it('reads separate debit and credit columns, and ignores balance lines and blanks', () => {
    const result = readStatement(bankA);
    expect(result.layout.source).toBe('detected');
    expect(result.problems).toEqual([]);
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toMatchObject({ reference: 'S123', description: 'NIP TRF FROM ADA OBI DUE-2026-0001' });
    expect(result.lines[0]!.creditAmount!.toString()).toBe('10000');
    expect(result.lines[0]!.debitAmount).toBeNull();
    expect(result.lines[1]!.debitAmount!.toString()).toBe('2500');
    expect(result.lines[1]!.creditAmount).toBeNull();
    expect(result.skipped).toEqual([]);
  });

  it('reads one signed amount column: positive is money in, negative is money out', () => {
    const grid: Grid = [
      ['Date', 'Description', 'Amount', 'Reference', 'Balance'],
      ['2026-10-01', 'Example payment', 1000, 'REF1', 5000],
      ['2026-10-02', 'Example charge', -500, 'REF2', 4500],
    ];
    const { lines } = readStatement(grid);
    expect(lines[0]!.creditAmount!.toString()).toBe('1000');
    expect(lines[1]!.debitAmount!.toString()).toBe('500');
    expect(lines[1]!.creditAmount).toBeNull();
  });

  it('says why a line was skipped instead of guessing', () => {
    const grid: Grid = [
      ['Date', 'Description', 'Credit'],
      ['not a date', 'Something', '500'],
      ['03/10/2026', 'No amount here', ''],
      ['04/10/2026', 'Good one', '500'],
    ];
    const { lines, skipped } = readStatement(grid);
    expect(lines).toHaveLength(1);
    expect(skipped.map((s) => s.row)).toEqual([2, 3]);
    expect(skipped[0]!.reason).toMatch(/date/);
    expect(skipped[1]!.reason).toMatch(/amount/);
  });

  it('a mapping the officer chose wins over what was recognised, and an incomplete one explains what is missing', () => {
    const grid: Grid = [
      ['A', 'B', 'C', 'D'],
      ['01/10/2026', 'Ada', '500', 'x'],
    ];
    const bad = readStatement(grid, { manual: { date: 0 }, headerRow: 0 });
    expect(bad.problems.length).toBeGreaterThan(0);
    expect(bad.lines).toEqual([]);
    const good = readStatement(grid, { manual: { date: 0, description: 1, amount: 2 }, headerRow: 0 });
    expect(good.layout.source).toBe('manual');
    expect(good.lines).toHaveLength(1);
  });

  it('a file with no table is refused with a clear reason', () => {
    expect(() => readStatement([['hello'], ['world']])).toThrow(expect.objectContaining({ code: 'NO_TABLE' }));
    expect(() => readStatement([])).toThrow(expect.objectContaining({ code: 'EMPTY_FILE' }));
  });
});

describe('the identity of a line', () => {
  const line = (over: object = {}) => ({
    row: 2, transactionDate: parseDate('01/10/2026')!, valueDate: null, reference: 'S1', description: 'TRF ADA', debitAmount: null,
    creditAmount: new Decimal(5000), balance: new Decimal(105000), ...over,
  });

  it('is the same when the same line is read again, and different for a different amount, day or account', () => {
    expect(fingerprints(1, [line()])).toEqual(fingerprints(1, [line({ row: 9 })]));
    expect(fingerprints(1, [line()])[0]).not.toBe(fingerprints(2, [line()])[0]);
    expect(fingerprints(1, [line()])[0]).not.toBe(fingerprints(1, [line({ creditAmount: new Decimal(5001) })])[0]);
    expect(fingerprints(1, [line()])[0]).not.toBe(fingerprints(1, [line({ transactionDate: parseDate('02/10/2026')! })])[0]);
  });

  it('keeps two truly identical lines apart, but gives the same set when the file is read again', () => {
    const [a, b] = fingerprints(1, [line(), line()]);
    expect(a).not.toBe(b);
    expect(fingerprints(1, [line(), line()])).toEqual([a, b]);
  });
});
