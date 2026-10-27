/**
 * The Ajo ledger (T1.5): the append-only record of group money.
 *
 * Rules this file keeps true:
 *  - Entries are never updated or deleted. There is no function here that does either.
 *  - A correction is a new REVERSAL entry that points at the original, with a reason. An entry can be reversed once.
 *  - Every write carries an idempotency key. Replaying it returns the original entry and changes nothing; reusing a key for a different
 *    amount, direction or target is refused, because that is a bug or an attack, not a replay.
 *  - Balances are derived from the entries, never stored.
 *  - Integer kobo (bigint). SocietyLedger records this money; it never moves it, so nothing here talks to a payment provider.
 */
import { Prisma } from '@prisma/client';

export type LedgerEntryType = 'CONTRIBUTION' | 'REVERSAL' | 'FEE' | 'PAYOUT' | 'ADJUSTMENT';
export type LedgerDirection = 'CREDIT' | 'DEBIT';

export interface LedgerEntry {
  id: number;
  associationId: number;
  groupId: number;
  membershipId: number | null;
  type: LedgerEntryType;
  direction: LedgerDirection;
  amountKobo: bigint;
  refType: string;
  refId: number | null;
  idempotencyKey: string;
  reversalOfId: number | null;
  reason: string | null;
  createdBy: number | null;
  createdAt: Date;
}

/** The slice of the database the ledger needs: a Prisma client or transaction, or an in-memory stand-in in tests. */
export interface LedgerDb {
  ajoLedgerEntry: {
    findUnique(args: { where: { id: number } | { idempotencyKey: string } }): Promise<LedgerEntry | null>;
    findFirst(args: { where: { reversalOfId: number } }): Promise<LedgerEntry | null>;
    create(args: { data: Omit<LedgerEntry, 'id' | 'createdAt'> }): Promise<LedgerEntry>;
    findMany(args: { where: { associationId: number; groupId?: number; membershipId?: number } }): Promise<Pick<LedgerEntry, 'direction' | 'amountKobo'>[]>;
  };
}

export class LedgerError extends Error {
  constructor(readonly code: 'INVALID_AMOUNT' | 'IDEMPOTENCY_CONFLICT' | 'ENTRY_NOT_FOUND' | 'ALREADY_REVERSED' | 'CANNOT_REVERSE_A_REVERSAL' | 'REASON_REQUIRED' | 'KEY_REQUIRED', message: string) {
    super(message);
  }
}

export interface RecordInput {
  associationId: number;
  groupId: number;
  membershipId?: number | null;
  type: Exclude<LedgerEntryType, 'REVERSAL'>;
  direction: LedgerDirection;
  amountKobo: bigint;
  /** What the entry is about, e.g. `contribution` and the contribution's id. */
  refType: string;
  refId?: number | null;
  idempotencyKey: string;
  reason?: string | null;
  createdBy?: number | null;
}

export interface WriteResult {
  entry: LedgerEntry;
  /** True when this key was seen before: nothing new was written. */
  replayed: boolean;
}

function requireKey(key: string): void {
  if (typeof key !== 'string' || key.trim().length < 8 || key.length > 200) {
    throw new LedgerError('KEY_REQUIRED', 'A money record needs an idempotency key of at least 8 characters, so a repeated request cannot count twice.');
  }
}

function requireAmount(amount: bigint): void {
  if (typeof amount !== 'bigint' || amount <= BigInt(0)) {
    throw new LedgerError('INVALID_AMOUNT', 'An amount must be a whole number of kobo greater than zero.');
  }
}

