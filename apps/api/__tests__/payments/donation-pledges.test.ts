/**
 * A pledge is a donation the member still owes: it must never be counted as money donated, and only the member it belongs to can
 * start an online payment for it.
 */
import { donationFigures } from '../../src/modules/member-finance/donation-rules';
import { userOwnsCharge } from '../../src/modules/payments/charge-ownership';

describe('donationFigures', () => {
  it('treats a donation with nothing paid as a pledge owing the whole amount', () => {
    expect(donationFigures({ amount: '100000', payments: [] })).toEqual({ amount: 100000, amountPaid: 0, balance: 100000, isPaid: false, isPledge: true });
  });

  it('counts a part-paid pledge as still owing the rest', () => {
    const figures = donationFigures({ amount: 100000, payments: [{ amountPaid: '30000' }, { amountPaid: 20000 }] });
    expect(figures).toMatchObject({ amountPaid: 50000, balance: 50000, isPledge: true, isPaid: false });
  });

  it('treats a fully paid donation as given, not a pledge', () => {
    expect(donationFigures({ amount: 5000, payments: [{ amountPaid: 5000 }] })).toMatchObject({ balance: 0, isPaid: true, isPledge: false });
  });

  it('never reports a negative balance when overpaid', () => {
    expect(donationFigures({ amount: 5000, payments: [{ amountPaid: 6000 }] })).toMatchObject({ balance: 0, isPaid: true });
  });
});

describe('userOwnsCharge', () => {
  it('matches the linked login', () => {
    expect(userOwnsCharge({ id: 4 }, { userId: 4, email: null })).toBe(true);
    expect(userOwnsCharge({ id: 5 }, { userId: 4, email: 'a@b.c' })).toBe(false);
  });

  it('matches an unlinked member by email, ignoring case and spaces', () => {
    expect(userOwnsCharge({ id: 5, email: ' Ada@Example.com ' }, { userId: null, email: 'ada@example.com' })).toBe(true);
    expect(userOwnsCharge({ id: 5, email: 'ada@example.com' }, { userId: null, email: 'other@example.com' })).toBe(false);
  });

  it('refuses when there is no signed-in user, or no way to match', () => {
    expect(userOwnsCharge(undefined, { userId: 4, email: null })).toBe(false);
    expect(userOwnsCharge({ id: 5 }, { userId: null, email: null })).toBe(false);
  });

  it('does not fall back to email when the member is linked to a different login', () => {
    expect(userOwnsCharge({ id: 5, email: 'ada@example.com' }, { userId: 9, email: 'ada@example.com' })).toBe(false);
  });
});
