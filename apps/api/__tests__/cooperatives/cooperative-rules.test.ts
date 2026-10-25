/**
 * Cooperative money rules: nobody decides their own money, a withdrawal can't overdraw, a loan is credited to a real account of the
 * borrower, and a repayment can't be more than is owed.
 */
import { Decimal } from '@prisma/client/runtime/library';
import {
  REVIEWABLE_STATUSES,
  assertDisbursementAccount,
  assertDisbursementTarget,
  assertNotOwnRequest,
  assertRepaymentWithinOutstanding,
  assertWithdrawable,
} from '../../src/modules/cooperatives/cooperative-rules';

describe('assertNotOwnRequest', () => {
  it('refuses an officer deciding their own request, with a status and a code the apps can use', () => {
    try {
      assertNotOwnRequest(7, 7);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toMatchObject({ status: 403, code: 'OWN_REQUEST' });
    }
  });

  it('allows another officer, and a request whose owner has no login', () => {
    expect(() => assertNotOwnRequest(7, 8)).not.toThrow();
    expect(() => assertNotOwnRequest(7, null)).not.toThrow();
    expect(() => assertNotOwnRequest(7, undefined)).not.toThrow();
  });
});

describe('assertWithdrawable', () => {
  it('allows up to the whole balance and refuses more', () => {
    expect(() => assertWithdrawable(new Decimal(5000), new Decimal(5000))).not.toThrow();
    expect(() => assertWithdrawable(new Decimal(5000), new Decimal(5000.01))).toThrow(/Insufficient balance/);
  });
});

describe('assertRepaymentWithinOutstanding', () => {
  it('allows paying off exactly what is owed, and nothing more', () => {
    expect(() => assertRepaymentWithinOutstanding(100000, new Decimal(100000))).not.toThrow();
    expect(() => assertRepaymentWithinOutstanding(100000.01, new Decimal(100000))).toThrow(/₦100,000\.00/);
  });

  it('carries a code', () => {
    try {
      assertRepaymentWithinOutstanding(2, new Decimal(1));
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: 'REPAYMENT_TOO_LARGE' });
    }
  });
});

describe('disbursing a loan', () => {
  it('crediting savings needs the account to be named; other methods do not', () => {
    expect(() => assertDisbursementTarget('savings_credit', undefined)).toThrow(/Choose/);
    expect(() => assertDisbursementTarget('savings_credit', 4)).not.toThrow();
    expect(() => assertDisbursementTarget('bank_transfer', undefined)).not.toThrow();
    expect(() => assertDisbursementTarget('cash', undefined)).not.toThrow();
  });

  it('the account must be the borrower\'s own and open', () => {
    expect(() => assertDisbursementAccount({ memberId: 3, status: 'ACTIVE' }, 3)).not.toThrow();
    expect(() => assertDisbursementAccount(null, 3)).toThrow(/open savings account/);
    expect(() => assertDisbursementAccount({ memberId: 9, status: 'ACTIVE' }, 3)).toThrow(/open savings account/);
    expect(() => assertDisbursementAccount({ memberId: 3, status: 'CLOSED' }, 3)).toThrow(/open savings account/);
  });
});

describe('REVIEWABLE_STATUSES', () => {
  it('only an application still waiting can be reviewed', () => {
    expect(REVIEWABLE_STATUSES).toEqual(['PENDING_REVIEW', 'UNDER_REVIEW', 'PENDING_APPROVAL']);
  });
});
