/**
 * The append-only ledger (T1.5): replaying a request leaves balances unchanged, and reversing then re-applying nets to the right balance.
 * The ledger runs against an in-memory stand-in for the database, so these are properties of the service, not of Postgres.
 */
import { Prisma } from '@prisma/client';
import { LedgerError, balanceKobo, recordEntry, reverseEntry, type LedgerDb, type LedgerEntry } from '../../src/modules/ajo/ajo-ledger.service';

const K = (n: number) => BigInt(n);

/** In-memory ajo_ledger_entries with the same unique constraints (idempotency key, reversal_of_id). Exposes `rows` to prove nothing is edited. */
function fakeDb() {
  const rows: LedgerEntry[] = [];
  let nextId = 1;
  const db: LedgerDb = {
    ajoLedgerEntry: {
      async findUnique({ where }) {
        const found = 'id' in where ? rows.find((r) => r.id === where.id) : rows.find((r) => r.idempotencyKey === where.idempotencyKey);
        return found ? { ...found } : null;
      },
      async findFirst({ where }) {
        const found = rows.find((r) => r.reversalOfId === where.reversalOfId);
        return found ? { ...found } : null;
      },
      async create({ data }) {
        const clash =
          rows.some((r) => r.idempotencyKey === data.idempotencyKey) || (data.reversalOfId !== null && rows.some((r) => r.reversalOfId === data.reversalOfId));
        if (clash) throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
        const row: LedgerEntry = { ...data, id: nextId++, createdAt: new Date('2026-11-07T00:00:00Z') };
        rows.push(row);
        return { ...row };
      },
      async findMany({ where }) {
        return rows
          .filter((r) => r.associationId === where.associationId && (where.groupId === undefined || r.groupId === where.groupId) && (where.membershipId === undefined || r.membershipId === where.membershipId))
          .map((r) => ({ direction: r.direction, amountKobo: r.amountKobo }));
      },
    },
  };
  return { db, rows };
}

