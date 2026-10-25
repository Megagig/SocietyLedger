/** Reading the uploaded file: CSV in its many shapes, Excel, and refusing what can't be read reliably. */
import ExcelJS from 'exceljs';
import { parseCsv, readStatementFile, statementKind } from '../../src/modules/nigerian-payments/statement-file';
import { readStatement } from '../../src/modules/nigerian-payments/statement-parser';

describe('CSV', () => {
  it('reads quoted fields, embedded commas and doubled quotes', () => {
    const grid = parseCsv('Date,Narration,Credit\n01/10/2026,"TRF, from ""ADA"" OBI","5,000.00"\n');
    expect(grid).toEqual([
      ['Date', 'Narration', 'Credit'],
      ['01/10/2026', 'TRF, from "ADA" OBI', '5,000.00'],
    ]);
  });

  it('copes with a byte-order mark, Windows line endings, and semicolon or tab separators', () => {
    expect(parseCsv('﻿a;b\r\n1;2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('keeps a quoted field that spans lines in one cell', () => {
    expect(parseCsv('a,b\n"line one\nline two",x')).toEqual([['a', 'b'], ['line one\nline two', 'x']]);
  });
});

describe('what kind of file it is', () => {
  const zip = Buffer.from([0x50, 0x4b, 3, 4, 0]);
  it('accepts .csv and a real .xlsx', () => {
    expect(statementKind('stmt.csv', Buffer.from('a,b'))).toBe('csv');
    expect(statementKind('STMT.XLSX', zip)).toBe('xlsx');
  });

  it('refuses a PDF, an old .xls, a renamed file and anything else, each with its reason', () => {
    expect(() => statementKind('s.pdf', Buffer.from('%PDF-1.4 ...'))).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_FILE', message: expect.stringMatching(/PDF/) }));
    expect(() => statementKind('s.xls', zip)).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_FILE' }));
    expect(() => statementKind('s.xlsx', Buffer.from('not a zip'))).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_FILE' }));
    expect(() => statementKind('s.csv', zip)).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_FILE' }));
    expect(() => statementKind('s.docx', zip)).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_FILE' }));
  });

  it('refuses an empty file and one that is too large', async () => {
    await expect(readStatementFile('s.csv', Buffer.alloc(0))).rejects.toMatchObject({ code: 'EMPTY_FILE' });
    await expect(readStatementFile('s.csv', Buffer.alloc(5 * 1024 * 1024 + 1, 'a'))).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
});

describe('Excel', () => {
  it('reads a statement with real dates and numbers, below lines of account details', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Statement');
    ws.addRow(['OKO YOUTH FORUM']);
    ws.addRow([]);
    ws.addRow(['Txn Date', 'Narration', 'Withdrawal', 'Deposit', 'Balance']);
    ws.addRow([new Date(Date.UTC(2026, 9, 1)), 'TRF FROM ADA OBI', null, 5000, 105000]);
    ws.addRow([new Date(Date.UTC(2026, 9, 2)), 'POS', 1500, null, 103500]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const grid = await readStatementFile('stmt.xlsx', buffer);
    const { lines, layout } = readStatement(grid);
    expect(layout.headerRow).toBe(2);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.creditAmount!.toString()).toBe('5000');
    expect(lines[1]!.debitAmount!.toString()).toBe('1500');
    expect(lines[0]!.transactionDate.toISOString()).toBe('2026-09-30T23:00:00.000Z');
  });

  it('says so when the file is damaged', async () => {
    await expect(readStatementFile('s.xlsx', Buffer.from([0x50, 0x4b, 3, 4, 1, 2, 3]))).rejects.toMatchObject({ code: 'UNREADABLE_FILE' });
  });
});
