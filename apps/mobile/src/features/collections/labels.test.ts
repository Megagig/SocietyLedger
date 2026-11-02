import { amountProblem, exportFilename, matchesSearch, matchesSettlement, paymentFailure, settle } from './labels';

describe('settle', () => {
  it('is paid at or over the amount, part when some was paid, not paid when none', () => {
    expect(settle(3000, 3000).status).toBe('paid');
    expect(settle(3000, 3500)).toEqual({ balance: 0, status: 'paid' });
    expect(settle(3000, 1000)).toEqual({ balance: 2000, status: 'part' });
    expect(settle(3000, 0)).toEqual({ balance: 3000, status: 'unpaid' });
  });
  it('does not drift on pence', () => {
    expect(settle(0.3, 0.1).balance).toBe(0.2);
  });
});

describe('matchesSettlement', () => {
  it('treats "yet to pay" as part paid and not paid together', () => {
    expect(matchesSettlement('part', 'owing')).toBe(true);
    expect(matchesSettlement('unpaid', 'owing')).toBe(true);
    expect(matchesSettlement('paid', 'owing')).toBe(false);
    expect(matchesSettlement('paid', 'all')).toBe(true);
    expect(matchesSettlement('part', 'unpaid')).toBe(false);
  });
});

describe('matchesSearch', () => {
  it('finds a member by name or number, in any case and word order', () => {
    expect(matchesSearch('adA', 'Ada Obi', 'MEM0001')).toBe(true);
    expect(matchesSearch('obi ada', 'Ada Obi', 'MEM0001')).toBe(true);
    expect(matchesSearch('mem0001', 'Ada Obi', 'MEM0001')).toBe(true);
    expect(matchesSearch('   ', 'Ada Obi')).toBe(true);
    expect(matchesSearch('zzz', 'Ada Obi', null)).toBe(false);
  });
});

describe('amountProblem', () => {
  it('refuses zero, blank, nonsense and more than the balance, and shows the limit in full', () => {
    expect(amountProblem('', 3000)).toBe('Enter an amount above zero.');
    expect(amountProblem('0', 3000)).toBe('Enter an amount above zero.');
    expect(amountProblem('abc', 3000)).toBe('Enter an amount above zero.');
    expect(amountProblem('3001', 3000)).toBe('At most ₦3,000.00.');
    expect(amountProblem('3000', 3000)).toBeNull();
    expect(amountProblem('1500.50', 3000)).toBeNull();
  });
});

describe('paymentFailure', () => {
  it('keeps the server wording and the charge it was about', () => {
    expect(paymentFailure({ message: 'Payment amount exceeds balance. Maximum: 3000', transactionId: 7 })).toEqual({ message: 'Payment amount exceeds balance. Maximum: 3000', transactionId: 7 });
  });
  it('falls back to words that say nothing was saved', () => {
    expect(paymentFailure(null).message).toContain('Nothing was saved');
  });
});

describe('exportFilename', () => {
  it('names the file for the screen, the filter and the day', () => {
    expect(exportFilename('levy-campaign', 'owing', 'xlsx', new Date('2026-11-02T10:00:00Z'))).toBe('levy-campaign-owing-2026-11-02.xlsx');
  });
});
