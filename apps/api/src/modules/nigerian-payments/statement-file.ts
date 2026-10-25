import ExcelJS from 'exceljs';
import { RuleError } from '../finance/rule-error';
import type { Cell, Grid } from './statement-parser';

/**
 * Reads an uploaded statement file (CSV or Excel) into a grid of cells for `statement-parser.ts`. The file type is decided by its
 * contents and name, never trusted from what the phone says it is.
 */

export const STATEMENT_MAX_BYTES = 5 * 1024 * 1024;

export type StatementFileKind = 'csv' | 'xlsx';

/** CSV and Excel (.xlsx). An .xlsx is a zip, so it starts with "PK"; the old .xls and PDFs are refused with a reason. */
export function statementKind(filename: string, buffer: Buffer): StatementFileKind {
  const name = filename.toLowerCase();
  const isZip = buffer.length > 3 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (buffer.length > 4 && buffer.subarray(0, 4).toString() === '%PDF') {
    throw new RuleError('PDF statements can’t be read reliably. Download the statement as Excel or CSV from your bank instead.', 400, 'UNSUPPORTED_FILE');
  }
  if (name.endsWith('.xlsx')) {
    if (!isZip) throw new RuleError('This file is not a valid Excel (.xlsx) file.', 400, 'UNSUPPORTED_FILE');
    return 'xlsx';
  }
  if (name.endsWith('.xls')) {
    throw new RuleError('Old Excel (.xls) files are not supported. Save it as .xlsx or CSV and try again.', 400, 'UNSUPPORTED_FILE');
  }
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    if (isZip) throw new RuleError('This file is not a CSV. If it is an Excel file, give it the .xlsx ending.', 400, 'UNSUPPORTED_FILE');
    return 'csv';
  }
  throw new RuleError('Upload a CSV or Excel (.xlsx) statement.', 400, 'UNSUPPORTED_FILE');
}

/** The separator a CSV uses, from its first few lines. Some banks use semicolons or tabs. */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 15).join('\n');
  const counts = [',', ';', '\t', '|'].map((d) => ({ d, n: sample.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0]!.n > 0 ? counts[0]!.d : ',';
}

/** A small CSV reader: quoted fields, doubled quotes, embedded commas and new lines, a leading byte-order mark. */
export function parseCsv(input: string): Grid {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: Grid = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function excelCell(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as Array<{ text: string }>).map((t) => t.text).join('');
    if ('result' in v) return excelCell(v.result as ExcelJS.CellValue);
    if ('text' in v) return String(v.text);
    if ('error' in v) return null;
  }
  return value as Cell;
}

/** The first sheet that has data (statements are one sheet; a workbook with a cover sheet still works). */
export async function readExcel(buffer: Buffer): Promise<Grid> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new RuleError('This Excel file could not be opened. It may be damaged or password protected.', 400, 'UNREADABLE_FILE');
  }
  const sheet = [...workbook.worksheets].sort((a, b) => b.actualRowCount - a.actualRowCount)[0];
  if (!sheet || sheet.actualRowCount === 0) throw new RuleError('The file is empty.', 400, 'EMPTY_FILE');

  const grid: Grid = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: Cell[] = [];
    for (let c = 1; c <= row.cellCount; c++) cells.push(excelCell(row.getCell(c).value));
    grid[rowNumber - 1] = cells;
  });
  for (let i = 0; i < grid.length; i++) grid[i] ??= [];
  return grid;
}

export async function readStatementFile(filename: string, buffer: Buffer): Promise<Grid> {
  if (buffer.length === 0) throw new RuleError('The file is empty.', 400, 'EMPTY_FILE');
  if (buffer.length > STATEMENT_MAX_BYTES) throw new RuleError('The file is larger than 5 MB.', 400, 'FILE_TOO_LARGE');
  const kind = statementKind(filename, buffer);
  return kind === 'xlsx' ? readExcel(buffer) : parseCsv(buffer.toString('utf8'));
}
