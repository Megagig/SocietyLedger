import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { RuleError } from '../finance/rule-error';

/**
 * Turns a bank statement of any layout into one canonical list of lines: date, description, reference, money in (credit), money out
 * (debit) and balance. Banks differ in column names, in whether money in and out are two columns or one signed amount, in date style
 * and in how many lines of account details come before the table, so the table is found and its columns recognised rather than
 * assumed. Pure: the file is read into a grid of cells elsewhere (`statement-file.ts`).
 */

export type Cell = string | number | boolean | Date | null | undefined;
export type Grid = Cell[][];

export type ColumnKey = 'date' | 'valueDate' | 'description' | 'reference' | 'debit' | 'credit' | 'amount' | 'balance';
/** Which column (by position) holds each piece. */
export type Mapping = Partial<Record<ColumnKey, number>>;
/** The same, by the header text, so it still fits when a bank moves its columns. This is what is remembered per bank account. */
export type SavedMapping = Partial<Record<ColumnKey, string>>;

export const COLUMN_KEYS: ColumnKey[] = ['date', 'valueDate', 'description', 'reference', 'debit', 'credit', 'amount', 'balance'];
export const MAX_ROWS = 5000;

export type StatementLine = {
  /** The row in the file (1-based), for telling the officer which line had a problem. */
  row: number;
  transactionDate: Date;
  valueDate: Date | null;
  reference: string | null;
  description: string;
  debitAmount: Decimal | null;
  creditAmount: Decimal | null;
  balance: Decimal | null;
};

export type SkippedRow = { row: number; reason: string };

// ---------------------------------------------------------------- reading cells

export function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).replace(/\s+/g, ' ').trim();
}

export function normHeader(cell: Cell): string {
  return cellText(cell).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- finding the table and its columns

const ALIASES: Record<ColumnKey, string[]> = {
  date: ['date', 'txn date', 'tran date', 'trans date', 'transaction date', 'posting date', 'posted date', 'trans dt', 'txn dt', 'transaction dt', 'booking date'],
  valueDate: ['value date', 'value dt', 'val date', 'valuedate'],
  description: ['description', 'narration', 'narrative', 'details', 'transaction details', 'transaction description', 'particulars', 'remarks', 'remark', 'memo'],
  reference: ['reference', 'ref', 'ref no', 'ref number', 'reference no', 'reference number', 'transaction reference', 'trans ref', 'txn ref', 'transaction id', 'session id', 'cheque no', 'cheque number'],
  debit: ['debit', 'debit amount', 'debit amt', 'debits', 'dr', 'dr amount', 'withdrawal', 'withdrawals', 'withdrawal amount', 'money out', 'paid out', 'amount debited'],
  credit: ['credit', 'credit amount', 'credit amt', 'credits', 'cr', 'cr amount', 'deposit', 'deposits', 'deposit amount', 'money in', 'paid in', 'amount credited'],
  amount: ['amount', 'txn amount', 'transaction amount', 'trans amount', 'value'],
  balance: ['balance', 'running balance', 'closing balance', 'available balance', 'ledger balance', 'bal'],
};

/** The order columns are claimed in, so "value date" is not mistaken for "date" and one column is never used twice. */
const CLAIM_ORDER: ColumnKey[] = ['valueDate', 'date', 'reference', 'description', 'credit', 'debit', 'balance', 'amount'];

/** Recognises which column holds what, from the header row. */
export function detectMapping(headers: Cell[]): Mapping {
  const normal = headers.map(normHeader);
  const mapping: Mapping = {};
  const taken = new Set<number>();

  for (const key of CLAIM_ORDER) {
    let found = normal.findIndex((h, i) => !taken.has(i) && ALIASES[key].includes(h));
    if (found < 0 && key !== 'amount') {
      // a looser match: the header contains a word like "credit" or "narration" (but "date" must not catch "value date")
      found = normal.findIndex((h, i) => {
        if (taken.has(i) || !h) return false;
        if (key === 'date') return /\bdate\b|\bdt\b/.test(h) && !/value|val\b/.test(h);
        return ALIASES[key].some((a) => a.length >= 5 && new RegExp(`\\b${a.replace(/ /g, ' ')}\\b`).test(h));
      });
    }
    if (found >= 0) {
      mapping[key] = found;
      taken.add(found);
    }
  }
  // with money in and out in their own columns, a stray "amount" column is not the one to use
  if (mapping.credit !== undefined || mapping.debit !== undefined) delete mapping.amount;
  return mapping;
}

function hasMoney(m: Mapping): boolean {
  return m.credit !== undefined || m.amount !== undefined;
}

/** The first row near the top that looks like the table's header: it names a date, money in, and a description or reference. */
export function findHeaderRow(grid: Grid): { index: number; mapping: Mapping } | null {
  const limit = Math.min(grid.length, 40);
  for (let i = 0; i < limit; i++) {
    const row = grid[i] ?? [];
    if (row.filter((c) => cellText(c) !== '').length < 3) continue;
    const mapping = detectMapping(row);
    if (mapping.date !== undefined && hasMoney(mapping) && (mapping.description !== undefined || mapping.reference !== undefined)) {
      return { index: i, mapping };
    }
  }
  return null;
}

/** Applies a mapping remembered by header text, when every header it names is still in this file. */
export function applySavedMapping(headers: Cell[], saved: SavedMapping | null | undefined): Mapping | null {
  if (!saved) return null;
  const normal = headers.map(normHeader);
  const mapping: Mapping = {};
  for (const key of COLUMN_KEYS) {
    const name = saved[key];
    if (!name) continue;
    const at = normal.indexOf(normHeader(name));
    if (at < 0) return null;
    mapping[key] = at;
  }
  return mapping.date !== undefined && hasMoney(mapping) ? mapping : null;
}

export function toSavedMapping(headers: Cell[], mapping: Mapping): SavedMapping {
  const saved: SavedMapping = {};
  for (const key of COLUMN_KEYS) {
    const at = mapping[key];
    if (at !== undefined && headers[at] !== undefined) saved[key] = cellText(headers[at]);
  }
  return saved;
}

/** Problems that stop an import: what the mapping is missing. Empty means it can be used. */
export function mappingProblems(mapping: Mapping): string[] {
  const problems: string[] = [];
  if (mapping.date === undefined) problems.push('Choose the column that holds the date.');
  if (!hasMoney(mapping)) problems.push('Choose the column that holds the money coming in (credit), or one amount column.');
  if (mapping.description === undefined && mapping.reference === undefined) problems.push('Choose the description or reference column.');
  return problems;
}

// ---------------------------------------------------------------- dates and amounts

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** A calendar day in Lagos, as the moment it starts. */
export function lagosDay(year: number, month: number, day: number): Date | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1) return null; // 31 Feb and the like
  return new Date(probe.getTime() - LAGOS_OFFSET_MS);
}

