import {
  applicationCanDisburse,
  applicationCanReview,
  applicationStatusKey,
  availabilityLine,
  disbursedSummary,
  guarantorSummary,
  isOwnRequest,
  loanCanTakeRepayment,
  loanPercentRepaid,
  productTermsLine,
} from './labels';

describe('isOwnRequest', () => {
  it('a request is your own when it belongs to your member record', () => {
    expect(isOwnRequest(7, 7)).toBe(true);
    expect(isOwnRequest(7, 8)).toBe(false);
  });
  it('an officer with no member record owns nothing', () => {
    expect(isOwnRequest(7, undefined)).toBe(false);
  });
});

describe('applications', () => {
  it('can be reviewed while waiting, never once decided or paid out', () => {
    for (const status of ['PENDING_REVIEW', 'UNDER_REVIEW', 'PENDING_APPROVAL'] as const) expect(applicationCanReview(status)).toBe(true);
    for (const status of ['APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED', 'DRAFT', 'PENDING_GUARANTORS'] as const) expect(applicationCanReview(status)).toBe(false);
  });

  it('can be paid out only when approved', () => {
    expect(applicationCanDisburse('APPROVED')).toBe(true);
    expect(applicationCanDisburse('DISBURSED')).toBe(false);
    expect(applicationCanDisburse('PENDING_REVIEW')).toBe(false);
  });

  it('maps the waiting statuses to one chip key', () => {
    expect(applicationStatusKey('PENDING_REVIEW')).toBe('pending_review');
    expect(applicationStatusKey('UNDER_REVIEW')).toBe('pending_review');
    expect(applicationStatusKey('APPROVED')).toBe('approved');
    expect(applicationStatusKey('PENDING_GUARANTORS')).toBe('pending_guarantors');
  });

  it('summarises the guarantors', () => {
    expect(guarantorSummary([{ status: 'ACCEPTED' }, { status: 'PENDING' }], 2)).toBe('1 of 2 accepted');
    expect(guarantorSummary([], 2)).toBe('Needs 2 guarantors');
    expect(guarantorSummary([], 1)).toBe('Needs 1 guarantor');
    expect(guarantorSummary([], 0)).toBe('No guarantors');
  });
});

describe('loans', () => {
  it('takes a repayment while active or overdue, not once paid off or written off', () => {
    expect(loanCanTakeRepayment('ACTIVE')).toBe(true);
    expect(loanCanTakeRepayment('OVERDUE')).toBe(true);
    expect(loanCanTakeRepayment('PAID_OFF')).toBe(false);
    expect(loanCanTakeRepayment('WRITTEN_OFF')).toBe(false);
  });

  it('works out the percent repaid, capped at 100 and safe on an empty loan', () => {
    expect(loanPercentRepaid('25000', '100000')).toBe(25);
    expect(loanPercentRepaid(120000, 100000)).toBe(100);
    expect(loanPercentRepaid(0, 0)).toBe(0);
  });
});

describe('products', () => {
  it('describes the terms in one line, in full naira', () => {
    expect(
      productTermsLine({ interestRate: '10', interestType: 'REDUCING_BALANCE', minTenureMonths: 3, maxTenureMonths: 12, minAmount: '10000', maxAmount: '500000' }),
    ).toBe('10% reducing balance · 3–12 months · ₦10,000.00 to ₦500,000.00');
    expect(productTermsLine({ interestRate: '5', interestType: 'FLAT', minTenureMonths: 6, maxTenureMonths: 6, minAmount: '1000', maxAmount: '2000' })).toContain('6 months');
  });
});

describe('money wording', () => {
  it('says how much of the savings can leave', () => {
    expect(availabilityLine(40000, 0)).toBe('Available ₦40,000.00');
    expect(availabilityLine(40000, 60000)).toBe('Available ₦40,000.00 · ₦60,000.00 held against a loan');
  });
  it('says where a loan went', () => {
    expect(disbursedSummary('savings_credit')).toBe('Loan paid out into savings');
    expect(disbursedSummary('cash')).toBe('Loan marked as paid out');
  });
});
