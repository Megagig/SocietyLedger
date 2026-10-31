/**
 * A saver's own statement for one savings cycle, as a PDF or a CSV, and a receipt for one confirmed payment (spec §16.6, 5.8).
 * Their own records only. The statement says it is from SocietyLedger's records, not the bank's.
 *
 * Money is shown in full. The PDF uses "NGN" because the built-in PDF fonts have no naira sign; the CSV uses ₦ and opens in a
 * spreadsheet as UTF-8.
 */
import PDFDocument from 'pdfkit';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { formatNaira } from './ajo-collections';
import { getPayments, getSavings } from './ajo-savings.service';

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');
const stamp = (d: Date | null | undefined, tz: string) => (d ? d.toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }) : '');
const ngn = (kobo: string | bigint) => formatNaira(BigInt(kobo)).replace('₦', 'NGN ');

export interface StatementData {
  groupName: string;
  saverName: string;
  cycleNo: number;
  timezone: string;
  startsOn: string;
  endsOn: string | null;
  amountKobo: string;
  generatedAt: Date;
  summary: { savedKobo: string; carriedKobo: string; feeKobo: string; receiveKobo: string; feeText: string };
  days: Array<{ dueDate: string; amountKobo: string; paidKobo: string; label: string; datePaid: string | null }>;
  payments: Array<{ receivedAt: Date; amountKobo: string; method: string; label: string; receiptNumber: string }>;
}

/** Everything one cycle's statement needs, for the saver's own membership. Only the running cycle can be asked for today. */
export async function buildStatement(input: { associationId: number; membershipId: number; now?: Date }): Promise<StatementData> {
  const now = input.now ?? new Date();
  const m = await prisma.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, include: { group: true, member: { select: { firstName: true, lastName: true } } } });
  if (!m) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  const s = await getSavings({ associationId: input.associationId, membershipId: input.membershipId, now });
  const p = await getPayments({ associationId: input.associationId, membershipId: input.membershipId });
  const cycleStart = new Date(`${s.startsOn}T00:00:00.000Z`);
  return {
    groupName: s.groupName,
    saverName: `${m.member.firstName} ${m.member.lastName}`.trim(),
    cycleNo: s.cycleNo,
    timezone: s.timezone,
    startsOn: s.startsOn,
    endsOn: s.endsOn,
    amountKobo: s.amountKobo,
    generatedAt: now,
    summary: { savedKobo: s.saved.savedKobo, carriedKobo: s.saved.carriedKobo, feeKobo: s.receive.feeKobo, receiveKobo: s.receive.netKobo, feeText: s.receive.feeText },
    days: s.calendar.map((d) => ({ dueDate: d.dueDate, amountKobo: d.amountKobo, paidKobo: d.paidKobo, label: d.label, datePaid: d.datePaid })),
    payments: p.payments.filter((x) => x.receivedAt.getTime() >= cycleStart.getTime() - 24 * 3600_000).map((x) => ({ receivedAt: x.receivedAt, amountKobo: x.amountKobo, method: x.method, label: x.label, receiptNumber: x.receiptNumber })),
  };
}

/** A spreadsheet-safe cell: quoted, and a leading = + - @ is neutralised so a name cannot run as a formula. */
export function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function statementCsv(d: StatementData): string {
  const lines: string[] = [];
  const row = (...cols: Array<string | number | null | undefined>) => lines.push(cols.map(csvCell).join(','));
  row('Statement', d.groupName);
  row('Saver', d.saverName);
  row('Cycle', d.cycleNo);
  row('Period', `${d.startsOn} to ${d.endsOn ?? ''}`);
  row('You save each time', formatNaira(BigInt(d.amountKobo)));
  row('Saved so far', formatNaira(BigInt(d.summary.savedKobo)));
  row('Brought forward', formatNaira(BigInt(d.summary.carriedKobo)));
  row('Collector fee', formatNaira(BigInt(d.summary.feeKobo)));
  row('You will receive', formatNaira(BigInt(d.summary.receiveKobo)));
  row('Generated', stamp(d.generatedAt, d.timezone), 'From SocietyLedger records. The bank statement is the final word.');
  lines.push('');
  row('Due date', 'Amount due', 'Paid', 'Status', 'Date paid');
  for (const x of d.days) row(x.dueDate, formatNaira(BigInt(x.amountKobo)), formatNaira(BigInt(x.paidKobo)), x.label, x.datePaid ?? '');
  lines.push('');
  row('Received', 'Amount', 'Method', 'Status', 'Receipt number');
  for (const x of d.payments) row(stamp(x.receivedAt, d.timezone), formatNaira(BigInt(x.amountKobo)), x.method === 'CASH' ? 'Cash' : 'Transfer', x.label, x.receiptNumber);
  return `﻿${lines.join('\r\n')}\r\n`;
}