/**
 * Reads a date the way Nigerian banks write it: day first (31/10/2026, 31-10-26, 31-Oct-2026, 31 October 2026), or year first
 * (2026-10-31). A real Excel date or an Excel day-number is accepted too. A time of day is ignored.
 */
export function parseDate(cell: Cell): Date | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return null;
    return lagosDay(cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate());
  }
  if (typeof cell === 'number') {
    // An Excel day-number: days since 30 Dec 1899
    if (cell < 20000 || cell > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(cell) * 86_400_000);
    return lagosDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const text = cellText(cell);
  let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return lagosDay(Number(m[1]), Number(m[2]), Number(m[3]));
  m = text.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/);
  if (m) {
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return lagosDay(year, Number(m[2]), Number(m[1]));
  }
  m = text.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ,]*(\d{2,4})/);
  if (m) {
    const month = MONTHS[m[2]!.slice(0, 4).toLowerCase()] ?? MONTHS[m[2]!.slice(0, 3).toLowerCase()];
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return month ? lagosDay(year, month, Number(m[1])) : null;
  }
  return null;
}

/**
 * Reads an amount: 1,250,000.00 · ₦1,000 · (500.00) · -500 · 500 Dr. Returns null for anything that isn't a number. A (bracketed),
 * negative or Dr amount is negative.
 */
export function parseAmount(cell: Cell): Decimal | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') return Number.isFinite(cell) ? new Decimal(cell).toDecimalPlaces(2) : null;
  let text = cellText(cell).toUpperCase();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/\bDR\b\.?$/.test(text)) negative = true;
  text = text.replace(/\b(CR|DR)\b\.?/g, '').replace(/NGN|₦|N(?=\d)/g, '').replace(/[,\s]/g, '');
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = new Decimal(text).toDecimalPlaces(2);
  return negative ? value.negated() : value;
}

// ---------------------------------------------------------------- the lines

const NOT_A_LINE = /^(opening|closing|brought forward|carried forward|b\/f|c\/f|total|summary|balance b)/i;

