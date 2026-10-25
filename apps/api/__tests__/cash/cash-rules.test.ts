import { Decimal } from '@prisma/client/runtime/library';
import {
  collectionRemaining,
  daysBetween,
  isLodgmentOverdue,
  isValidMoney,
  lodgmentShortfall,
  officerCashPosition,
  planLodgment,
  shouldRemindOverdue,
} from '../../src/modules/cash/cash-rules';

const day = (n: number) => new Date(Date.UTC(2026, 9, n));

describe('isValidMoney', () => {
  it('accepts naira and kobo, refuses zero, negatives, fractions of a kobo and non-numbers', () => {
    expect(isValidMoney(5000)).toBe(true);
    expect(isValidMoney(0.5)).toBe(true);
    expect(isValidMoney(1234.56)).toBe(true);
    expect(isValidMoney(0)).toBe(false);
    expect(isValidMoney(-10)).toBe(false);
    expect(isValidMoney(10.123)).toBe(false);
    expect(isValidMoney(Number.NaN)).toBe(false);
  });
});

describe('collectionRemaining', () => {
  it('is what was collected less what is already in a lodgment, never negative', () => {
    expect(collectionRemaining({ collected: 10000, allocated: 4000 }).toNumber()).toBe(6000);
    expect(collectionRemaining({ collected: 1000, allocated: 5000 }).toNumber()).toBe(0);
  });
});

describe('officerCashPosition', () => {
  it('separates cash still on open collections, cash ready to lodge, and cash lodged but not yet checked', () => {
    const p = officerCashPosition(
      [
        { collectionId: 1, status: 'OPEN', closedAt: null, collected: 3000, allocated: 0 },
        { collectionId: 2, status: 'CLOSED', closedAt: day(5), collected: 8000, allocated: 0 },
        { collectionId: 3, status: 'CLOSED', closedAt: day(2), collected: 5000, allocated: 5000 }, // fully lodged
        { collectionId: 4, status: 'CLOSED', closedAt: day(3), collected: 4000, allocated: 1000 },
      ],
      5000,
    );
    expect(p.inOpenCollections.toNumber()).toBe(3000);
    expect(p.readyToLodge.toNumber()).toBe(11000);
    expect(p.awaitingCheck.toNumber()).toBe(5000);
    // the oldest closed collection that still holds cash — not the fully lodged one
    expect(p.oldestUnlodgedSince).toEqual(day(3));
  });

  it('has no age when nothing is waiting to be lodged', () => {
    const p = officerCashPosition([{ collectionId: 1, status: 'OPEN', closedAt: null, collected: 100, allocated: 0 }], 0);
    expect(p.oldestUnlodgedSince).toBeNull();
    expect(p.readyToLodge.toNumber()).toBe(0);
  });
});

describe('overdue lodgment', () => {
  it('counts whole days', () => {
    expect(daysBetween(day(1), day(4))).toBe(3);
    expect(daysBetween(day(1), new Date(day(2).getTime() - 1))).toBe(0);
  });

  it('is overdue only once the cash has waited longer than the allowed days', () => {
    expect(isLodgmentOverdue(day(1), day(4), 3)).toBe(false); // exactly 3 days: still allowed
    expect(isLodgmentOverdue(day(1), day(5), 3)).toBe(true);
    expect(isLodgmentOverdue(null, day(30), 3)).toBe(false);
  });

  it('reminds on the first day past the deadline and every third day after, never before', () => {
    const due = 3;
    expect([1, 2, 3].some((d) => shouldRemindOverdue(d, due))).toBe(false);
    expect([4, 5, 6, 7, 8, 9, 10].filter((d) => shouldRemindOverdue(d, due))).toEqual([4, 7, 10]);
  });
});

describe('planLodgment', () => {
  const collections = [
    { collectionId: 1, closedAt: day(9), remaining: 2000 },
    { collectionId: 2, closedAt: day(3), remaining: 7000 },
    { collectionId: 3, closedAt: day(5), remaining: 0 },
  ];

  it('takes the oldest collection first and skips ones with no cash left', () => {
    const plan = planLodgment(collections);
    expect(plan.lines.map((l) => l.collectionId)).toEqual([2, 1]);
    expect(plan.expected.toNumber()).toBe(9000);
  });

  it('covers only the collections chosen, each in full', () => {
    const plan = planLodgment(collections, [1]);
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0].amount.toNumber()).toBe(2000);
    expect(plan.expected.toNumber()).toBe(2000);
  });

  it('plans nothing when no chosen collection holds cash', () => {
    expect(planLodgment(collections, [3]).lines).toHaveLength(0);
  });
});

describe('lodgmentShortfall', () => {
  it('is the gap between what should be lodged and what was, and zero when nothing is short', () => {
    expect(lodgmentShortfall(9000, 8500).toNumber()).toBe(500);
    expect(lodgmentShortfall(new Decimal(9000), 9000).toNumber()).toBe(0);
    expect(lodgmentShortfall(9000, 9500).toNumber()).toBe(0);
  });
});
