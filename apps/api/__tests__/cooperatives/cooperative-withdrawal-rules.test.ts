/**
 * The pure rules behind two-stage withdrawals, officer-defined account types and the contribution table: what a type can do, who may decide
 * which stage, the monthly limit, and when a month counts as defaulted.
 */
import { Decimal } from '@prisma/client/runtime/library';
import {
  assertAvailableAfterHold,
  assertCanApprove,
  assertCanReview,
  assertTypeWithdrawable,
  assertWithinMonthlyLimit,
  contributionCell,
  monthWindow,
} from '../../src/modules/cooperatives/cooperative-rules';
import { resolveClassRules } from '../../src/modules/cooperatives/cooperative-types.service';

const d = (value: string | number) => new Decimal(value);

function codeOf(fn: () => void) {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string; status?: number }).code;
  }
  return undefined;
}

describe('account type behaviour classes', () => {
  it('never lets share capital be withdrawn or carry a withdrawal limit', () => {
    expect(resolveClassRules('SHARES', 50000)).toEqual({ isWithdrawable: false, monthlyWithdrawalLimit: null });
  });

  it('keeps contribution and special types withdrawable, with their limit', () => {
    expect(resolveClassRules('CONTRIBUTION', null)).toEqual({ isWithdrawable: true, monthlyWithdrawalLimit: null });
    const special = resolveClassRules('SPECIAL', 30000);
    expect(special.isWithdrawable).toBe(true);
    expect(special.monthlyWithdrawalLimit?.toString()).toBe('30000');
  });
});

describe('assertTypeWithdrawable', () => {
  it('refuses a type that is not withdrawable, naming it', () => {
    expect(codeOf(() => assertTypeWithdrawable({ name: 'Shares', isWithdrawable: false }))).toBe('NOT_WITHDRAWABLE');
  });
  it('allows a withdrawable type, and an old account with no type', () => {
    expect(codeOf(() => assertTypeWithdrawable({ name: 'Special', isWithdrawable: true }))).toBeUndefined();
    expect(codeOf(() => assertTypeWithdrawable(null))).toBeUndefined();
  });
});

describe('assertWithinMonthlyLimit', () => {
  it('has no cap when the type sets none', () => {
    expect(codeOf(() => assertWithinMonthlyLimit(null, d(999999), d(1000000)))).toBeUndefined();
  });
  it('allows exactly what is left of the limit and refuses a naira more', () => {
    expect(codeOf(() => assertWithinMonthlyLimit(d(30000), d(20000), d(10000)))).toBeUndefined();
    expect(codeOf(() => assertWithinMonthlyLimit(d(30000), d(20000), d('10000.01')))).toBe('MONTHLY_LIMIT');
  });
  it('says the limit is used up once it is', () => {
    try {
      assertWithinMonthlyLimit(d(30000), d(30000), d(1));
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).toMatch(/already been used/);
    }
  });
});

describe('assertAvailableAfterHold', () => {
  it('only counts the hold when there is one', () => {
    expect(codeOf(() => assertAvailableAfterHold(d(900), { locked: d(0), available: d(100) }))).toBeUndefined();
    expect(codeOf(() => assertAvailableAfterHold(d(900), { locked: d(500), available: d(400) }))).toBe('SAVINGS_HELD');
    expect(codeOf(() => assertAvailableAfterHold(d(400), { locked: d(500), available: d(400) }))).toBeUndefined();
  });
});

describe('who may decide which stage', () => {
  it('stops the member reviewing or approving their own withdrawal', () => {
    expect(codeOf(() => assertCanReview(7, 7))).toBe('OWN_REQUEST');
    expect(codeOf(() => assertCanApprove({ approverUserId: 7, requesterUserId: 7, reviewerUserId: 9, twoStage: true }))).toBe('OWN_REQUEST');
  });

  it('needs a different officer to approve than reviewed, when two stages are on', () => {
    expect(codeOf(() => assertCanApprove({ approverUserId: 9, requesterUserId: 7, reviewerUserId: 9, twoStage: true }))).toBe('SAME_REVIEWER');
    expect(codeOf(() => assertCanApprove({ approverUserId: 11, requesterUserId: 7, reviewerUserId: 9, twoStage: true }))).toBeUndefined();
  });

  it('has no reviewer to compare against when two stages are off', () => {
    expect(codeOf(() => assertCanApprove({ approverUserId: 9, requesterUserId: 7, reviewerUserId: null, twoStage: false }))).toBeUndefined();
    // `twoStage` is fixed on the request when it is made, so a single-stage request never has a separate review to compare against.
    expect(codeOf(() => assertCanApprove({ approverUserId: 9, requesterUserId: 7, reviewerUserId: 9, twoStage: false }))).toBeUndefined();
  });

  it("doesn't mind when the member has no login (nothing to compare)", () => {
    expect(codeOf(() => assertCanReview(7, null))).toBeUndefined();
  });
});

describe('monthWindow', () => {
  it('covers exactly one calendar month, ending where the next begins', () => {
    const { start, end } = monthWindow(new Date('2026-12-15T10:00:00Z'));
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('contributionCell', () => {
  const current = { year: 2026, month: 5 };
  const base = { expected: d(5000), current, openedBefore: true };

  it('is PAID when the expected amount was paid, or when none was expected', () => {
    expect(contributionCell({ ...base, paid: d(5000), year: 2026, month: 3 })).toBe('PAID');
    expect(contributionCell({ ...base, expected: null, paid: d(1000), year: 2026, month: 3 })).toBe('PAID');
  });

  it('is PARTIAL when something was paid but less than expected', () => {
    expect(contributionCell({ ...base, paid: d(2000), year: 2026, month: 3 })).toBe('PARTIAL');
  });

  it('is DEFAULTED only once the month is over and nothing was paid', () => {
    expect(contributionCell({ ...base, paid: d(0), year: 2026, month: 4 })).toBe('DEFAULTED');
    expect(contributionCell({ ...base, paid: d(0), year: 2025, month: 12 })).toBe('DEFAULTED');
  });

  it('is only DUE in the current and future months', () => {
    expect(contributionCell({ ...base, paid: d(0), year: 2026, month: 5 })).toBe('DUE');
    expect(contributionCell({ ...base, paid: d(0), year: 2026, month: 8 })).toBe('DUE');
  });

  it('is NONE when no amount is expected, or before the account existed', () => {
    expect(contributionCell({ ...base, expected: null, paid: d(0), year: 2026, month: 3 })).toBe('NONE');
    expect(contributionCell({ ...base, openedBefore: false, paid: d(0), year: 2026, month: 3 })).toBe('NONE');
  });
});
