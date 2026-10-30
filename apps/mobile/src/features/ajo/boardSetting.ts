/**
 * Whether a rotating pot's Circle board is on for its members, worked out from the rule versions. The board follows the rules in effect,
 * and a rule change takes effect only after its notice period, so "off" can mean "off now, turns on on a date".
 */
export type BoardSetting =
  | { state: 'ON' }
  | { state: 'OFF' }
  | { state: 'TURNS_ON'; on: string }
  | { state: 'TURNS_OFF'; on: string };

type VersionLike = { effectiveFrom: string; rules: { memberVisibility: 'FULL' | 'OFF' } };

export function boardSetting(versions: readonly VersionLike[], now: Date = new Date()): BoardSetting {
  const sorted = [...versions].sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());
  const inEffect = sorted.filter((v) => new Date(v.effectiveFrom).getTime() <= now.getTime());
  const current = inEffect[inEffect.length - 1] ?? sorted[0];
  const on = current?.rules.memberVisibility === 'FULL';
  // The first later version that changes the answer.
  const later = sorted.find((v) => new Date(v.effectiveFrom).getTime() > now.getTime() && (v.rules.memberVisibility === 'FULL') !== on);
  if (later) return { state: on ? 'TURNS_OFF' : 'TURNS_ON', on: later.effectiveFrom };
  return { state: on ? 'ON' : 'OFF' };
}
