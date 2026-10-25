/**
 * Welfare money rules: the recorder can't confirm, only active members take part, and a payout is capped by what was asked, the fund's
 * maximum and what the fund holds.
 */
import { Decimal } from '@prisma/client/runtime/library';
import {
  REVIEWABLE_PAYOUT_STATUSES,
  assertApprovalAmount,
  assertContributionAmount,
  assertMemberActive,
  assertNotRecorder,
} from '../../src/modules/welfare/welfare-rules';

describe('assertNotRecorder', () => {
  it('the officer who recorded a contribution cannot confirm it', () => {
    try {
      assertNotRecorder(7, 7);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toMatchObject({ status: 403, code: 'OWN_RECORDING' });
    }
  });

  it('another officer can, and an older contribution with no recorder is open to anyone allowed', () => {
    expect(() => assertNotRecorder(7, 8)).not.toThrow();
    expect(() => assertNotRecorder(7, null)).not.toThrow();
    expect(() => assertNotRecorder(7, undefined)).not.toThrow();
  });
});

describe('assertMemberActive', () => {
  it('only an active member contributes or asks for a payout', () => {
    expect(() => assertMemberActive('active', 'contribute')).not.toThrow();
    expect(() => assertMemberActive('suspended', 'contribute')).toThrow(/contribute/);
    expect(() => assertMemberActive('terminated', 'request')).toThrow(/payout/);
  });
});

describe('assertContributionAmount', () => {
  it('needs an amount above zero that meets the fund\'s minimum', () => {
    expect(() => assertContributionAmount(1000, null)).not.toThrow();
    expect(() => assertContributionAmount(1000, new Decimal(1000))).not.toThrow();
    expect(() => assertContributionAmount(500, new Decimal(1000))).toThrow(/smallest contribution.*₦1,000\.00/);
    expect(() => assertContributionAmount(0, null)).toThrow(/above/);
  });
});

describe('assertApprovalAmount', () => {
  const base = { requested: new Decimal(50000), maxPayout: new Decimal(100000), balance: new Decimal(80000) };

  it('allows up to what was asked, within the fund\'s limits', () => {
    expect(() => assertApprovalAmount({ ...base, approved: 50000 })).not.toThrow();
    expect(() => assertApprovalAmount({ ...base, approved: 20000 })).not.toThrow();
  });

  it('never more than was asked for', () => {
    try {
      assertApprovalAmount({ ...base, approved: 60000 });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: 'APPROVAL_TOO_LARGE' });
    }
  });

  it('never more than the fund pays out at a time, nor more than the fund holds', () => {
    expect(() => assertApprovalAmount({ ...base, requested: new Decimal(200000), balance: new Decimal(500000), approved: 150000 })).toThrow(/at most ₦100,000\.00/);
    try {
      assertApprovalAmount({ ...base, maxPayout: null, balance: new Decimal(30000), approved: 40000 });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toMatchObject({ status: 409, code: 'FUND_INSUFFICIENT' });
    }
  });

  it('a fund with no maximum is only limited by what was asked and what it holds', () => {
    expect(() => assertApprovalAmount({ ...base, maxPayout: null, approved: 50000 })).not.toThrow();
  });

  it('an amount of zero is refused', () => {
    expect(() => assertApprovalAmount({ ...base, approved: 0 })).toThrow(/above/);
  });
});

describe('REVIEWABLE_PAYOUT_STATUSES', () => {
  it('only a waiting request can be reviewed', () => {
    expect(REVIEWABLE_PAYOUT_STATUSES).toEqual(['PENDING', 'UNDER_REVIEW']);
  });
});