function sameAs(existing: LedgerEntry, expected: Pick<LedgerEntry, 'associationId' | 'groupId' | 'membershipId' | 'type' | 'direction' | 'amountKobo' | 'refType' | 'refId' | 'reversalOfId'>): boolean {
  return (
    existing.associationId === expected.associationId &&
    existing.groupId === expected.groupId &&
    existing.membershipId === expected.membershipId &&
    existing.type === expected.type &&
    existing.direction === expected.direction &&
    existing.amountKobo === expected.amountKobo &&
    existing.refType === expected.refType &&
    existing.refId === expected.refId &&
    existing.reversalOfId === expected.reversalOfId
  );
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Insert once. If a concurrent request with the same key wins the race, return its entry as a replay. */
async function insertOnce(db: LedgerDb, data: Omit<LedgerEntry, 'id' | 'createdAt'>): Promise<WriteResult> {
  const prior = await db.ajoLedgerEntry.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
  if (prior) {
    if (!sameAs(prior, data)) {
      throw new LedgerError('IDEMPOTENCY_CONFLICT', 'That idempotency key was already used for a different record.');
    }
    return { entry: prior, replayed: true };
  }
  try {
    return { entry: await db.ajoLedgerEntry.create({ data }), replayed: false };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await db.ajoLedgerEntry.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (winner && sameAs(winner, data)) return { entry: winner, replayed: true };
    // The unique hit was not the key: the original was reversed by someone else in the meantime.
    throw new LedgerError('ALREADY_REVERSED', 'That entry has already been reversed.');
  }
}

/** Record money in or out. Idempotent on `idempotencyKey`. */
export async function recordEntry(db: LedgerDb, input: RecordInput): Promise<WriteResult> {
  requireKey(input.idempotencyKey);
  requireAmount(input.amountKobo);
  return insertOnce(db, {
    associationId: input.associationId,
    groupId: input.groupId,
    membershipId: input.membershipId ?? null,
    type: input.type,
    direction: input.direction,
    amountKobo: input.amountKobo,
    refType: input.refType,
    refId: input.refId ?? null,
    idempotencyKey: input.idempotencyKey,
    reversalOfId: null,
    reason: input.reason ?? null,
    createdBy: input.createdBy ?? null,
  });
}

export interface ReverseInput {
  associationId: number;
  entryId: number;
  reason: string;
  idempotencyKey: string;
  createdBy?: number | null;
}

/**
 * Cancel an entry by writing its opposite, with a reason. The original is untouched. An entry can be reversed once, and a reversal cannot
 * itself be reversed: to put the money back, record a new entry.
 */
export async function reverseEntry(db: LedgerDb, input: ReverseInput): Promise<WriteResult> {
  requireKey(input.idempotencyKey);
  if (!input.reason || input.reason.trim().length < 3) throw new LedgerError('REASON_REQUIRED', 'A reversal needs a reason.');

  const original = await db.ajoLedgerEntry.findUnique({ where: { id: input.entryId } });
  // Another tenant's entry is reported as missing, never as forbidden: its existence is not ours to confirm.
  if (!original || original.associationId !== input.associationId) throw new LedgerError('ENTRY_NOT_FOUND', 'That ledger entry was not found.');
  if (original.type === 'REVERSAL') throw new LedgerError('CANNOT_REVERSE_A_REVERSAL', 'A reversal cannot be reversed. Record a new entry instead.');

  const data: Omit<LedgerEntry, 'id' | 'createdAt'> = {
    associationId: original.associationId,
    groupId: original.groupId,
    membershipId: original.membershipId,
    type: 'REVERSAL',
    direction: original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT',
    amountKobo: original.amountKobo,
    refType: original.refType,
    refId: original.refId,
    idempotencyKey: input.idempotencyKey,
    reversalOfId: original.id,
    reason: input.reason.trim(),
    createdBy: input.createdBy ?? null,
  };

  // The same key replays; a different key on an already-reversed entry is refused.
  const replay = await db.ajoLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (!replay) {
    const existingReversal = await db.ajoLedgerEntry.findFirst({ where: { reversalOfId: original.id } });
    if (existingReversal) throw new LedgerError('ALREADY_REVERSED', 'That entry has already been reversed.');
  }
  return insertOnce(db, data);
}

/** CREDIT minus DEBIT, in kobo. Reversals are entries like any other, so they net out here. */
export async function balanceKobo(db: LedgerDb, scope: { associationId: number; groupId?: number; membershipId?: number }): Promise<bigint> {
  const rows = await db.ajoLedgerEntry.findMany({ where: scope });
  return rows.reduce((sum, r) => (r.direction === 'CREDIT' ? sum + r.amountKobo : sum - r.amountKobo), BigInt(0));
}
