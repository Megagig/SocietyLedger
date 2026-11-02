import { csvCell, toCsv } from './csv';

// babel-jest hoists this above the import, so the native module is never loaded.
jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: '' } }));

describe('csvCell', () => {
  it('leaves plain text and numbers alone', () => {
    expect(csvCell('Ordinary Savings')).toBe('Ordinary Savings');
    expect(csvCell(5000)).toBe('5000');
    expect(csvCell('5000.00')).toBe('5000.00');
  });

  it('quotes a cell with a comma, a quote or a line break, doubling the quotes', () => {
    expect(csvCell('Shares, Special')).toBe('"Shares, Special"');
    expect(csvCell('He said "paid"')).toBe('"He said ""paid"""');
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
  });

  it('is empty for a missing value', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('stops a text cell that starts like a formula from running as one, but keeps a negative number a number', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+234 phone')).toBe("'+234 phone");
    expect(csvCell('@handle')).toBe("'@handle");
    expect(csvCell('-20000.00')).toBe('-20000.00');
  });
});

describe('toCsv', () => {
  it('joins a header and rows with commas and Windows line ends', () => {
    expect(toCsv(['Date', 'Amount'], [['2026-03-04', '5000.00'], ['2026-04-10', 5000]])).toBe('Date,Amount\r\n2026-03-04,5000.00\r\n2026-04-10,5000');
  });
});
