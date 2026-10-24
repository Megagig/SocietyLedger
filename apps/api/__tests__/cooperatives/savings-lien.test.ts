/**
 * The savings-to-loan rule a cooperative sets per loan product (ratio 2 = "up to twice your savings"), and
 * the lien that holds savings against a disbursed loan. Pure rules are tested directly; the DB helpers run
 * against a small in-memory fake of the two tables they touch.
 */
jest.mock('../../src/lib/prisma', () => ({ prisma: {} }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: {} }));

import { Decimal } from '@prisma/client/runtime/library';
import {
  assertWithinSavingsRule,
  createLienForLoan,
  getSavingsPosition,
  lienAmountFor,
  maxBorrowableOnProduct,
  releaseAmountFor,
  releaseLienForRepayment,
} from '../../src/modules/cooperatives/savings-lien';
import { cooperativesService } from '../../src/modules/cooperatives/cooperatives.service';

const product = (ratio: number | null, lockSavings = true) => ({
  maxLoanToSavingsRatio: ratio === null ? null : new Decimal(ratio),
  lockSavings,
});

/** Fake of the only prisma calls the lien helpers make. */
function fakeDb(opts: { balances: number[]; liens?: Array<{ amount: number; releasedAmount?: number; loanId?: number }> }) {
  const liens = (opts.liens ?? []).map((l, i) => ({
    loanId: l.loanId ?? i + 1,
    amount: new Decimal(l.amount),
    releasedAmount: new Decimal(l.releasedAmount ?? 0),
    status: 'ACTIVE' as 'ACTIVE' | 'RELEASED',
  }));
  const db: any = {
    savingsAccount: {
      aggregate: jest.fn(async () => ({
        _sum: { balance: new Decimal(opts.balances.reduce((a, b) => a + b, 0)) },
      })),
    },
    savingsLien: {
      findMany: jest.fn(async () => liens.filter((l) => l.status === 'ACTIVE')),
      findUnique: jest.fn(async ({ where }: any) => liens.find((l) => l.loanId === where.loanId) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { loanId: data.loanId, amount: data.amount, releasedAmount: new Decimal(0), status: 'ACTIVE' as const };
        liens.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = liens.find((l) => l.loanId === where.loanId)!;
        Object.assign(row, data);
        return row;
      }),
    },
  };
  return { db, liens };
}

describe('lienAmountFor — principal / ratio', () => {
  it.each([
    [1, 200_000, 200_000],
    [2, 200_000, 100_000],
    [3, 300_000, 100_000],
  ])('ratio %s on a ₦%s loan holds ₦%s', (ratio, principal, expected) => {
    expect(lienAmountFor(principal, product(ratio)).toNumber()).toBe(expected);
  });

  it('rounds to kobo', () => {
    expect(lienAmountFor(100_000, product(3)).toString()).toBe('33333.33');
  });

  it('holds nothing without a savings rule, or with locking switched off', () => {
    expect(lienAmountFor(200_000, product(null)).toNumber()).toBe(0);
    expect(lienAmountFor(200_000, product(2, false)).toNumber()).toBe(0);
  });
});

describe('maxBorrowableOnProduct — available × ratio', () => {
  it('multiplies available savings by the ratio', () => {
    expect(maxBorrowableOnProduct(100_000, product(2))!.toNumber()).toBe(200_000);
    expect(maxBorrowableOnProduct(100_000, product(0.5))!.toNumber()).toBe(50_000);
  });

  it('has no limit when the product has no savings rule', () => {
    expect(maxBorrowableOnProduct(100_000, product(null))).toBeNull();
  });
});

describe('releaseAmountFor', () => {
  const lien = { amount: new Decimal(100_000), releasedAmount: new Decimal(0) };

  it('releases the share matching the principal repaid', () => {
    expect(releaseAmountFor(lien, 50_000, 200_000, false).toNumber()).toBe(25_000);
  });

  it('releases everything that is left once the loan is paid off', () => {
    expect(releaseAmountFor({ ...lien, releasedAmount: new Decimal(60_000) }, 1, 200_000, true).toNumber()).toBe(40_000);
  });

  it('never releases more than is still held', () => {
    expect(releaseAmountFor({ ...lien, releasedAmount: new Decimal(90_000) }, 200_000, 200_000, false).toNumber()).toBe(10_000);
  });

  it('releases nothing for an interest-only payment', () => {
    expect(releaseAmountFor(lien, 0, 200_000, false).toNumber()).toBe(0);
  });
});

describe('getSavingsPosition', () => {
  it('available = balance − outstanding liens', async () => {
    const { db } = fakeDb({ balances: [150_000, 50_000], liens: [{ amount: 60_000, releasedAmount: 10_000 }] });

    const p = await getSavingsPosition(db, 15, 70);

    expect(p.balance.toNumber()).toBe(200_000);
    expect(p.locked.toNumber()).toBe(50_000);
    expect(p.available.toNumber()).toBe(150_000);
  });

  it('never goes negative', async () => {
    const { db } = fakeDb({ balances: [10_000], liens: [{ amount: 50_000 }] });

    expect((await getSavingsPosition(db, 15, 70)).available.toNumber()).toBe(0);
  });
});

