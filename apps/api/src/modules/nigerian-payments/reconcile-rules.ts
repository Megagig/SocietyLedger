import { Decimal } from '@prisma/client/runtime/library';
import { RuleError } from '../finance/rule-error';

/**
 * How a line of money in at the bank is matched to a charge. Pure: no database here.
 *
 * A line is only ever matched to a charge it can actually pay: not more than what the charge still owes after the matches already
 * waiting. Only a reference in the narration, or the member's name or their own declared transfer, together with the amount, counts as
 * a confident match; an amount alone is a weak hint and is left for the officer to decide.
 */

/** A line from the statement, or a transfer a member declared and an officer verified: money that arrived in the bank. */
export type MoneyIn = {
  key: string; // "entry:12" or "transfer:3"
  source: 'entry' | 'transfer';
  id: number;
  amount: Decimal;
  reference: string | null;
  description: string;
  date: Date;
  /** Set when the line is a member's own declared transfer. */
  memberId: number | null;
};

export type OpenCharge = {
  id: number;
  referenceNumber: string | null;
  memberId: number;
  firstName: string;
  lastName: string;
  /** What the charge still owes: its amount, less payments, less the matches already waiting for confirmation. */
  available: Decimal;
};

export type MatchKind = 'AUTO_REFERENCE' | 'AUTO_AMOUNT';

export type Suggestion = {
  line: MoneyIn;
  charge: OpenCharge;
  confidence: number;
  kind: MatchKind;
  reasons: string[];
  /** Confident enough to be ticked by default. Everything else waits for the officer. */
  recommended: boolean;
};

/** Confidence at or above this is ticked by default. */
export const RECOMMENDED_AT = 85;

const alnum = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const words = (s: string | null | undefined) => (s ?? '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3);

/** How well a line fits a charge, or null when it can't pay it (it is more than the charge still owes). */
export function scoreMatch(line: MoneyIn, charge: OpenCharge): { confidence: number; kind: MatchKind; reasons: string[] } | null {
  if (line.amount.lessThanOrEqualTo(0) || line.amount.greaterThan(charge.available)) return null;

  const reasons: string[] = [];
  const reference = alnum(charge.referenceNumber);
  const haystack = alnum(line.description) + alnum(line.reference);
  const refHit = reference.length >= 5 && haystack.includes(reference);

  const text = new Set(words(line.description).concat(words(line.reference)));
  const nameHit =
    (line.memberId !== null && line.memberId === charge.memberId) ||
    (words(charge.firstName).length > 0 && words(charge.lastName).length > 0 && words(charge.firstName).every((w) => text.has(w)) && words(charge.lastName).every((w) => text.has(w)));

  const exact = line.amount.equals(charge.available);

  if (refHit) reasons.push('Its reference is in the narration');
  if (nameHit) reasons.push(line.memberId !== null ? 'Declared by this member' : 'The member’s name is in the narration');
  if (exact) reasons.push('The amount is exactly what is owed');
  else reasons.push('Part of what is owed');

  if (refHit && exact) return { confidence: 100, kind: 'AUTO_REFERENCE', reasons };
  if (refHit) return { confidence: 90, kind: 'AUTO_REFERENCE', reasons };
  if (nameHit && exact) return { confidence: 90, kind: 'AUTO_AMOUNT', reasons };
  if (nameHit) return { confidence: 60, kind: 'AUTO_AMOUNT', reasons };
  if (exact) return { confidence: 40, kind: 'AUTO_AMOUNT', reasons };
  return null;
}

/**
 * Proposes the best matches, each line used once and each charge never over-filled. The most confident pairs are taken first.
 * An amount that fits several charges equally is not guessed at: with no name or reference to tell them apart, it is left out.
 */
export function rankSuggestions(lines: MoneyIn[], charges: OpenCharge[]): Suggestion[] {
  const pairs: Suggestion[] = [];
  for (const line of lines) {
    const scored = charges
      .map((charge) => ({ charge, fit: scoreMatch(line, charge) }))
      .filter((p): p is { charge: OpenCharge; fit: NonNullable<ReturnType<typeof scoreMatch>> } => p.fit !== null);

    // Amount-only fits are only offered when exactly one charge is that amount
    const weak = scored.filter((p) => p.fit.confidence <= 40);
    const strong = scored.filter((p) => p.fit.confidence > 40);
    const usable = strong.length > 0 ? strong : weak.length === 1 ? weak : [];

    for (const p of usable) {
      pairs.push({ line, charge: p.charge, confidence: p.fit.confidence, kind: p.fit.kind, reasons: p.fit.reasons, recommended: p.fit.confidence >= RECOMMENDED_AT });
    }
  }

  pairs.sort((a, b) => b.confidence - a.confidence || a.line.date.getTime() - b.line.date.getTime());

  const used = new Set<string>();
  const left = new Map<number, Decimal>(charges.map((c) => [c.id, c.available]));
  const chosen: Suggestion[] = [];
  for (const pair of pairs) {
    if (used.has(pair.line.key)) continue;
    const remaining = left.get(pair.charge.id) ?? new Decimal(0);
    if (pair.line.amount.greaterThan(remaining)) continue;
    used.add(pair.line.key);
    left.set(pair.charge.id, remaining.minus(pair.line.amount));
    chosen.push(pair);
  }
  return chosen;
}

// ---------------------------------------------------------------- the rules a match must keep

/** The amount a charge still owes after payments, and after the matches waiting to be confirmed. */
export function availableOn(amount: Decimal.Value, paid: Decimal.Value, reserved: Decimal.Value): Decimal {
  return new Decimal(amount).minus(paid).minus(reserved);
}

export function assertChargeOpen(charge: { isVoided: boolean; status: string; member: { status: string } }, available: Decimal): void {
  if (charge.isVoided) throw new RuleError('This charge was cancelled, so it can’t be paid.', 409, 'CHARGE_NOT_OPEN');
  if (charge.status === 'waived') throw new RuleError('This charge was waived, so nothing is owed on it.', 409, 'CHARGE_NOT_OPEN');
  if (charge.member.status === 'terminated') throw new RuleError('This member was disabled, so the charge can’t be paid.', 409, 'CHARGE_NOT_OPEN');
  if (available.lessThanOrEqualTo(0)) throw new RuleError('Nothing more is owed on this charge, or a payment for all of it is already waiting to be confirmed.', 409, 'CHARGE_NOT_OPEN');
}

export function assertLineFits(amount: Decimal, available: Decimal): void {
  if (amount.greaterThan(available)) {
    throw new RuleError(`This bank line is ₦${amount.toFixed(2)}, but the charge only has ₦${available.toFixed(2)} left to pay.`, 409, 'LINE_TOO_LARGE');
  }
}

/** Whoever proposed a match can't also confirm it: a second officer has to look at it. */
export function assertNotOwnMatch(createdBy: number | null, userId: number): void {
  if (createdBy !== null && createdBy === userId) {
    throw new RuleError('You proposed this match, so another officer has to confirm it.', 403, 'OWN_MATCH');
  }
}

/** A charge that has been paid all that it owes is paid; one with something still owed is part paid. */
export function statusAfterPayment(amount: Decimal.Value, paidAfter: Decimal.Value): 'paid' | 'partial' {
  return new Decimal(paidAfter).greaterThanOrEqualTo(amount) ? 'paid' : 'partial';
}