/** Reads the rows under the header into canonical lines. A row that can't be read is skipped with the reason, never guessed at. */
export function parseLines(grid: Grid, headerRow: number, mapping: Mapping): { lines: StatementLine[]; skipped: SkippedRow[] } {
  const lines: StatementLine[] = [];
  const skipped: SkippedRow[] = [];
  const at = (row: Cell[], key: ColumnKey): Cell => (mapping[key] === undefined ? undefined : row[mapping[key] as number]);

  for (let i = headerRow + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    if (row.every((c) => cellText(c) === '')) continue;
    const rowNumber = i + 1;

    const description = cellText(at(row, 'description'));
    const reference = cellText(at(row, 'reference'));
    if (NOT_A_LINE.test(description) || NOT_A_LINE.test(cellText(row[0]))) continue;

    const date = parseDate(at(row, 'date'));
    if (!date) {
      // Summary lines under the table have no date: not worth a warning when they are plainly not transactions
      if (cellText(at(row, 'date')) !== '') skipped.push({ row: rowNumber, reason: `The date "${cellText(at(row, 'date'))}" couldn't be read.` });
      continue;
    }

    let credit: Decimal | null = null;
    let debit: Decimal | null = null;
    if (mapping.amount !== undefined) {
      const amount = parseAmount(at(row, 'amount'));
      if (amount && !amount.isZero()) {
        if (amount.isPositive()) credit = amount;
        else debit = amount.abs();
      }
    } else {
      const c = parseAmount(at(row, 'credit'));
      const d = parseAmount(at(row, 'debit'));
      if (c && !c.isZero()) credit = c.abs();
      if (d && !d.isZero()) debit = d.abs();
    }
    if (!credit && !debit) {
      skipped.push({ row: rowNumber, reason: 'There is no amount on this line.' });
      continue;
    }
    if (!description && !reference) {
      skipped.push({ row: rowNumber, reason: 'There is no description or reference on this line.' });
      continue;
    }

    lines.push({
      row: rowNumber,
      transactionDate: date,
      valueDate: parseDate(at(row, 'valueDate')),
      reference: reference || null,
      description: description || reference,
      debitAmount: debit,
      creditAmount: credit,
      balance: parseAmount(at(row, 'balance')),
    });
  }
  return { lines, skipped };
}

// ---------------------------------------------------------------- identity of a line

function dayKey(d: Date): string {
  return new Date(d.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * A stable identity for a line, so the same statement imported twice (or two overlapping statements) never records a line twice.
 * Two truly identical lines on the same day (same narration, amount and balance) are kept apart by a count within the file, so
 * importing that file again still gives the same set.
 */
export function fingerprints(bankAccountId: number, lines: StatementLine[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const base = [
      bankAccountId,
      dayKey(l.transactionDate),
      (l.reference ?? '').toLowerCase().replace(/\s+/g, ''),
      l.description.toLowerCase().replace(/\s+/g, ' ').trim(),
      l.creditAmount?.toFixed(2) ?? '',
      l.debitAmount?.toFixed(2) ?? '',
      l.balance?.toFixed(2) ?? '',
    ].join('|');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return crypto.createHash('sha256').update(`${base}#${n}`).digest('hex');
  });
}

// ---------------------------------------------------------------- one call for the preview and the import

export type StatementLayout = {
  headerRow: number;
  headers: string[];
  mapping: Mapping;
  /** Where the mapping came from: remembered for this account, recognised from the file, or chosen by the officer. */
  source: 'saved' | 'detected' | 'manual';
};

/**
 * Works out the layout of a statement and reads its lines. `manual` (from the officer) wins over `saved` (remembered for the
 * account), which wins over what is recognised from the file. Throws a RuleError when no table can be found at all.
 */
export function readStatement(grid: Grid, options: { manual?: Mapping | null; saved?: SavedMapping | null; headerRow?: number | null } = {}) {
  if (grid.length === 0) throw new RuleError('The file is empty.', 400, 'EMPTY_FILE');
  if (grid.length > MAX_ROWS + 60) throw new RuleError(`The statement has more than ${MAX_ROWS.toLocaleString('en-NG')} lines. Import it in smaller parts.`, 400, 'TOO_MANY_ROWS');

  const found = findHeaderRow(grid);
  const headerRow = options.headerRow ?? found?.index ?? null;
  if (headerRow === null) {
    throw new RuleError('We could not find the table of transactions in this file. Check it is a bank statement, or use our template.', 400, 'NO_TABLE');
  }
  const headerCells = grid[headerRow] ?? [];
  const headers = headerCells.map(cellText);

  let mapping: Mapping;
  let source: StatementLayout['source'];
  if (options.manual && Object.keys(options.manual).length > 0) {
    mapping = options.manual;
    source = 'manual';
  } else {
    const saved = applySavedMapping(headerCells, options.saved);
    if (saved) {
      mapping = saved;
      source = 'saved';
    } else {
      mapping = detectMapping(headerCells);
      source = 'detected';
    }
  }

  const problems = mappingProblems(mapping);
  const { lines, skipped } = problems.length === 0 ? parseLines(grid, headerRow, mapping) : { lines: [], skipped: [] };
  return { layout: { headerRow, headers, mapping, source } as StatementLayout, problems, lines, skipped };
}
