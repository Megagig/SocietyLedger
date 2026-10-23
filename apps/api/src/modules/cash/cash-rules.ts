import { Decimal } from '@prisma/client/runtime/library';

export type CashRuleErrorCode =
  | 'NOT_FOUND'
  | 'NOT_OWNER'
  | 'COLLECTION_CLOSED'
  | 'COLLECTION_OPEN'
  | 'CASH_DISABLED'
  | 'INVALID_ITEM'
  | 'OVER_BALANCE'
  | 'INVALID_LINK'
  | 'ALREADY_DECIDED'
  | 'OWN_LODGMENT'
  | 'SHORTFALL_REASON_REQUIRED'
  | 'OVER_CASH_IN_HAND'
  | 'NOTHING_TO_LODGE'
  | 'NOT_VOIDABLE'
  | 'PARTIALLY_RECORDED';

/** Why a cash action was refused — the controller turns each code into the right HTTP status. */
export class CashRuleError extends Error {
  constructor(
    public readonly code: CashRuleErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CashRuleError';
  }
}

export const CASH_RULE_STATUS: Record<CashRuleErrorCode, number> = {
  NOT_FOUND: 404,
  NOT_OWNER: 403,
  COLLECTION_CLOSED: 409,
  COLLECTION_OPEN: 409,
  CASH_DISABLED: 400,
  INVALID_ITEM: 400,
  OVER_BALANCE: 400,
  INVALID_LINK: 400,
  ALREADY_DECIDED: 409,
  OWN_LODGMENT: 403,
  SHORTFALL_REASON_REQUIRED: 400,
  OVER_CASH_IN_HAND: 400,
  NOTHING_TO_LODGE: 400,
  NOT_VOIDABLE: 409,
  PARTIALLY_RECORDED: 409,
};

/** Days an officer has to lodge a closed collection before it is flagged, when the association hasn't set its own. */
export const DEFAULT_LODGMENT_DUE_DAYS = 3;

const money = (value: Decimal.Value) => new Decimal(value);

/** Two decimals, as the books keep it — cash is counted in kobo, never fractions of one. */
export function isValidMoney(value: number): boolean {
  return Number.isFinite(value) && value > 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export interface CollectionCash {
  collectionId: number;
  status: 'OPEN' | 'CLOSED';
  closedAt: Date | null;
  /** Sum of the collection's active (not voided) receipts. */
  collected: Decimal.Value;
  /** Sum already allocated to lodgments that are pending or verified (a rejected lodgment frees its cash again). */
  allocated: Decimal.Value;
}

/** What is left to lodge from one collection. */
export function collectionRemaining(c: Pick<CollectionCash, 'collected' | 'allocated'>): Decimal {
  const remaining = money(c.collected).minus(money(c.allocated));
  return remaining.isNegative() ? new Decimal(0) : remaining;
}

export interface OfficerCashPosition {
  /** Collected on collections still open — can still change, so it can't be lodged yet. */
  inOpenCollections: Decimal;
  /** On closed collections and not yet in any lodgment. */
  readyToLodge: Decimal;
  /** Already paid into the bank and waiting for a different officer to check it. */
  awaitingCheck: Decimal;
  /** The closed collection that has waited longest to be lodged, if any. */
  oldestUnlodgedSince: Date | null;
}

/**
 * One officer's cash position. Cash in hand is what they still hold: open collections plus closed ones not yet lodged. Once a
 * lodgment is recorded the cash leaves their hands ("awaiting check") even though it only reaches the books on verification.
 */
export function officerCashPosition(collections: CollectionCash[], awaitingCheck: Decimal.Value): OfficerCashPosition {
  let inOpenCollections = new Decimal(0);
  let readyToLodge = new Decimal(0);
  let oldest: Date | null = null;

  for (const c of collections) {
    const remaining = collectionRemaining(c);
    if (c.status === 'OPEN') {
      inOpenCollections = inOpenCollections.plus(remaining);
    } else if (remaining.greaterThan(0)) {
      readyToLodge = readyToLodge.plus(remaining);
      if (c.closedAt && (!oldest || c.closedAt < oldest)) oldest = c.closedAt;
    }
  }

  return { inOpenCollections, readyToLodge, awaitingCheck: money(awaitingCheck), oldestUnlodgedSince: oldest };
}

/** Whole days between two instants, rounded down — "closed 3 days ago". */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/** A closed collection with cash still unlodged is overdue once it has waited longer than the allowed days. */
export function isLodgmentOverdue(oldestUnlodgedSince: Date | null, now: Date, dueDays: number): boolean {
  if (!oldestUnlodgedSince) return false;
  return daysBetween(oldestUnlodgedSince, now) > dueDays;
}

/**
 * Whether today is a reminder day for cash that has waited `days` days: the first day past the deadline, then every third day
 * after, so an officer is nudged without being nagged daily. Stateless — it needs no record of what was already sent.
 */
export function shouldRemindOverdue(days: number, dueDays: number): boolean {
  return days > dueDays && (days - dueDays - 1) % 3 === 0;
}

export interface LodgmentPlanLine {
  collectionId: number;
  amount: Decimal;
}

/**
 * Decides which collections a lodgment draws from. With nothing chosen it takes the oldest closed collections first, so cash is
 * lodged in the order it was collected. The lodgment always covers the whole remaining cash of each collection it names — a
 * collection is either fully accounted for (lodged, or lodged short with a reason) or not touched.
 */
export function planLodgment(
  collections: Array<{ collectionId: number; closedAt: Date | null; remaining: Decimal.Value }>,
  chosenIds?: number[],
): { lines: LodgmentPlanLine[]; expected: Decimal } {
  const eligible = collections
    .filter((c) => money(c.remaining).greaterThan(0))
    .filter((c) => !chosenIds || chosenIds.includes(c.collectionId))
    .sort((a, b) => (a.closedAt?.getTime() ?? 0) - (b.closedAt?.getTime() ?? 0));

  const lines = eligible.map((c) => ({ collectionId: c.collectionId, amount: money(c.remaining) }));
  const expected = lines.reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
  return { lines, expected };
}

/** The amount the officer is short of what the receipts say they should have lodged (never negative). */
export function lodgmentShortfall(expected: Decimal.Value, deposited: Decimal.Value): Decimal {
  const short = money(expected).minus(money(deposited));
  return short.isNegative() ? new Decimal(0) : short;
}
