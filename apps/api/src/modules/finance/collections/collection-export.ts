import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * One table, as an Excel workbook or a PDF, for every "who has paid" screen (levy campaign, donations, penalties, member ledgers).
 * The screens differ only in the columns and rows they hand in; the header says which filter and search made the list, so a printed
 * "yet to pay" list can never be mistaken for the whole membership. Money is always written in full.
 */
export interface ExportColumn {
  header: string;
  /** Roughly how many characters wide the column needs; the PDF shares the page in these proportions. */
  width: number;
  money?: boolean;
}

export type Cell = string | number | null | undefined;

export interface CollectionExport {
  title: string;
  association: string;
  /** "Showing: Yet to pay (part paid and not paid), search: ada", written for a person. */
  filterLine: string;
  generatedAt: Date;
  summary: Array<{ label: string; value: Cell; money?: boolean }>;
  columns: ExportColumn[];
  rows: Cell[][];
}

/** A spreadsheet runs a text cell that starts with = + - @ as a formula; money columns are numbers, so only text is guarded. */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** In full with two decimals. The built-in PDF fonts have no naira sign, so the PDF writes NGN. */
export function formatMoneyPlain(value: number | string, symbol: string): string {
  const n = Number(value);
  const [whole, cents] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}${symbol}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
}

const stamp = (d: Date) =>
  d.toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export async function toExcel(doc: CollectionExport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = doc.association;
  workbook.created = doc.generatedAt;
  const sheet = workbook.addWorksheet(doc.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  const lastCol = Math.max(doc.columns.length, 2);

  const line = (text: string, bold = false, size = 11) => {
    const row = sheet.addRow([text]);
    sheet.mergeCells(row.number, 1, row.number, lastCol);
    row.getCell(1).font = { bold, size };
    return row;
  };
  line(doc.association, true, 14);
  line(doc.title, true, 12);
  line(doc.filterLine);
  line(`Generated ${stamp(doc.generatedAt)}`);
  sheet.addRow([]);
  for (const item of doc.summary) {
    const row = sheet.addRow([item.label, typeof item.value === 'string' ? safeText(item.value) : item.value ?? '']);
    row.getCell(1).font = { bold: true };
    if (item.money && typeof item.value === 'number') row.getCell(2).numFmt = '"₦"#,##0.00';
    row.getCell(2).alignment = { horizontal: 'left' };
  }
  sheet.addRow([]);

  const head = sheet.addRow(doc.columns.map((c) => c.header));
  head.font = { bold: true };
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    cell.border = { bottom: { style: 'thin' } };
  });
  for (const r of doc.rows) {
    const row = sheet.addRow(r.map((cell, i) => (typeof cell === 'string' ? safeText(cell) : cell ?? '')));
    doc.columns.forEach((c, i) => {
      if (c.money && typeof r[i] === 'number') row.getCell(i + 1).numFmt = '"₦"#,##0.00';
    });
  }
  doc.columns.forEach((c, i) => {
    sheet.getColumn(i + 1).width = Math.max(c.width, c.header.length + 2);
  });
  sheet.views = [{ state: 'frozen', ySplit: head.number }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function toPdf(doc: CollectionExport): Promise<Buffer> {
  const landscape = doc.columns.length > 5;
  const pdf = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: 32, info: { Title: doc.title } });
  const left = 32;
  const usable = pdf.page.width - 64;
  const totalWidth = doc.columns.reduce((sum, c) => sum + c.width, 0);
  const widths = doc.columns.map((c) => (c.width / totalWidth) * usable);
  const bottom = pdf.page.height - 44;

  pdf.font('Helvetica-Bold').fontSize(15).text(doc.association);
  pdf.font('Helvetica-Bold').fontSize(12).text(doc.title);
  pdf.font('Helvetica').fontSize(9).text(doc.filterLine);
  pdf.text(`Generated ${stamp(doc.generatedAt)}`);
  pdf.moveDown(0.5);
  for (const item of doc.summary) {
    const value = item.money && typeof item.value === 'number' ? formatMoneyPlain(item.value, 'NGN ') : String(item.value ?? '');
    pdf.font('Helvetica-Bold').text(`${item.label}: `, { continued: true }).font('Helvetica').text(value);
  }
  pdf.moveDown(0.6);

  const row = (cells: string[], bold: boolean) => {
    const y = pdf.y;
    let x = left;
    pdf.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    cells.forEach((cell, i) => {
      pdf.text(cell, x, y, { width: widths[i] - 6, lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    pdf.y = y + 13;
    if (bold) {
      pdf.moveTo(left, pdf.y - 2).lineTo(left + usable, pdf.y - 2).lineWidth(0.5).stroke();
    }
  };
  const header = () => row(doc.columns.map((c) => c.header), true);

  header();
  for (const r of doc.rows) {
    if (pdf.y > bottom) {
      pdf.addPage();
      header();
    }
    row(
      r.map((cell, i) => (doc.columns[i].money && typeof cell === 'number' ? formatMoneyPlain(cell, 'NGN ') : String(cell ?? ''))),
      false,
    );
  }
  if (doc.rows.length === 0) pdf.font('Helvetica-Oblique').fontSize(9).text('Nobody matches this filter.', left, pdf.y + 4);
  pdf.moveDown(1);
  pdf.font('Helvetica').fontSize(7).fillColor('#555555').text('From SocietyLedger records.', left, pdf.y);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.end();
  });
}
