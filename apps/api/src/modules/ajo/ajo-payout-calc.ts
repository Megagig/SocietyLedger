/**
 * The payout calculation (T5.1): pure, no database, no clock. It answers one question: given what a round (or a participant's cycle) was
 * scheduled to bring in, what has actually been confirmed, and what has already been planned or paid out of it, how much can be paid now?
 *
 *   gross      what was scheduled
 *   shortfall  gross minus confirmed: the part that has not come in. Shown, never hidden.
 *   fee        the collector's fee, worked out on everything confirmed so far, and taken only once across all payouts of the round
 *   net        confirmed minus the fee, minus whatever earlier payouts of the round already took
 *
 * So the recipient is never promised money the group does not have, and late money simply makes a later (supplementary) payout possible.
 */
import { formatNaira } from './ajo-collections';

export type FeeType = 'NONE' | 'FIXED' | 'PERCENT' | 'DAYS';

/** Half-up integer division of non-negative numbers. */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('The denominator must be more than zero.');
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/**
 * The collector's fee on `confirmedKobo`. It can never be more than the money there is.
 *   FIXED    a fixed amount in kobo
 *   PERCENT  basis points of the confirmed money (100 = 1%)
 *   DAYS     that many days of the recipient's own contribution (the usual "one day's contribution" collector fee)
 */
export function collectorFeeFor(type: FeeType, value: bigint, confirmedKobo: bigint, perInstallmentKobo: bigint): bigint {
  if (confirmedKobo <= 0n || value <= 0n) return 0n;
  let fee: bigint;
  switch (type) {
    case 'NONE':
      return 0n;
    case 'FIXED':
      fee = value;
      break;
    case 'PERCENT':
      fee = roundHalfUp(confirmedKobo * value, 10_000n);
      break;
    case 'DAYS':
      fee = value * perInstallmentKobo;
      break;
    default:
      return 0n;
  }
  return fee > confirmedKobo ? confirmedKobo : fee;
}

/** A payout of the same round (or cycle) that is still standing: prepared, approved or paid. Void and reversed ones are not. */
export interface EarlierPayout {
  netKobo: bigint;
  feeKobo: bigint;
}

export interface PayoutInput {
  /** What the round (or the participant's cycle) was scheduled to bring in. Waived instalments are not scheduled. */
  scheduledKobo: bigint;
  /** What has been confirmed against it, counting reversals. */
  confirmedKobo: bigint;
  feeType: FeeType;
  feeValue: bigint;
  /** The recipient's own amount for one instalment (contribution times shares), used by a fee in days. */
  perInstallmentKobo: bigint;
  earlier: EarlierPayout[];
}

export interface PayoutFigures {
  grossKobo: bigint;
  shortfallKobo: bigint;
  confirmedKobo: bigint;
  /** The whole fee on everything confirmed so far. */
  totalFeeKobo: bigint;
  /** The part of the fee this payout takes. */
  feeKobo: bigint;
  netKobo: bigint;
  /** What earlier payouts of this round have already planned or paid. */
  earlierNetKobo: bigint;
  canPay: boolean;
  /** The calculation in words, with every amount in full. */
  explanation: string[];
}

export function calculatePayout(input: PayoutInput): PayoutFigures {
  const { scheduledKobo, confirmedKobo } = input;
  const confirmed = confirmedKobo > 0n ? confirmedKobo : 0n;
  const shortfallKobo = scheduledKobo > confirmed ? scheduledKobo - confirmed : 0n;

  const earlierNetKobo = input.earlier.reduce((s, p) => s + p.netKobo, 0n);
  const earlierFeeKobo = input.earlier.reduce((s, p) => s + p.feeKobo, 0n);

  const totalFeeKobo = collectorFeeFor(input.feeType, input.feeValue, confirmed, input.perInstallmentKobo);
  const available = confirmed - earlierNetKobo - earlierFeeKobo;
  const wanted = totalFeeKobo - earlierFeeKobo;
  const feeKobo = available <= 0n ? 0n : wanted <= 0n ? 0n : wanted > available ? available : wanted;
  const netKobo = available - feeKobo;

  const explanation = [`Scheduled ${formatNaira(scheduledKobo)}, confirmed ${formatNaira(confirmed)}.`];
  if (shortfallKobo > 0n) explanation.push(`Shortfall ${formatNaira(shortfallKobo)}: this has not been confirmed yet, so it is not paid.`);
  if (earlierNetKobo > 0n) explanation.push(`${formatNaira(earlierNetKobo)} has already been planned or paid for this round.`);
  if (feeKobo > 0n) explanation.push(`Collector fee ${formatNaira(feeKobo)}.`);
  explanation.push(netKobo > 0n ? `To pay now: ${formatNaira(netKobo)}.` : 'There is nothing to pay at the moment.');

  return { grossKobo: scheduledKobo, shortfallKobo, confirmedKobo: confirmed, totalFeeKobo, feeKobo, netKobo: netKobo > 0n ? netKobo : 0n, earlierNetKobo, canPay: netKobo > 0n, explanation };
}
