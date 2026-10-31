/**
 * The rotating-pot draw (T3.7): pure and reproducible. The same seed and the same slots always give the same order, so the saved seed lets
 * anyone check the result. Nothing here reads a clock or the database.
 *
 * The shuffle is Fisher–Yates over a stream of numbers made by hashing `seed:counter` with SHA-256, with rejection sampling so no
 * position is slightly more likely than another.
 */
import { createHash, randomBytes } from 'crypto';

export interface SlotKey {
  membershipId: number;
  /** 1..shares for that membership. */
  shareNo: number;
}

export interface PlacedSlot extends SlotKey {
  position: number;
}

/** A fresh 128-bit seed, as hex. The server makes it; an admin cannot pick one. */
export function newSeed(): string {
  return randomBytes(16).toString('hex');
}

const slotId = (s: SlotKey) => `${s.membershipId}:${s.shareNo}`;

/** The same slots in one fixed order, so a draw does not depend on the order the database returned them. */
export function canonicalSlots(slots: SlotKey[]): SlotKey[] {
  return [...slots].sort((a, b) => a.membershipId - b.membershipId || a.shareNo - b.shareNo);
}

/** A fingerprint of who holds how many shares. If it differs from the fingerprint stored with the last draw, that draw is out of date. */
export function rosterFingerprint(slots: SlotKey[]): string {
  return createHash('sha256').update(canonicalSlots(slots).map(slotId).join('|')).digest('hex');
}

/** Numbers from a seed. Each hash gives eight 32-bit numbers; the counter makes the next hash. */
function stream(seed: string) {
  let counter = 0;
  let buffer: Buffer = Buffer.alloc(0);
  let offset = 0;
  const next32 = (): number => {
    if (offset + 4 > buffer.length) {
      buffer = createHash('sha256').update(`${seed}:${counter++}`).digest();
      offset = 0;
    }
    const n = buffer.readUInt32BE(offset);
    offset += 4;
    return n;
  };
  /** A fair whole number in [0, bound). */
  const below = (bound: number): number => {
    const limit = 0x100000000 - (0x100000000 % bound);
    let n = next32();
    while (n >= limit) n = next32();
    return n % bound;
  };
  return { below };
}

/** Fisher–Yates driven by the seed. Returns a new array. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rand = stream(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand.below(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface OrderSlot {
  id: number;
  position: number;
}

export interface PositionChange {
  id: number;
  from: number;
  to: number;
}

/**
 * An emergency exception (T3.7): move one slot that has not been paid to another position that has not been paid. The slots in between
 * shift by one place, keeping their order, and every position that has been paid stays exactly where it is. Throws a RangeError with a
 * readable message when the move is not allowed.
 */
export function moveWithinUnpaid(slots: OrderSlot[], paidPositions: ReadonlySet<number>, slotId: number, newPosition: number): PositionChange[] {
  const target = slots.find((s) => s.id === slotId);
  if (!target) throw new RangeError('That slot is not part of this order.');
  if (paidPositions.has(target.position)) throw new RangeError('That slot has already been paid, so its position cannot change.');
  const unpaid = slots.filter((s) => !paidPositions.has(s.position)).sort((a, b) => a.position - b.position);
  const positions = unpaid.map((s) => s.position);
  const index = positions.indexOf(newPosition);
  if (index === -1) throw new RangeError('A slot can only move to a position that has not been paid yet.');
  if (newPosition === target.position) throw new RangeError('That slot is already in that position.');

  const rest = unpaid.filter((s) => s.id !== slotId);
  rest.splice(index, 0, target);
  return rest.map((s, i) => ({ id: s.id, from: s.position, to: positions[i] })).filter((c) => c.from !== c.to);
}

/** How many of the first positions count as "early" for the optional At-risk rule: the first third, rounded up. */
export function earlyPositionCount(total: number): number {
  return Math.ceil(total / 3);
}

export interface DrawInput {
  slots: SlotKey[];
  seed: string;
  /** Apply the group's optional rule: At-risk participants do not take the early positions. */
  blockAtRiskEarly?: boolean;
  /** Memberships in the At-risk trust band. Empty until trust scores exist. */
  atRisk?: ReadonlySet<number>;
}

export interface DrawResult {
  positions: PlacedSlot[];
  /** False when the rule was on but there were too few other slots to move every At-risk slot out of the early positions. */
  atRiskRuleFullyApplied: boolean;
}

/** Positions 1..N for the slots. Same input, same output. */
export function drawOrder(input: DrawInput): DrawResult {
  const shuffled = seededShuffle(canonicalSlots(input.slots), input.seed);
  let fullyApplied = true;

  if (input.blockAtRiskEarly && input.atRisk && input.atRisk.size > 0) {
    const early = earlyPositionCount(shuffled.length);
    let cursor = early; // the next candidate to swap in, scanning the later positions in order
    for (let i = 0; i < early; i++) {
      if (!input.atRisk.has(shuffled[i].membershipId)) continue;
      while (cursor < shuffled.length && input.atRisk.has(shuffled[cursor].membershipId)) cursor++;
      if (cursor >= shuffled.length) {
        fullyApplied = false;
        break;
      }
      [shuffled[i], shuffled[cursor]] = [shuffled[cursor], shuffled[i]];
      cursor++;
    }
  }

  return { positions: shuffled.map((s, i) => ({ ...s, position: i + 1 })), atRiskRuleFullyApplied: fullyApplied };
}

/** What a draw saved, which is everything needed to run it again. */
export interface SavedDraw {
  seed: string;
  positions: PlacedSlot[];
  blockAtRiskEarly?: boolean;
  /** Saved from the time the draw was made. Missing on older draws made with the At-risk rule on, which therefore cannot be re-checked. */
  atRiskMembershipIds?: number[];
}

export interface DrawCheck {
  /** True when running the draw again from its seed gives the same order; false when it does not; null when it cannot be checked. */
  matches: boolean | null;
  reason: string | null;
}

/** Runs a saved draw again from its seed and compares. Nothing here reads a clock or the database. */
export function verifyDraw(saved: SavedDraw): DrawCheck {
  if (!saved.seed || !Array.isArray(saved.positions) || saved.positions.length === 0) return { matches: null, reason: 'This draw did not save what is needed to check it.' };
  if (saved.blockAtRiskEarly && saved.atRiskMembershipIds === undefined) return { matches: null, reason: 'This draw used the At-risk rule and was made before the people it applied to were saved, so it cannot be re-checked.' };
  const again = drawOrder({
    slots: saved.positions.map((p) => ({ membershipId: p.membershipId, shareNo: p.shareNo })),
    seed: saved.seed,
    blockAtRiskEarly: saved.blockAtRiskEarly ?? false,
    atRisk: new Set(saved.atRiskMembershipIds ?? []),
  });
  const before = new Map(saved.positions.map((p) => [slotId(p), p.position]));
  const same = again.positions.length === saved.positions.length && again.positions.every((p) => before.get(slotId(p)) === p.position);
  return { matches: same, reason: same ? null : 'Running the draw again from the saved seed gives a different order.' };
}
