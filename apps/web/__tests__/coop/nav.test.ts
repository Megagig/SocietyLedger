import { coopGroupForPath } from '../../src/lib/coop/navGroups';
import { notificationHref } from '../../src/lib/notification-link';

describe('the cooperative sidebar group for a page', () => {
  it('opens the group that holds the page, including sub-pages', () => {
    expect(coopGroupForPath('/dashboard/cooperatives/my-savings')).toBe('Savings');
    expect(coopGroupForPath('/dashboard/cooperatives/my-withdrawal')).toBe('Savings');
    expect(coopGroupForPath('/dashboard/cooperatives/my-cashbook')).toBe('Transactions');
    expect(coopGroupForPath('/dashboard/cooperatives/my-pending-payments')).toBe('Transactions');
    expect(coopGroupForPath('/dashboard/cooperatives/repay-loan')).toBe('Loans');
    expect(coopGroupForPath('/dashboard/cooperatives/guarantors/12')).toBe('Loans');
  });

  it('opens nothing for the dashboard, officer pages, other modules, or a page that only starts with the same letters', () => {
    expect(coopGroupForPath('/dashboard/cooperatives/my-dashboard')).toBeNull();
    expect(coopGroupForPath('/dashboard/cooperatives/payment-requests')).toBeNull();
    expect(coopGroupForPath('/dashboard/cooperatives/loan-repayments')).toBeNull(); // the officer queue, not the member's Loan Repayment
    expect(coopGroupForPath('/dashboard/cooperatives/my-savingsX')).toBeNull();
    expect(coopGroupForPath('/dashboard/welfare/requests')).toBeNull();
  });
});

describe('where a cooperative notification takes you', () => {
  it('sends an officer to the right queue and the member to their own page', () => {
    expect(notificationHref('savings.deposit_submitted')).toBe('/dashboard/cooperatives/payment-requests');
    expect(notificationHref('savings.deposit_decision')).toBe('/dashboard/cooperatives/my-pending-payments');
    expect(notificationHref('savings.withdrawal_submitted')).toBe('/dashboard/cooperatives/withdrawals');
    expect(notificationHref('savings.withdrawal_decision')).toBe('/dashboard/cooperatives/my-withdrawal');
  });
});
