/**
 * Late fees are for a real overdue debt (a due or a levy), and a waiver forgives money that is actually still owed.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { RuleError } from '../../src/modules/finance/rule-error';
import { assertDonationAllowed } from '../../src/modules/finance/advanced/donation-entry-rules';
import {
  assertFeeValid,
  assertWaivable,
  lateFeeDue,
  pickRule,
  waiverOutcome,
  type LateFeeCharge,
  type LateFeeRuleLike,
} from '../../src/modules/finance/advanced/penalty-rules';

const now = new Date('2026-11-01T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

const rule = (over: Partial<LateFeeRuleLike> = {}): LateFeeRuleLike => ({ id: 1, categoryId: null, gracePeriodDays: 7, isCompounding: false, compoundingDays: null, ...over });
const charge = (over: Partial<LateFeeCharge> = {}): LateFeeCharge => ({ isVoided: false, status: 'pending', dueDate: daysAgo(30), categoryId: 10, categoryType: 'due', ...over });

describe('pickRule', () => {
  it('a rule for the charge\'s own category wins over a general one', () => {
    const specific = rule({ id: 2, categoryId: 10 });
    expect(pickRule([rule(), specific], { categoryId: 10, categoryType: 'due' })).toBe(specific);
  });

  it('a general rule covers dues and levies only', () => {
    const general = rule();
    expect(pickRule([general], { categoryId: 10, categoryType: 'due' })).toBe(general);
    expect(pickRule([general], { categoryId: 11, categoryType: 'levy' })).toBe(general);
    expect(pickRule([general], { categoryId: 12, categoryType: 'donation' })).toBeUndefined();
    expect(pickRule([general], { categoryId: 13, categoryType: 'penalty' })).toBeUndefined();
  });

  it('a rule that names a donation category is an explicit opt-in, but a penalty never earns a penalty', () => {
    const forDonations = rule({ id: 3, categoryId: 12 });
    expect(pickRule([forDonations], { categoryId: 12, categoryType: 'donation' })).toBe(forDonations);
    const forPenalties = rule({ id: 4, categoryId: 13 });
    expect(pickRule([forPenalties], { categoryId: 13, categoryType: 'penalty' })).toBeUndefined();
  });
});

describe('lateFeeDue', () => {
  it('charges a charge that is past its due date and grace period', () => {
    expect(lateFeeDue(charge(), rule(), null, now)).toBe(true);
  });

  it('never charges a voided charge', () => {
    expect(lateFeeDue(charge({ isVoided: true }), rule(), null, now)).toBe(false);
  });

  it('waits out the grace period, and ignores a charge that is not yet due or already settled', () => {
    expect(lateFeeDue(charge({ dueDate: daysAgo(5) }), rule({ gracePeriodDays: 7 }), null, now)).toBe(false);
    expect(lateFeeDue(charge({ dueDate: new Date(now.getTime() + 86_400_000) }), rule(), null, now)).toBe(false);
    expect(lateFeeDue(charge({ dueDate: null }), rule(), null, now)).toBe(false);
    expect(lateFeeDue(charge({ status: 'paid' }), rule(), null, now)).toBe(false);
    expect(lateFeeDue(charge({ status: 'waived' }), rule(), null, now)).toBe(false);
  });

  it('a rule that does not repeat charges once, pressing it again does nothing', () => {
    expect(lateFeeDue(charge(), rule(), daysAgo(1), now)).toBe(false);
  });

  it('a repeating rule waits its compounding days between charges', () => {
    const repeating = rule({ isCompounding: true, compoundingDays: 30 });
    expect(lateFeeDue(charge(), repeating, daysAgo(10), now)).toBe(false);
    expect(lateFeeDue(charge(), repeating, daysAgo(31), now)).toBe(true);
  });
});

describe('assertWaivable', () => {
  const penalty = { categoryType: 'penalty', isVoided: false, status: 'pending' };

  it('allows waiving up to what is still owed', () => {
    expect(() => assertWaivable(penalty, new Decimal(5000), 5000)).not.toThrow();
    expect(() => assertWaivable(penalty, new Decimal(5000), 1250.5)).not.toThrow();
  });

  it('refuses more than is owed', () => {
    expect(() => assertWaivable(penalty, new Decimal(5000), 5000.01)).toThrow(/at most 5000\.00/);
  });

  it('refuses anything that is not a live penalty with something owed', () => {
    expect(() => assertWaivable({ ...penalty, categoryType: 'due' }, new Decimal(5000), 100)).toThrow(RuleError);
    expect(() => assertWaivable({ ...penalty, isVoided: true }, new Decimal(5000), 100)).toThrow(/voided/);
    expect(() => assertWaivable({ ...penalty, status: 'waived' }, new Decimal(5000), 100)).toThrow(/already been waived/);
    expect(() => assertWaivable(penalty, new Decimal(0), 100)).toThrow(/Nothing is owed/);
    expect(() => assertWaivable(penalty, new Decimal(5000), 0)).toThrow(/above/);
  });

  it('carries a status and a code the apps can react to', () => {
    try {
      assertWaivable({ ...penalty, status: 'waived' }, new Decimal(5000), 100);
    } catch (error) {
      expect(error).toMatchObject({ status: 409, code: 'ALREADY_WAIVED' });
    }
  });
});

describe('waiverOutcome', () => {
  it('a partial waiver lowers the amount and leaves the rest owed', () => {
    const outcome = waiverOutcome(new Decimal(5000), new Decimal(0), 2000);
    expect(outcome.newAmount.toNumber()).toBe(3000);
    expect(outcome.fullyWaived).toBe(false);
  });

  it('forgiving everything that is owed is a full waiver, even when part was already paid', () => {
    const outcome = waiverOutcome(new Decimal(5000), new Decimal(1000), 4000);
    expect(outcome.newAmount.toNumber()).toBe(1000);
    expect(outcome.fullyWaived).toBe(true);
  });
});

describe('assertFeeValid', () => {
  it('a fee is above zero and a percentage is at most 100', () => {
    expect(() => assertFeeValid('fixed', 500)).not.toThrow();
    expect(() => assertFeeValid('percentage', 10)).not.toThrow();
    expect(() => assertFeeValid('percentage', 150)).toThrow(/at most 100/);
    expect(() => assertFeeValid('fixed', 0)).toThrow(/above/);
  });
});

describe('assertDonationAllowed', () => {
  const ok = { amount: 5000, memberStatus: 'active', donationType: 'instant' as const };

  it('accepts a real amount from an active member', () => {
    expect(() => assertDonationAllowed(ok, now)).not.toThrow();
  });

  it('refuses a zero or negative amount and an inactive donor', () => {
    expect(() => assertDonationAllowed({ ...ok, amount: 0 }, now)).toThrow(/above/);
    expect(() => assertDonationAllowed({ ...ok, memberStatus: 'suspended' }, now)).toThrow(/active member/);
  });

  it('a pledge date today or later is fine, one in the past is not, and it only matters for a pledge', () => {
    expect(() => assertDonationAllowed({ ...ok, donationType: 'pledge', pledgeDate: new Date('2026-11-01T00:00:00Z') }, now)).not.toThrow();
    expect(() => assertDonationAllowed({ ...ok, donationType: 'pledge', pledgeDate: new Date('2026-10-30T00:00:00Z') }, now)).toThrow(/past/);
    expect(() => assertDonationAllowed({ ...ok, donationType: 'instant', pledgeDate: new Date('2020-01-01') }, now)).not.toThrow();
  });
});
