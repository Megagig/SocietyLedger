/**
 * The circle statement (spec §16.4.10): a PDF any member of a rotating pot can download and share in the group's chat. It is built from the
 * same board views a member sees on screen, so it matches the board on the day it is made and can show nothing the board does not show:
 * names follow the circle's name rule, and there is no phone, email, address, bank account, guarantor detail, note or proof.
 *
 * Each statement carries a random code. Anyone holding the statement can open the verification page, which says when it was made and
 * whether the circle's figures still match it. That page shows circle totals only, never a name.
 */
import { randomBytes } from 'crypto';
import PDFDocument from 'pdfkit';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { boardActivity, boardMatrix, boardMetrics, boardOverview, boardPayouts, type BoardViewer } from './ajo-board.service';
import { formatNaira } from './ajo-collections';
import { STATUS_LABEL, type PaymentStatus } from './ajo-status';

const ngn = (kobo: string | bigint) => formatNaira(BigInt(kobo)).replace('₦', 'NGN ');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0, O, 1, I: easy to read out and to type

/** A short, unguessable code: ten characters from a 32-letter alphabet, printed as two groups of five. */
export function newStatementCode(bytes: Buffer = randomBytes(10)): string {
  const chars = Array.from(bytes.subarray(0, 10), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}
/** A code as people type it: any case, with or without the dash. Returns null if it cannot be one of ours. */
export function normaliseCode(input: string): string | null {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 10 || [...clean].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}

/** One letter per status for the matrix: text, never colour alone, so it reads in print and in a photo of a printout. */
const LETTER: Record<PaymentStatus, string> = { PAID_ON_TIME: 'P', PAID_LATE: 'L', REPORTED: 'R', DUE: 'D', OVERDUE: 'O', MISSED: 'M', UNDER_REVIEW: 'U', WAIVED: 'W', UPCOMING: '-' };

export interface CircleSnapshot {
  round: number;
  totalRounds: number;
  collectedKobo: string;
  expectedKobo: string;
  paidCount: number;
  expectedCount: number;
  payoutsRecordedCount: number;
  payoutsRecordedKobo: string;
  recordedBalanceKobo: string;
  members: number;
}

/** The circle's headline figures, as the board shows them. Used for the printed statement and again by the verification page. */
async function snapshotOf(input: { associationId: number; groupId: number; viewer: BoardViewer; now: Date }): Promise<{ snapshot: CircleSnapshot; groupName: string; timezone: string }> {
  const o = await boardOverview(input);
  const m = await boardMetrics(input);
  return {
    groupName: o.header.name,
    timezone: o.header.timezone,
    snapshot: {
      round: o.header.round,
      totalRounds: o.header.totalRounds,
      collectedKobo: o.thisRound.collectedKobo,
      expectedKobo: o.thisRound.expectedKobo,
      paidCount: o.thisRound.paidCount,
      expectedCount: o.thisRound.expectedCount,
      payoutsRecordedCount: o.health.payoutsRecordedCount,
      payoutsRecordedKobo: o.health.payoutsRecordedKobo,
      recordedBalanceKobo: m.recordedBalance.kobo,
      members: m.membersUpToDate.total,
    },
  };
}

const stamp = (d: Date, tz: string) => d.toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
const when = (iso: string | null, tz: string) => (iso ? new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }) : '');
const dayText = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/** Make the statement for a circle, as the viewer is allowed to see it (members and officers; the board's own access rules apply). */
export async function makeCircleStatement(input: { associationId: number; groupId: number; viewer: BoardViewer; now?: Date; verifyBaseUrl?: string; compress?: boolean }): Promise<{ file: Buffer; name: string; code: string }> {
  const now = input.now ?? new Date();
  const base = { associationId: input.associationId, groupId: input.groupId, viewer: input.viewer, now };
  // The board's own functions do the access checks (member of the circle or officer, board on, rotating pot only) and build the figures.
  const [overview, matrix, payouts, activity, snap] = await Promise.all([boardOverview(base), boardMatrix(base), boardPayouts(base), boardActivity({ ...base, limit: 12 }), snapshotOf(base)]);

  let code = newStatementCode();
  for (let attempt = 0; ; attempt += 1) {
    try {
      await prisma.ajoStatementCode.create({ data: { associationId: input.associationId, groupId: input.groupId, code, generatedBy: input.viewer.userId || null, generatedAt: now, snapshot: snap.snapshot as never } });
      break;
    } catch (error) {
      if (attempt >= 4) throw error;
      code = newStatementCode();
    }
  }
  const tz = snap.timezone;
  const url = `${(input.verifyBaseUrl ?? process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/+$/, '')}/verify/circle/${code}`;

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, compress: input.compress ?? true, info: { Title: `Circle statement, ${snap.groupName}` } });
  const left = doc.page.margins.left;
  const usable = doc.page.width - left - doc.page.margins.right;

  doc.font('Helvetica-Bold').fontSize(18).text(snap.groupName);
  doc.font('Helvetica').fontSize(10).text(`Circle statement · ${stamp(now, tz)} (${tz})`);
  doc.text(`Round ${overview.header.round} of ${overview.header.totalRounds} · ${ngn(overview.header.contributionPerShareKobo)} per share, ${overview.header.cadence} · ${dayText(overview.header.startDate)}${overview.header.endsOn ? ` to ${dayText(overview.header.endsOn)}` : ''}`);
  doc.moveDown(0.5);

  const s = snap.snapshot;
  doc.font('Helvetica-Bold').fontSize(11).text('The circle now');
  doc.font('Helvetica').fontSize(10);
  doc.text(`This round: ${ngn(s.collectedKobo)} of ${ngn(s.expectedKobo)} collected (${s.paidCount} of ${s.expectedCount} paid)`);
  doc.text(`Payouts recorded: ${s.payoutsRecordedCount}, ${ngn(s.payoutsRecordedKobo)}`);
  doc.text(`Recorded balance: ${ngn(s.recordedBalanceKobo)}. From SocietyLedger records; your group's bank statement is the final word.`);
  doc.moveDown(0.6);

  // ---- the payment matrix: members down, rounds across
  doc.font('Helvetica-Bold').fontSize(11).text('Payment history');
  doc.moveDown(0.2);
  const MAX_ROUNDS = 36;
  const rounds = matrix.rounds.slice(-MAX_ROUNDS);
  const nameW = 130;
  const cellW = Math.min(16, Math.floor((usable - nameW - 60) / Math.max(rounds.length, 1)));
  const head = () => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).text('Member', left, y, { width: nameW, lineBreak: false });
    rounds.forEach((r, i) => doc.text(String(r.round), left + nameW + i * cellW, y, { width: cellW, align: 'center', lineBreak: false }));
    doc.text('Paid/due', left + nameW + rounds.length * cellW + 6, y, { lineBreak: false });
    doc.y = y + 12;
  };
  head();
  for (const m of matrix.members) {
    if (doc.y > doc.page.height - 60) {
      doc.addPage();
      head();
    }
    const y = doc.y;
    doc.font('Helvetica').fontSize(8).text(m.isYou ? `${m.name} (you)` : m.name, left, y, { width: nameW - 6, lineBreak: false, ellipsis: true });
    for (const [i, r] of rounds.entries()) {
      const cell = m.cells.find((c) => c.round === r.round);
      doc.text(cell ? LETTER[cell.status] : '', left + nameW + i * cellW, y, { width: cellW, align: 'center', lineBreak: false });
    }
    doc.text(`${m.roundsPaid}/${m.roundsDue}`, left + nameW + rounds.length * cellW + 6, y, { lineBreak: false });
    doc.y = y + 11;
  }
  doc.moveDown(0.3);
  doc.fontSize(7).fillColor('#444444').text(`Key: ${(Object.keys(LETTER) as PaymentStatus[]).map((k) => `${LETTER[k]} = ${STATUS_LABEL[k]}`).join('   ')}`, left, doc.y, { width: usable });
  if (matrix.rounds.length > MAX_ROUNDS) doc.text(`Showing the latest ${MAX_ROUNDS} of ${matrix.rounds.length} rounds.`);
  doc.fillColor('#000000').moveDown(0.8);

  // ---- payouts
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.font('Helvetica-Bold').fontSize(11).text('Payouts');
  doc.moveDown(0.2);
  const cols = [38, 120, 80, 150, 90, 220];
  const row = (values: string[], bold = false) => {
    if (doc.y > doc.page.height - 50) doc.addPage();
    const y = doc.y;
    let x = left;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    values.forEach((v, i) => {
      doc.text(v, x, y, { width: cols[i] - 6, lineBreak: false, ellipsis: true });
      x += cols[i];
    });
    doc.y = y + 11;
  };
  row(['Pos.', 'Recipient', 'Scheduled', 'Status', 'Pot', 'Recorded'], true);
  for (const p of payouts.rows) {
    row([String(p.position), p.isYou ? `${p.recipient} (you)` : p.recipient, dayText(p.scheduledOn), p.holdReason ? `${p.status}: ${p.holdReason}` : p.status, ngn(p.potKobo), p.recordedAt ? `${when(p.recordedAt, tz)}${p.referenceLast4 ? ` ref ••${p.referenceLast4}` : ''}${p.approvedBy ? ` approved by ${p.approvedBy}` : ''}` : '']);
  }
  doc.moveDown(0.8);

  // ---- what happened lately
  if (activity.entries.length > 0) {
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(11).text('Recent activity');
    doc.font('Helvetica').fontSize(8);
    for (const e of activity.entries) doc.text(`${when(e.at, tz)}  ${e.text}`, left, doc.y, { width: usable });
    doc.moveDown(0.8);
  }

  doc.font('Helvetica-Bold').fontSize(9).text(`Verification code: ${code}`, left, doc.y);
  doc.font('Helvetica').fontSize(8).fillColor('#444444').text(`Check this statement against the live record at ${url}`);
  doc.text('Dates and times are in the circle\'s timezone. Members who have not accepted the circle board rule appear as "Member" and a number.');
  const file = await collect(doc);
  return { file, name: `circle-statement-${snap.groupName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'circle'}-${now.toISOString().slice(0, 10)}.pdf`, code };
}

