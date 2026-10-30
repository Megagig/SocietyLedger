/**
 * Report files: a CSV that opens correctly in Excel and a PDF, both written from the same `ReportResult` the screens show, so a file can
 * never hold a figure the screen does not.
 *
 * CSV: UTF-8 with a byte-order mark (Excel reads ₦ and names correctly), money as plain numbers in naira with two decimals under a
 * "(₦)" heading so a column adds up, and text cells that cannot run as formulas. PDF: the built-in fonts have no naira sign, so money
 * is written "NGN 10,000.00" there. Money is always in full.
 */
import PDFDocument from 'pdfkit';
import { formatNaira } from '../ajo-collections';
import { csvCell } from '../ajo-savings-statement';
import type { Cell, Column, Metric, ReportResult } from './report-types';

/** Kobo as naira with two decimals and no separators, for a spreadsheet: 1000050 -> "10000.50". */
export function nairaPlain(kobo: string | bigint): string {
  const n = BigInt(kobo);
  const abs = n < 0n ? -n : n;
  return `${n < 0n ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}
const ngn = (kobo: string | bigint) => formatNaira(BigInt(kobo)).replace('₦', 'NGN ');
/** The built-in PDF fonts have no naira sign (it prints as a stray mark), so any ₦ in text the server wrote becomes "NGN ". */
export const pdfSafe = (text: string): string => text.replace(/₦/g, 'NGN ');

const zoneOf = (r: ReportResult) => r.blocks[0]?.timezone ?? 'Africa/Lagos';
function stamp(value: string, timeZone: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

export const reportFileName = (r: ReportResult, ext: 'csv' | 'pdf') => `ajo-${r.name}-${r.filters.from}-to-${r.filters.to}.${ext}`;

// ---------------------------------------------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------------------------------------------

function metricCell(m: Metric): { value: string; unit: string } {
  if (m.value === null) return { value: '', unit: '' };
  if (m.kind === 'money') return { value: nairaPlain(m.value as string), unit: 'NGN' };
  if (m.kind === 'percent') return { value: ((m.value as number) / 100).toFixed(2), unit: '%' };
  return { value: String(m.value), unit: '' };
}

function dataCell(col: Column, cell: Cell, timeZone: string): string {
  if (cell === null || cell === undefined || cell === '') return '';
  if (col.kind === 'money') return nairaPlain(String(cell));
  if (col.kind === 'int') return String(cell);
  if (col.kind === 'datetime') return csvCell(stamp(String(cell), timeZone));
  return csvCell(String(cell));
}

export function reportCsv(r: ReportResult): string {
  const lines: string[] = [];
  const row = (...cols: Array<string | number | null | undefined>) => lines.push(cols.map(csvCell).join(','));
  const tz = zoneOf(r);

  row(r.title);
  row('Dates', `${r.filters.from} to ${r.filters.to}`);
  row('Rule', r.rule);
  row('Generated', stamp(r.generatedAt, tz), tz);
  for (const n of r.notes) row('Note', n);
  lines.push('');

  row('Figures');
  lines.push(['Circle', 'Figure', 'Value', 'Unit'].map(csvCell).join(','));
  for (const b of r.blocks) for (const m of b.metrics) {
    const c = metricCell(m);
    lines.push([csvCell(b.groupName), csvCell(m.label), c.value, csvCell(c.unit)].join(','));
  }
  for (const t of r.totals) for (const m of t.metrics) {
    const c = metricCell(m);
    lines.push([csvCell(t.label), csvCell(m.label), c.value, csvCell(c.unit)].join(','));
  }
  lines.push('');

  row('Details');
  lines.push(r.columns.map((c) => csvCell(c.kind === 'money' ? `${c.label} (₦)` : c.label)).join(','));
  for (const rowData of r.rows) lines.push(r.columns.map((c) => dataCell(c, rowData[c.key] ?? null, tz)).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------------------------------------------------------------

const WEIGHT: Record<string, number> = { what: 3.2, note: 2.4, reason: 2 };
const KIND_WEIGHT: Record<Column['kind'], number> = { text: 1.4, money: 1.15, date: 0.9, datetime: 1.15, int: 0.75, percent: 0.8 };

function pdfCell(col: Column, cell: Cell, timeZone: string): string {
  if (cell === null || cell === undefined || cell === '') return '';
  if (col.kind === 'money') return ngn(String(cell));
  if (col.kind === 'datetime') return stamp(String(cell), timeZone);
  return pdfSafe(String(cell));
}
function pdfMetric(m: Metric): string {
  if (m.value === null) return 'n/a';
  if (m.kind === 'money') return ngn(m.value as string);
  if (m.kind === 'percent') return `${((m.value as number) / 100).toFixed(2)}%`;
  return String(m.value);
}

export function reportPdf(r: ReportResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true, info: { Title: r.title, Author: 'SocietyLedger' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const tz = zoneOf(r);
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom - 14;

    doc.font('Helvetica-Bold').fontSize(16).text(pdfSafe(r.title), left, doc.page.margins.top);
    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    doc.text(`Dates: ${r.filters.from} to ${r.filters.to}   |   Generated ${stamp(r.generatedAt, tz)} (${tz})`);
    doc.text(pdfSafe(`Rule: ${r.rule}`), { width });
    for (const n of r.notes) doc.text(pdfSafe(n), { width });
    doc.moveDown(0.6).fillColor('#000000');

    // Figures: each circle's, then the totals, three to a line.
    const figures = [...r.blocks.map((b) => ({ heading: b.groupName, metrics: b.metrics })), ...r.totals.map((t) => ({ heading: t.label, metrics: t.metrics }))];
    for (const f of figures) {
      if (doc.y > bottom() - 60) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).text(pdfSafe(f.heading), left);
      doc.font('Helvetica').fontSize(8.5);
      const colW = width / 3;
      for (let i = 0; i < f.metrics.length; i += 3) {
        const y = doc.y;
        let tallest = 0;
        f.metrics.slice(i, i + 3).forEach((m, j) => {
          const text = pdfSafe(`${m.label}: ${pdfMetric(m)}`);
          doc.text(text, left + j * colW, y, { width: colW - 8 });
          tallest = Math.max(tallest, doc.y - y);
        });
        doc.y = y + tallest + 2;
        if (doc.y > bottom()) doc.addPage();
      }
      doc.moveDown(0.4);
    }

    // The detail table.
    const weights = r.columns.map((c) => WEIGHT[c.key] ?? KIND_WEIGHT[c.kind]);
    const total = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (w / total) * width);
    const xs = widths.map((_, i) => left + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const header = () => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(8);
      r.columns.forEach((c, i) => doc.text(pdfSafe(c.label), xs[i], y, { width: widths[i] - 4, lineBreak: false, ellipsis: true, align: c.kind === 'money' || c.kind === 'int' ? 'right' : 'left' }));
      doc.moveTo(left, y + 12).lineTo(left + width, y + 12).strokeColor('#999999').lineWidth(0.5).stroke();
      doc.y = y + 16;
      doc.font('Helvetica').fontSize(8);
    };
    if (doc.y > bottom() - 60) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(11).text(`Details (${r.rows.length} ${r.rows.length === 1 ? 'row' : 'rows'})`, left, doc.y);
    doc.moveDown(0.3);
    header();
    if (r.rows.length === 0) doc.font('Helvetica').fontSize(9).text('Nothing to show for these dates.', left);
    for (const data of r.rows) {
      const cells = r.columns.map((c) => pdfCell(c, data[c.key] ?? null, tz));
      doc.font('Helvetica').fontSize(8);
      const height = Math.min(34, Math.max(11, ...cells.map((t, i) => doc.heightOfString(t, { width: widths[i] - 4 }))));
      if (doc.y + height > bottom()) {
        doc.addPage();
        header();
      }
      const y = doc.y;
      cells.forEach((t, i) => doc.text(t, xs[i], y, { width: widths[i] - 4, height, ellipsis: true, align: r.columns[i].kind === 'money' || r.columns[i].kind === 'int' ? 'right' : 'left' }));
      doc.y = y + height + 3;
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      // The footer sits inside the bottom margin; without this PDFKit would start a new page to fit it.
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor('#666666').text(`SocietyLedger records. Page ${i + 1} of ${range.count}`, left, doc.page.height - 26, { width, align: 'center', lineBreak: false });
    }
    doc.end();
  });
}
