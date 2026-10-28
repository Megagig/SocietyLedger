/**
 * The pure rules of contributions and collections (T4): no database, no clock. Everything that decides an amount, a split or a message is
 * here so it can be tested exhaustively; the services only move data in and out of it.
 *
 * Money is integer kobo (bigint). Amounts shown to people are always written in full, never shortened.
 */
import { createHash, randomBytes } from 'crypto';

// ---------------------------------------------------------------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------------------------------------------------------------

/** 500000n → "₦5,000.00". Whole-number arithmetic only, so there is no rounding at any size. */
export function formatNaira(kobo: bigint): string {
  const negative = kobo < 0n;
  const abs = negative ? -kobo : kobo;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}₦${whole}.${cents}`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Allocation: oldest installment first
// ---------------------------------------------------------------------------------------------------------------------------------

export interface OpenInstallment {
  id: number;
  dueDate: Date;
  /** What is still owed on it: amount minus paid. */
  remainingKobo: bigint;
}

export interface Allocation {
  installmentId: number;
  amountKobo: bigint;
}

export interface AllocationResult {
  allocations: Allocation[];
  /** What was left after every open installment was covered. Anything above zero means the payment is bigger than the person owes. */
  leftoverKobo: bigint;
}

/** Everything the person still owes in the group. */
export function totalOwed(open: OpenInstallment[]): bigint {
  return open.reduce((sum, i) => sum + (i.remainingKobo > 0n ? i.remainingKobo : 0n), 0n);
}

/**
 * Split a payment across installments, oldest due date first (arrears before anything newer; ties by id so the result never depends on the
 * order the database returned them). An installment is filled before the next one is touched.
 */
export function allocateOldestFirst(open: OpenInstallment[], amountKobo: bigint): AllocationResult {
  if (amountKobo <= 0n) throw new RangeError('A payment must be more than zero.');
  const ordered = [...open].filter((i) => i.remainingKobo > 0n).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.id - b.id);
  const allocations: Allocation[] = [];
  let left = amountKobo;
  for (const installment of ordered) {
    if (left === 0n) break;
    const take = left < installment.remainingKobo ? left : installment.remainingKobo;
    allocations.push({ installmentId: installment.id, amountKobo: take });
    left -= take;
  }
  return { allocations, leftoverKobo: left };
}

/** The status an installment should show for what has been paid against it. */
export function installmentStatusFor(amountKobo: bigint, paidKobo: bigint, dueDate: Date, today: Date): 'DUE' | 'PARTIAL' | 'PAID' | 'OVERDUE' {
  if (paidKobo >= amountKobo) return 'PAID';
  if (paidKobo > 0n) return 'PARTIAL';
  return dueDate.getTime() < today.getTime() ? 'OVERDUE' : 'DUE';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Handover
// ---------------------------------------------------------------------------------------------------------------------------------

export interface CashLine {
  contributionId: number;
  amountKobo: bigint;
}

export const sumLines = (lines: CashLine[]): bigint => lines.reduce((sum, l) => sum + l.amountKobo, 0n);

export interface HandoverFigures {
  collectedKobo: bigint;
  handedOverKobo: bigint;
  /** What the collector still holds: collected minus handed over. Never negative: a collector cannot hand over more than was recorded. */
  differenceKobo: bigint;
}

export function handoverFigures(lines: CashLine[], handedOverKobo: bigint): HandoverFigures {
  if (handedOverKobo < 0n) throw new RangeError('The amount handed over cannot be negative.');
  const collectedKobo = sumLines(lines);
  if (handedOverKobo > collectedKobo) throw new RangeError('More cash was handed over than was recorded. Record the missing payments first.');
  return { collectedKobo, handedOverKobo, differenceKobo: collectedKobo - handedOverKobo };
}

export interface ReconcileCheck {
  receivedIds: number[];
  missingIds: number[];
  receivedKobo: bigint;
  missingKobo: bigint;
}

/**
 * The officer ticks the lines they actually received and states what they counted. The two must agree, or the reconcile is refused: a
 * difference is never allowed to hide inside a total. Returns the split into received and missing lines.
 */
export function checkReconcile(lines: CashLine[], receivedIds: number[], countedKobo: bigint): ReconcileCheck {
  const known = new Set(lines.map((l) => l.contributionId));
  const ticked = new Set(receivedIds);
  for (const id of ticked) if (!known.has(id)) throw new ReconcileError('LINE_NOT_IN_HANDOVER', 'One of the ticked payments is not part of this handover.');
  const received = lines.filter((l) => ticked.has(l.contributionId));
  const missing = lines.filter((l) => !ticked.has(l.contributionId));
  const receivedKobo = sumLines(received);
  if (countedKobo !== receivedKobo) {
    throw new ReconcileError('COUNT_MISMATCH', `The cash counted (${formatNaira(countedKobo)}) does not equal the payments ticked as received (${formatNaira(receivedKobo)}). Untick the payments that were not handed in, or correct the count.`);
  }
  return { receivedIds: received.map((l) => l.contributionId), missingIds: missing.map((l) => l.contributionId), receivedKobo, missingKobo: sumLines(missing) };
}

export class ReconcileError extends Error {
  constructor(readonly code: 'COUNT_MISMATCH' | 'LINE_NOT_IN_HANDOVER', message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// References, proofs
// ---------------------------------------------------------------------------------------------------------------------------------

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I, so a reference read aloud or copied by hand is not mistaken

/** A short reference a contributor can quote: AJO-270301-K7P2QX4M. The date part is only there to help people find it. */
export function newReference(day: Date, random: Buffer = randomBytes(8)): string {
  const yy = String(day.getUTCFullYear()).slice(2);
  const mm = String(day.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(day.getUTCDate()).padStart(2, '0');
  let code = '';
  for (let i = 0; i < 8; i++) code += ALPHABET[random[i] % ALPHABET.length];
  return `AJO-${yy}${mm}${dd}-${code}`;
}

/** SHA-256 of the proof file, as hex. The same screenshot always has the same hash. */
export function hashProof(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** A bank reference compared without regard to case, spaces or dashes, so "TRF 123-ab" and "trf123ab" count as the same. */
export function normaliseBankReference(input: string | null | undefined): string | null {
  const cleaned = (input ?? '').replace(/[\s-]/g, '').toUpperCase();
  return cleaned.length >= 4 ? cleaned.slice(0, 64) : null;
}

export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------------------------------------------------------------

export type ReceiptMoment = 'RECORDED' | 'CONFIRMED' | 'REJECTED' | 'MISSING' | 'REVERSED';

export interface ReceiptFacts {
  moment: ReceiptMoment;
  method: 'CASH' | 'TRANSFER';
  amountKobo: bigint;
  groupName: string;
  reference: string;
  collectorName?: string | null;
  reason?: string | null;
}

/** The receipt in plain words: what, how much (in full), for which group, and the reference to quote. */
export function receiptMessage(f: ReceiptFacts): { title: string; message: string } {
  const amount = formatNaira(f.amountKobo);
  const ref = `Ref ${f.reference}.`;
  switch (f.moment) {
    case 'RECORDED':
      return f.method === 'CASH'
        ? { title: 'Payment received', message: `${amount} received${f.collectorName ? ` by your collector ${f.collectorName}` : ''} for ${f.groupName}. It is awaiting confirmation. ${ref}` }
        : { title: 'Payment reported', message: `Your report of ${amount} for ${f.groupName} was received. It is awaiting confirmation. ${ref}` };
    case 'CONFIRMED':
      return { title: 'Payment confirmed', message: `${amount} for ${f.groupName} is confirmed. Thank you. ${ref}` };
    case 'REJECTED':
      return { title: 'Payment not accepted', message: `Your payment of ${amount} for ${f.groupName} could not be accepted${f.reason ? `: ${f.reason}` : '.'} ${ref}` };
    case 'MISSING':
      return { title: 'Payment still being checked', message: `${amount} you gave your collector for ${f.groupName} has not reached the group yet. Keep this message as proof. The officer is following it up. ${ref}` };
    case 'REVERSED':
      return { title: 'Payment reversed', message: `${amount} for ${f.groupName} was reversed${f.reason ? `: ${f.reason}` : '.'} ${ref}` };
  }
}

/**
 * Should a contributor with no login (so SMS is their only channel) be texted for this moment? The text at recording is the proof they
 * need in hand, and anything that went wrong must reach them. Routine confirmation goes by push or email only, which halves the credits
 * a daily-thrift group spends on receipts.
 */
export function smsForMoment(moment: ReceiptMoment): boolean {
  return moment !== 'CONFIRMED';
}