const sameFigures = (a: CircleSnapshot, b: CircleSnapshot): boolean =>
  a.round === b.round && a.collectedKobo === b.collectedKobo && a.expectedKobo === b.expectedKobo && a.paidCount === b.paidCount && a.payoutsRecordedCount === b.payoutsRecordedCount && a.payoutsRecordedKobo === b.payoutsRecordedKobo && a.recordedBalanceKobo === b.recordedBalanceKobo;

/**
 * What the verification page shows to anyone holding a code: when the statement was made, the figures it printed, and the circle's figures
 * now. Totals only; never a name. A wrong or malformed code gets the same answer, so it tells a guesser nothing.
 */
export async function verifyCircleStatement(rawCode: string, now: Date = new Date()) {
  const notFound = () => new RuleError('That code was not found. Check it matches the one printed on the statement.', 404, 'CODE_NOT_FOUND');
  const code = normaliseCode(rawCode);
  if (!code) throw notFound();
  const row = await prisma.ajoStatementCode.findUnique({ where: { code } });
  if (!row) throw notFound();
  // Read the live figures as the circle's own officers would, so a circle whose board is off still verifies its own statements.
  const live = await snapshotOf({ associationId: row.associationId, groupId: row.groupId, viewer: { userId: 0, isOfficer: true }, now });
  const printed = row.snapshot as unknown as CircleSnapshot;
  return {
    code,
    groupName: live.groupName,
    timezone: live.timezone,
    generatedAt: row.generatedAt,
    printed,
    current: live.snapshot,
    matches: sameFigures(printed, live.snapshot),
  };
}
