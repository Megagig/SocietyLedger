import PDFDocument from 'pdfkit';
import { Decimal } from '@prisma/client/runtime/library';

type Money = Decimal | string | number | null | undefined;
type Side = { desc: string; dr: Money; cr: Money; balance: Money };

/** The shape `cooperativeMemberService.cashbook` returns. */
export interface CashbookData {
  member: { name: string; memberNumber: string } | null;
  period: { from: Date | null; to: Date | null };
  tiles: { totalShares: Money; totalSavings: Money; totalLoans: Money; totalLoanInterest: Money };
  rows: Array<{ date: Date; narration: string; shares: Money; savings: Side | null; loans: Side | null; interest: { dr: Money; cr: Money; balance: Money } | null }>;
  totals: { shares: Money; savingsDr: Money; savingsCr: Money; loansDr: Money; loansCr: Money; interestDr: Money; interestCr: Money };
}

/** In full, with two decimals (the built-in PDF fonts have no naira sign, so the PDF writes NGN). */
const ngn = (value: Money) => {
  if (value === null || value === undefined) return '';
  const n = new Decimal(value as Decimal.Value);
  return n.isZero() ? '' : `NGN ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

const COLUMNS: Array<{ head: string; width: number }> = [
  { head: 'Date', width: 50 },
  { head: 'Narration', width: 118 },
  { head: 'Shares', width: 52 },
  { head: 'Savings DR', width: 52 },
  { head: 'Savings CR', width: 52 },
  { head: 'Savings balance', width: 56 },
  { head: 'Loans DR', width: 52 },
  { head: 'Loans CR', width: 52 },
  { head: 'Loans balance', width: 56 },
  { head: 'Interest charged', width: 52 },
  { head: 'Interest paid', width: 52 },
  { head: 'Interest still to pay', width: 58 },
];

function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/** A member's cashbook as a landscape PDF: the same columns as the screen, with the totals and the balances the screen shows. */
export function cashbookPdf(data: CashbookData, associationName: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, info: { Title: `Cashbook, ${data.member?.name ?? ''}` } });
  const left = 30;
  const bottom = doc.page.height - 40;

  doc.font('Helvetica-Bold').fontSize(16).text(associationName);
  doc.font('Helvetica').fontSize(11).text('Cooperative cashbook');
  doc.moveDown(0.4);
  doc.fontSize(9);
  if (data.member) doc.text(`Member: ${data.member.name} (${data.member.memberNumber})`);
  doc.text(`Period: ${data.period.from ? day(data.period.from) : 'from the beginning'} to ${data.period.to ? day(data.period.to) : 'today'}`);
  doc.text(
    `Shares ${ngn(data.tiles.totalShares) || 'NGN 0.00'}   Savings ${ngn(data.tiles.totalSavings) || 'NGN 0.00'}   Loans ${ngn(data.tiles.totalLoans) || 'NGN 0.00'}   Interest still to pay ${ngn(data.tiles.totalLoanInterest) || 'NGN 0.00'}`,
  );
  doc.moveDown(0.6);

  const row = (cells: string[], bold: boolean) => {
    const y = doc.y;
    let x = left;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5);
    cells.forEach((cell, i) => {
      doc.text(cell, x, y, { width: COLUMNS[i].width - 4, lineBreak: false, ellipsis: true });
      x += COLUMNS[i].width;
    });
    doc.y = y + 12;
  };
  const header = () => row(COLUMNS.map((c) => c.head), true);

  header();
  for (const r of data.rows) {
    if (doc.y > bottom) {
      doc.addPage();
      header();
    }
    row(
      [
        day(r.date),
        r.narration,
        ngn(r.shares),
        ngn(r.savings?.dr),
        ngn(r.savings?.cr),
        r.savings ? ngn(r.savings.balance) || 'NGN 0.00' : '',
        ngn(r.loans?.dr),
        ngn(r.loans?.cr),
        r.loans ? ngn(r.loans.balance) || 'NGN 0.00' : '',
        ngn(r.interest?.dr),
        ngn(r.interest?.cr),
        r.interest ? ngn(r.interest.balance) || 'NGN 0.00' : '',
      ],
      false,
    );
  }
  if (doc.y > bottom) doc.addPage();
  const t = data.totals;
  row(['', 'Totals', ngn(t.shares), ngn(t.savingsDr), ngn(t.savingsCr), '', ngn(t.loansDr), ngn(t.loansCr), '', ngn(t.interestDr), ngn(t.interestCr), ''], true);

  doc.moveDown(0.8);
  doc.font('Helvetica').fontSize(7).fillColor('#555555').text("From SocietyLedger records. The cooperative's bank statement is the final word.", left, doc.y);
  return collect(doc);
}