function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export function statementPdf(d: StatementData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Statement, ${d.groupName}, cycle ${d.cycleNo}` } });
  doc.font('Helvetica-Bold').fontSize(18).text(d.groupName);
  doc.font('Helvetica').fontSize(11).text(`Savings statement, cycle ${d.cycleNo}`);
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Saver: ${d.saverName}`);
  doc.text(`Period: ${d.startsOn} to ${d.endsOn ?? ''}`);
  doc.text(`Generated: ${stamp(d.generatedAt, d.timezone)} (${d.timezone})`);
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(12).text('Your savings');
  doc.font('Helvetica').fontSize(10);
  for (const [label, value] of [
    ['You save each time', ngn(d.amountKobo)],
    ['Saved so far', ngn(d.summary.savedKobo)],
    ['Brought forward', ngn(d.summary.carriedKobo)],
    [`Collector fee (${d.summary.feeText.replace(/\.$/, '')})`, ngn(d.summary.feeKobo)],
    ['You will receive', ngn(d.summary.receiveKobo)],
  ]) {
    doc.text(`${label}: ${value}`);
  }
  doc.moveDown(0.8);

  const table = (title: string, head: string[], widths: number[], rows: string[][]) => {
    doc.font('Helvetica-Bold').fontSize(12).text(title);
    doc.moveDown(0.3);
    const line = (cols: string[], bold: boolean) => {
      if (doc.y > doc.page.height - 80) doc.addPage();
      const y = doc.y;
      let x = doc.page.margins.left;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      cols.forEach((c, i) => {
        doc.text(c, x, y, { width: widths[i] - 6, lineBreak: false, ellipsis: true });
        x += widths[i];
      });
      doc.y = y + 14;
    };
    line(head, true);
    for (const r of rows) line(r, false);
    doc.moveDown(0.8);
  };
  table('What fell due', ['Due date', 'Amount due', 'Paid', 'Status', 'Date paid'], [80, 100, 100, 150, 70], d.days.map((x) => [x.dueDate, ngn(x.amountKobo), ngn(x.paidKobo), x.label, x.datePaid ?? '']));
  table('Payments recorded', ['Received', 'Amount', 'Method', 'Status', 'Receipt number'], [110, 90, 60, 130, 110], d.payments.map((x) => [stamp(x.receivedAt, d.timezone), ngn(x.amountKobo), x.method === 'CASH' ? 'Cash' : 'Transfer', x.label, x.receiptNumber]));

  doc.font('Helvetica').fontSize(8).fillColor('#555555').text("From SocietyLedger records. Your group's bank statement is the final word.", { align: 'left' });
  return collect(doc);
}

/** A receipt for one confirmed payment: the saver's own, or an officer's view of it. */
export async function receiptPdf(input: { associationId: number; contributionId: number; viewerUserId: number; viewerIsOfficer: boolean }): Promise<{ file: Buffer; name: string }> {
  const c = await prisma.ajoContribution.findFirst({
    where: { id: input.contributionId, associationId: input.associationId },
    include: { reversedBy: { select: { id: true } }, group: { select: { name: true, timezone: true } }, membership: { select: { member: { select: { firstName: true, lastName: true, userId: true } } } } },
  });
  if (!c || (!input.viewerIsOfficer && c.membership.member.userId !== input.viewerUserId)) throw new RuleError('That payment was not found.', 404, 'CONTRIBUTION_NOT_FOUND');
  if (c.status !== 'CONFIRMED' || c.reversedBy !== null || c.reversalOfId !== null) throw new RuleError('A receipt is available once a payment has been confirmed.', 409, 'NOT_CONFIRMED');
  const by = c.confirmedBy ? await prisma.member.findFirst({ where: { associationId: input.associationId, userId: c.confirmedBy }, select: { firstName: true, lastName: true } }) : null;
  const tz = c.group.timezone;

  const doc = new PDFDocument({ size: 'A5', margin: 40, info: { Title: `Receipt ${c.reference}` } });
  doc.font('Helvetica-Bold').fontSize(16).text('Payment receipt');
  doc.font('Helvetica').fontSize(11).text(c.group.name);
  doc.moveDown(0.8);
  doc.fontSize(10);
  for (const [label, value] of [
    ['Receipt number', c.reference],
    ['Saver', `${c.membership.member.firstName} ${c.membership.member.lastName}`.trim()],
    ['Amount', ngn(c.amountKobo)],
    ['Method', c.method === 'CASH' ? 'Cash to your collector' : 'Bank transfer'],
    ['Received', stamp(c.receivedAt, tz)],
    ['Confirmed', stamp(c.confirmedAt, tz)],
    ['Confirmed by', by ? `${by.firstName} ${by.lastName.charAt(0)}.` : 'The office'],
  ]) {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(String(value));
  }
  doc.moveDown(1);
  doc.fontSize(8).fillColor('#555555').text(`Times are in ${tz}. From SocietyLedger records, not a bank receipt.`);
  return { file: await collect(doc), name: `receipt-${c.reference}.pdf` };
}

export const statementFileName = (d: StatementData, ext: 'pdf' | 'csv') => `statement-cycle-${d.cycleNo}-${iso(d.generatedAt)}.${ext}`;