/** A small deterministic random generator, so a failure can be reproduced. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const base = { associationId: 1, groupId: 10, membershipId: 100, type: 'CONTRIBUTION' as const, direction: 'CREDIT' as const, refType: 'contribution' };

describe('recording an entry', () => {
  it('writes a contribution and shows it in the balance', async () => {
    const { db } = fakeDb();
    const { entry, replayed } = await recordEntry(db, { ...base, amountKobo: K(500_000), refId: 1, idempotencyKey: 'contrib-0001' });
    expect(replayed).toBe(false);
    expect(entry.amountKobo).toBe(K(500_000));
    expect(await balanceKobo(db, { associationId: 1, membershipId: 100 })).toBe(K(500_000));
  });

  it('handles amounts beyond a 32-bit integer (a ₦25,000,000.00 pot)', async () => {
    const { db } = fakeDb();
    await recordEntry(db, { ...base, amountKobo: K(2_500_000_000), idempotencyKey: 'big-pot-0001' });
    expect(await balanceKobo(db, { associationId: 1 })).toBe(K(2_500_000_000));
  });

  it('refuses a zero, negative or missing amount and a missing key', async () => {
    const { db } = fakeDb();
    await expect(recordEntry(db, { ...base, amountKobo: K(0), idempotencyKey: 'k-12345678' })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    await expect(recordEntry(db, { ...base, amountKobo: K(-5), idempotencyKey: 'k-12345678' })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    await expect(recordEntry(db, { ...base, amountKobo: 500 as unknown as bigint, idempotencyKey: 'k-12345678' })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    await expect(recordEntry(db, { ...base, amountKobo: K(1), idempotencyKey: 'short' })).rejects.toMatchObject({ code: 'KEY_REQUIRED' });
  });
});

describe('replaying a request', () => {
  it('returns the original entry and changes nothing the second time', async () => {
    const { db, rows } = fakeDb();
    const first = await recordEntry(db, { ...base, amountKobo: K(500_000), idempotencyKey: 'replay-0001' });
    const second = await recordEntry(db, { ...base, amountKobo: K(500_000), idempotencyKey: 'replay-0001' });
    expect(second.replayed).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
    expect(rows).toHaveLength(1);
    expect(await balanceKobo(db, { associationId: 1 })).toBe(K(500_000));
  });

  it('refuses a key reused for a different amount, direction or person', async () => {
    const { db } = fakeDb();
    await recordEntry(db, { ...base, amountKobo: K(500_000), idempotencyKey: 'reuse-0001' });
    await expect(recordEntry(db, { ...base, amountKobo: K(600_000), idempotencyKey: 'reuse-0001' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(recordEntry(db, { ...base, direction: 'DEBIT', amountKobo: K(500_000), idempotencyKey: 'reuse-0001' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(recordEntry(db, { ...base, membershipId: 101, amountKobo: K(500_000), idempotencyKey: 'reuse-0001' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('treats a concurrent duplicate that loses the insert race as a replay', async () => {
    const { db } = fakeDb();
    const real = db.ajoLedgerEntry.create;
    let raced = false;
    db.ajoLedgerEntry.create = async (args) => {
      if (!raced) {
        raced = true;
        await real(args); // the other request wins
      }
      return real(args); // ours then hits the unique key
    };
    const result = await recordEntry(db, { ...base, amountKobo: K(500_000), idempotencyKey: 'race-00001' });
    expect(result.replayed).toBe(true);
    expect(await balanceKobo(db, { associationId: 1 })).toBe(K(500_000));
  });

  it('property: any sequence of requests, each sent 1 to 4 times, counts every key exactly once', async () => {
    for (const seed of [1, 7, 42, 2026, 99_991]) {
      const next = rng(seed);
      const { db, rows } = fakeDb();
      let expected = BigInt(0);
      for (let i = 0; i < 60; i++) {
        const credit = next() < 0.7;
        const amount = K(1 + Math.floor(next() * 5_000_000));
        expected += credit ? amount : -amount;
        for (let sends = 1 + Math.floor(next() * 4); sends > 0; sends--) {
          await recordEntry(db, { ...base, direction: credit ? 'CREDIT' : 'DEBIT', amountKobo: amount, idempotencyKey: `seed${seed}-req-${i}` });
        }
      }
      expect(rows).toHaveLength(60);
      expect(await balanceKobo(db, { associationId: 1 })).toBe(expected);
    }
  });
});

describe('reversing an entry', () => {
  it('writes the opposite entry with a reason, and leaves the original untouched', async () => {
    const { db, rows } = fakeDb();
    const { entry } = await recordEntry(db, { ...base, amountKobo: K(500_000), refId: 9, idempotencyKey: 'orig-00001' });
    const snapshot = { ...entry };
    const { entry: reversal } = await reverseEntry(db, { associationId: 1, entryId: entry.id, reason: 'Entered against the wrong person', idempotencyKey: 'rev-000001', createdBy: 5 });

    expect(reversal).toMatchObject({ type: 'REVERSAL', direction: 'DEBIT', amountKobo: K(500_000), reversalOfId: entry.id, reason: 'Entered against the wrong person', refId: 9 });
    expect(rows[0]).toEqual(snapshot);
    expect(await balanceKobo(db, { associationId: 1 })).toBe(K(0));
  });

  it('is idempotent: the same reversal sent twice is applied once', async () => {
    const { db, rows } = fakeDb();
    const { entry } = await recordEntry(db, { ...base, amountKobo: K(500_000), idempotencyKey: 'orig-00002' });
    await reverseEntry(db, { associationId: 1, entryId: entry.id, reason: 'Duplicate payment', idempotencyKey: 'rev-000002' });
    const again = await reverseEntry(db, { associationId: 1, entryId: entry.id, reason: 'Duplicate payment', idempotencyKey: 'rev-000002' });
    expect(again.replayed).toBe(true);
    expect(rows).toHaveLength(2);
    expect(await balanceKobo(db, { associationId: 1 })).toBe(K(0));
  });

  it('refuses a second reversal of the same entry under a new key', async () => {
    const { db } = fakeDb();
    const { entry } = await recordEntry(db, { ...base, amountKobo: K(500_000), idempotencyKey: 'orig-00003' });
    await reverseEntry(db, { associationId: 1, entryId: entry.id, reason: 'Duplicate payment', idempotencyKey: 'rev-000003' });
    await expect(reverseEntry(db, { associationId: 1, entryId: entry.id, reason: 'Duplicate payment', idempotencyKey: 'rev-000004' })).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
    expect(await balanceKobo(db, { associationId: 1 })).toBe(K(0));
  });

  it('refuses to reverse a reversal, and a reversal without a reason', async () => {
    const { db } = fakeDb();
    const { entry } = await recordEntry(db, { ...base, amountKobo: K(500_000), idempotencyKey: 'orig-00004' });
    const { entry: reversal } = await reverseEntry(db, { associationId: 1, entryId: entry.id, reason: 'Duplicate payment', idempotencyKey: 'rev-000005' });
    await expect(reverseEntry(db, { associationId: 1, entryId: reversal.id, reason: 'Undo the undo', idempotencyKey: 'rev-000006' })).rejects.toMatchObject({ code: 'CANNOT_REVERSE_A_REVERSAL' });
    await expect(reverseEntry(db, { associationId: 1, entryId: entry.id, reason: ' ', idempotencyKey: 'rev-000007' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it('cannot reach another association\'s entry', async () => {
    const { db } = fakeDb();
    const { entry } = await recordEntry(db, { ...base, amountKobo: K(500_000), idempotencyKey: 'orig-00005' });
    await expect(reverseEntry(db, { associationId: 2, entryId: entry.id, reason: 'Not mine to touch', idempotencyKey: 'rev-000008' })).rejects.toMatchObject({ code: 'ENTRY_NOT_FOUND' });
    expect(await balanceKobo(db, { associationId: 1 })).toBe(K(500_000));
    expect(await balanceKobo(db, { associationId: 2 })).toBe(K(0));
  });

  it('property: reversing then re-recording nets to the corrected balance, and replays change nothing', async () => {
    for (const seed of [3, 11, 58, 1999]) {
      const next = rng(seed);
      const { db } = fakeDb();
      let expected = BigInt(0);
      for (let i = 0; i < 40; i++) {
        const amount = K(1 + Math.floor(next() * 3_000_000));
        const { entry } = await recordEntry(db, { ...base, amountKobo: amount, refId: i, idempotencyKey: `s${seed}-orig-${i}` });
        expected += amount;
        if (next() < 0.5) {
          // The amount was wrong: reverse it and record the right one.
          const fixed = K(1 + Math.floor(next() * 3_000_000));
          for (let sends = 0; sends < 2; sends++) {
            await reverseEntry(db, { associationId: 1, entryId: entry.id, reason: 'Wrong amount', idempotencyKey: `s${seed}-rev-${i}` });
            await recordEntry(db, { ...base, amountKobo: fixed, refId: i, idempotencyKey: `s${seed}-fix-${i}` });
          }
          expected += fixed - amount;
        }
      }
      expect(await balanceKobo(db, { associationId: 1 })).toBe(expected);
    }
  });
});

describe('the service never edits or deletes', () => {
  it('exposes no update or delete operation in the database slice it needs', () => {
    const { db } = fakeDb();
    expect(Object.keys(db.ajoLedgerEntry).sort()).toEqual(['create', 'findFirst', 'findMany', 'findUnique']);
  });

  it('throws LedgerError for every refusal', async () => {
    const { db } = fakeDb();
    await expect(recordEntry(db, { ...base, amountKobo: K(0), idempotencyKey: 'k-12345678' })).rejects.toBeInstanceOf(LedgerError);
  });
});
