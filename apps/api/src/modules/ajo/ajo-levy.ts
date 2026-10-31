/**
 * The platform levy formula (T5.4): pure. SocietyLedger's own fee on a group, decided in T0.1.
 *
 *   cycle levy        0.5% of the cycle's total scheduled contributions, at least ₦500.00 and at most ₦5,000.00
 *   participant levy  0.25% of that participant's scheduled contributions for the cycle, at least ₦50.00 and at most ₦1,000.00
 *
 * The rates and limits come from the platform settings and are frozen on each assessment. Starter-tier groups pay none. It is never
 * deducted from contribution money: it is billed to the group admin, separately.
 */
import { formatNaira } from './ajo-collections';
import { roundHalfUp } from './ajo-payout-calc';

/** The levy on `baseKobo`: the rate (basis points) of it, rounded half up, then held between the minimum and the maximum. Nothing scheduled, nothing owed. */
export function levyAmount(baseKobo: bigint, rateBps: number, minKobo: bigint, maxKobo: bigint): bigint {
  if (baseKobo <= 0n || rateBps <= 0) return 0n;
  const raw = roundHalfUp(baseKobo * BigInt(rateBps), 10_000n);
  const floored = raw < minKobo ? minKobo : raw;
  return floored > maxKobo ? maxKobo : floored;
}

/** 50 → "0.5%", 25 → "0.25%", 100 → "1%". */
export function percentOfBps(rateBps: number): string {
  const whole = Math.floor(rateBps / 100);
  const frac = String(rateBps % 100).padStart(2, '0').replace(/0+$/, '');
  return `${whole}${frac ? `.${frac}` : ''}%`;
}

export interface LevyDescription {
  kind: 'CYCLE' | 'PARTICIPANT';
  groupName: string;
  baseKobo: bigint;
  rateBps: number;
  minKobo: bigint;
  maxKobo: bigint;
  amountKobo: bigint;
  /** The participant's name, for a participant levy. */
  who?: string;
}

/** The calculation in words, with every amount in full, so anyone can check it by hand. */
export function describeLevy(d: LevyDescription): string {
  const raw = roundHalfUp(d.baseKobo * BigInt(d.rateBps), 10_000n);
  const what = d.kind === 'CYCLE' ? `Cycle levy for ${d.groupName}` : `Participant levy for ${d.who ?? 'a participant'} in ${d.groupName}`;
  const base = d.kind === 'CYCLE' ? 'the cycle’s scheduled contributions' : 'their scheduled contributions';
  let line = `${what}: ${percentOfBps(d.rateBps)} of ${formatNaira(d.baseKobo)} (${base}) is ${formatNaira(raw)}`;
  if (raw < d.minKobo) line += `, raised to the minimum of ${formatNaira(d.minKobo)}`;
  else if (raw > d.maxKobo) line += `, held to the maximum of ${formatNaira(d.maxKobo)}`;
  return `${line}. Levy: ${formatNaira(d.amountKobo)}.`;
}

/** The free trial add-on a standalone thrift group starts on. It is complimentary, so it is never levied, whatever the exempt list says. */
export const TRIAL_ADDON = 'ajo-trial';

/** Is a group on this add-on tier exempt from the levy? */
export const isLevyExempt = (addonCode: string, exemptCodes: readonly string[]): boolean => addonCode === TRIAL_ADDON || exemptCodes.includes(addonCode);

/** Unpaid levy older than this stops the group's admin starting a new group (and nothing else). */
export const LEVY_OVERDUE_DAYS = 60;
