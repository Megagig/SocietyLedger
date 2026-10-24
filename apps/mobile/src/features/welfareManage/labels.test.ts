import { approvalLimitReason, confirmGuard, fundCanDelete, fundProgress, fundRulesLine, maxApproval, payoutCanDisburse, payoutCanReview, payoutStatusKey, reviewedSummary } from './labels';

describe('funds', () => {
  it('shows progress to a target, and none without one', () => {
    expect(fundProgress({ targetBalance: '100000', currentBalance: '25000' })).toBe(25);
    expect(fundProgress({ targetBalance: '100000', currentBalance: '250000' })).toBe(100);
    expect(fundProgress({ targetBalance: null, currentBalance: '25000' })).toBeNull();
  });

  it('puts the payout rules in a line, in full naira', () => {
    expect(fundRulesLine({ maxPayout: '100000', waitingPeriodDays: 30, minContributionMonths: 6 })).toBe('Pays out up to ₦100,000.00 · waits 30 days · 6 months of contributions');
    expect(fundRulesLine({ maxPayout: null, waitingPeriodDays: 0, minContributionMonths: 0 })).toBe('No payout limit');
    expect(fundRulesLine({ maxPayout: null, waitingPeriodDays: 1, minContributionMonths: 1 })).toBe('No payout limit · waits 1 day · 1 month of contributions');
  });

  it('can be deleted only while it has no history', () => {
    expect(fundCanDelete({ _count: { contributions: 0, payoutRequests: 0 } })).toBe(true);
    expect(fundCanDelete({ _count: { contributions: 2, payoutRequests: 0 } })).toBe(false);
    expect(fundCanDelete({ _count: { contributions: 0, payoutRequests: 1 } })).toBe(false);
  });
});

describe('confirmGuard', () => {
  const contribution = (over: object = {}) => ({ status: 'PENDING' as const, memberId: 3, recordedBy: 50, ...over });

  it('another officer can confirm a waiting contribution', () => {
    expect(confirmGuard(contribution(), { memberId: 9, userId: 99 })).toBe('ok');
  });

  it('not one in your own name, and not one you recorded yourself', () => {
    expect(confirmGuard(contribution(), { memberId: 3, userId: 99 })).toBe('own');
    expect(confirmGuard(contribution({ recordedBy: 99 }), { memberId: 9, userId: 99 })).toBe('recorder');
  });

  it('an older contribution with no recorder is open to any allowed officer', () => {
    expect(confirmGuard(contribution({ recordedBy: null }), { memberId: 9, userId: 99 })).toBe('ok');
  });

  it('a decided one has nothing to confirm', () => {
    expect(confirmGuard(contribution({ status: 'CONFIRMED' }), { memberId: 9, userId: 99 })).toBe('decided');
  });

  it('an officer with no member record owns no contribution', () => {
    expect(confirmGuard(contribution(), { memberId: undefined, userId: 99 })).toBe('ok');
  });
});

describe('payouts', () => {
  it('can be reviewed while waiting or under review, paid out only when approved', () => {
    expect(payoutCanReview('PENDING')).toBe(true);
    expect(payoutCanReview('UNDER_REVIEW')).toBe(true);
    expect(payoutCanReview('APPROVED')).toBe(false);
    expect(payoutCanDisburse('APPROVED')).toBe(true);
    expect(payoutCanDisburse('DISBURSED')).toBe(false);
    expect(payoutCanDisburse('PENDING')).toBe(false);
  });

  it('maps statuses to chip keys', () => {
    expect(payoutStatusKey('UNDER_REVIEW')).toBe('under_review');
    expect(payoutStatusKey('DISBURSED')).toBe('disbursed');
    expect(payoutStatusKey('PENDING')).toBe('pending');
  });

  it('the most to approve is the least of what was asked, the fund\'s limit and its balance', () => {
    expect(maxApproval({ requested: '50000', maxPayout: '100000', balance: '80000' })).toBe(50000);
    expect(maxApproval({ requested: '50000', maxPayout: '30000', balance: '80000' })).toBe(30000);
    expect(maxApproval({ requested: '50000', maxPayout: null, balance: '20000' })).toBe(20000);
    expect(maxApproval({ requested: '50000', maxPayout: null, balance: '0' })).toBe(0);
  });

  it('says which limit applies', () => {
    expect(approvalLimitReason({ requested: '50000', maxPayout: '30000', balance: '80000' })).toBe('the fund pays out at most ₦30,000.00');
    expect(approvalLimitReason({ requested: '50000', maxPayout: null, balance: '20000' })).toBe('the fund only holds ₦20,000.00');
    expect(approvalLimitReason({ requested: '50000', maxPayout: null, balance: '90000' })).toBe('₦50,000.00 was asked for');
  });

  it('says what a decision did', () => {
    expect(reviewedSummary(true, 30000)).toBe('Approved ₦30,000.00 — it can now be paid out');
    expect(reviewedSummary(false, 0)).toBe('Rejected — the member has been told why');
  });
});
