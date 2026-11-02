import { saveAndShareFile, CSV_MIME } from '@/features/ajo/shareFile';

/** One CSV cell: quoted when it holds a comma, a quote or a line break, with quotes doubled; nothing is ever interpreted as a formula. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // A spreadsheet runs a cell that starts with = + - @ as a formula. Money columns are numbers, so only text is guarded.
  if (typeof value === 'string' && /^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Builds the CSV and opens the share sheet on it (a spreadsheet app, WhatsApp, Files…). */
export async function shareCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]): Promise<void> {
  const bytes = new TextEncoder().encode(toCsv(header, rows));
  await saveAndShareFile(filename.endsWith('.csv') ? filename : `${filename}.csv`, bytes.buffer as ArrayBuffer, CSV_MIME);
}