describe('assertWithinSavingsRule', () => {
  it('lets a member borrow up to ratio × available savings (2×: ₦100k saved → ₦200k)', async () => {
    const { db } = fakeDb({ balances: [100_000] });

    await expect(assertWithinSavingsRule(db, 15, 70, product(2), 200_000)).resolves.toBeDefined();
    await expect(assertWithinSavingsRule(db, 15, 70, product(2), 200_001)).rejects.toThrow(/up to ₦200,000\.00/);
  });

  it('a different cooperative can set 1× or 3× and gets different limits', async () => {
    const { db } = fakeDb({ balances: [100_000] });

    await expect(assertWithinSavingsRule(db, 15, 70, product(1), 100_001)).rejects.toThrow();
    await expect(assertWithinSavingsRule(db, 15, 70, product(3), 300_000)).resolves.toBeDefined();
  });

  it('measures against savings NOT already held against another loan', async () => {
    const { db } = fakeDb({ balances: [100_000], liens: [{ amount: 60_000 }] });

    await expect(assertWithinSavingsRule(db, 15, 70, product(2), 80_001)).rejects.toThrow(/held against another loan/);
    await expect(assertWithinSavingsRule(db, 15, 70, product(2), 80_000)).resolves.toBeDefined();
  });

  it('imposes no limit when the product has no savings rule', async () => {
    const { db } = fakeDb({ balances: [0] });

    await expect(assertWithinSavingsRule(db, 15, 70, product(null), 5_000_000)).resolves.toBeDefined();
  });
});

describe('lien lifecycle', () => {
  it('holds principal / ratio on disbursement, then releases it as principal is repaid and on payoff', async () => {
    const { db, liens } = fakeDb({ balances: [100_000] });

    await createLienForLoan(db, { associationId: 15, memberId: 70, loanId: 9, principal: 200_000, product: product(2) });
    expect(liens[0].amount.toNumber()).toBe(100_000);
    expect((await getSavingsPosition(db, 15, 70)).available.toNumber()).toBe(0);

    // a quarter of the principal repaid → a quarter of the hold released
    await releaseLienForRepayment(db, { loanId: 9, principalRepaidNow: 50_000, loanPrincipal: 200_000, isPaidOff: false });
    expect(liens[0].releasedAmount.toNumber()).toBe(25_000);
    expect((await getSavingsPosition(db, 15, 70)).available.toNumber()).toBe(25_000);

    // paid off → whatever is left is released and the lien closes
    await releaseLienForRepayment(db, { loanId: 9, principalRepaidNow: 150_000, loanPrincipal: 200_000, isPaidOff: true });
    expect(liens[0].status).toBe('RELEASED');
    expect((await getSavingsPosition(db, 15, 70)).available.toNumber()).toBe(100_000);
  });

  it('creates no lien when the product does not lock savings', async () => {
    const { db } = fakeDb({ balances: [100_000] });

    const lien = await createLienForLoan(db, {
      associationId: 15,
      memberId: 70,
      loanId: 9,
      principal: 200_000,
      product: product(2, false),
    });

    expect(lien).toBeNull();
    expect(db.savingsLien.create).not.toHaveBeenCalled();
  });

  it('does nothing for a loan that has no lien (e.g. disbursed before this feature)', async () => {
    const { db } = fakeDb({ balances: [100_000] });

    await expect(
      releaseLienForRepayment(db, { loanId: 404, principalRepaidNow: 1, loanPrincipal: 10, isPaidOff: false })
    ).resolves.toBeNull();
  });
});

describe('withdrawing held savings', () => {
  it('is refused: only the available part can leave', async () => {
    const { db } = fakeDb({ balances: [100_000], liens: [{ amount: 60_000 }] });
    const prismaMod = jest.requireMock('../../src/lib/prisma').prisma;
    prismaMod.savingsAccount = {
      ...db.savingsAccount,
      findFirst: jest.fn(async () => ({
        id: 9,
        memberId: 70,
        balance: new Decimal(100_000),
        totalDeposits: new Decimal(0),
        totalWithdrawals: new Decimal(0),
      })),
    };
    prismaMod.savingsLien = db.savingsLien;
    // processSavingsTransaction now reads, checks and moves the balance inside one database transaction.
    prismaMod.$transaction = async (fn: (client: unknown) => unknown) => fn(prismaMod);

    await expect(
      cooperativesService.processSavingsTransaction(15, 2, { savingsAccountId: 9, type: 'WITHDRAWAL', amount: 50_000 })
    ).rejects.toThrow(/held against an active loan/);
  });
});
