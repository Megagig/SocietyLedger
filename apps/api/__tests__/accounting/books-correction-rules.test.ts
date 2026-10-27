import { correctionLines, inflowCodeOf, netOf, targetPosting, type EntryLineLike, type NetByAccount } from '../../src/modules/accounting/books-correction-rules';

const lines = (...l: Array<[string, number, number]>): EntryLineLike[] => l.map(([accountCode, debit, credit]) => ({ accountCode, debit, credit }));

/** Apply a correction to a set of balances, as posting it would. */
function apply(actual: NetByAccount, fix: ReturnType<typeof correctionLines>): NetByAccount {
  const next = { ...actual };
  for (const l of fix) next[l.accountCode] = Math.round(((next[l.accountCode] ?? 0) + l.debit - l.credit) * 100) / 100;
  return next;
}

describe('books target for a donation', () => {
  it('an instant donation leaves the cash and the income, and nothing in the receivable', () => {
    const target = targetPosting({ categoryType: 'donation', amount: 20000, isVoided: false, includeCharge: true, payments: [{ amountPaid: 20000, inflowCode: '1112', include: true }] });
    expect(target).toEqual({ '1123': 0, '4300': -20000, '1112': 20000 });
  });

  it('an unpaid pledge stays in Donation Pledges Receivable and counts as income, with no cash', () => {
    const target = targetPosting({ categoryType: 'donation', amount: 10000, isVoided: false, includeCharge: true, payments: [] });
    expect(target).toEqual({ '1123': 10000, '4300': -10000 });
  });

  it('a part-paid pledge leaves the unpaid part in the receivable', () => {
    const target = targetPosting({ categoryType: 'donation', amount: 10000, isVoided: false, includeCharge: true, payments: [{ amountPaid: 4000, inflowCode: '1112', include: true }] });
    expect(target['1123']).toBe(6000);
    expect(target['1112']).toBe(4000);
  });

  it('a voided charge is no longer owed but money already paid against it still counts', () => {
    const target = targetPosting({ categoryType: 'donation', amount: 10000, isVoided: true, includeCharge: true, payments: [{ amountPaid: 4000, inflowCode: '1112', include: true }] });
    expect(target).toEqual({ '1112': 4000, '1123': -4000 });
  });
});

describe('correcting what the old code posted', () => {
  // What the old code left in the books for ONE instant donation of 20,000 made through the admin screen:
  //   charge:  Dr Bank 20,000 / Cr Donation Income 20,000
  //   payment: Dr Bank 20,000 / Cr Dues Receivable 20,000   (a donation paid against the DUES receivable)
  const oldInstant = netOf(lines(['1112', 20000, 0], ['4300', 0, 20000], ['1112', 20000, 0], ['1121', 0, 20000]));
  const targetInstant = targetPosting({ categoryType: 'donation', amount: 20000, isVoided: false, includeCharge: true, payments: [{ amountPaid: 20000, inflowCode: '1112', include: true }] });

  it('takes the doubled cash out of the bank and puts the dues receivable back to zero', () => {
    const fix = correctionLines(targetInstant, oldInstant);
    expect(fix).toEqual([
      { accountCode: '1112', debit: 0, credit: 20000 },
      { accountCode: '1121', debit: 20000, credit: 0 },
    ]);
  });

  it('after the correction the books equal the target, and a second correction finds nothing to do', () => {
    const once = apply(oldInstant, correctionLines(targetInstant, oldInstant));
    expect(correctionLines(targetInstant, once)).toEqual([]);
  });

  it('fixes the third copy the cash route used to post, and keeps the money in Cash in hand', () => {
    // charge Dr Bank/Cr Income, payment Dr Cash in hand/Cr Dues Receivable, plus a second income copy Dr Cash in hand/Cr Income
    const actual = netOf(lines(['1112', 20000, 0], ['4300', 0, 20000], ['1114', 20000, 0], ['1121', 0, 20000], ['1114', 20000, 0], ['4300', 0, 20000]));
    const paymentLines = lines(['1114', 20000, 0], ['1121', 0, 20000], ['1114', 20000, 0], ['4300', 0, 20000]);
    expect(inflowCodeOf(paymentLines)).toBe('1114');
    const target = targetPosting({ categoryType: 'donation', amount: 20000, isVoided: false, includeCharge: true, payments: [{ amountPaid: 20000, inflowCode: '1114', include: true }] });
    const fixed = apply(actual, correctionLines(target, actual));
    expect(fixed['4300']).toBe(-20000); // income once, not twice
    expect(fixed['1112'] ?? 0).toBe(0); // nothing left in the bank that was never banked
    expect(fixed['1114']).toBe(20000);
    expect(fixed['1121'] ?? 0).toBe(0);
    expect(correctionLines(target, fixed)).toEqual([]);
  });

  it('moves an unpaid pledge out of the bank into the receivable', () => {
    const actual = netOf(lines(['1112', 10000, 0], ['4300', 0, 10000])); // old: pledge posted as cash
    const target = targetPosting({ categoryType: 'donation', amount: 10000, isVoided: false, includeCharge: true, payments: [] });
    expect(correctionLines(target, actual)).toEqual([
      { accountCode: '1112', debit: 0, credit: 10000 },
      { accountCode: '1123', debit: 10000, credit: 0 },
    ]);
  });

  it('every correction balances', () => {
    for (const [target, actual] of [
      [targetInstant, oldInstant],
      [{ '1123': 6000, '1112': 4000, '4300': -10000 }, { '1112': 14000, '1121': -4000, '4300': -10000 }],
    ] as Array<[NetByAccount, NetByAccount]>) {
      const fix = correctionLines(target, actual);
      expect(fix.reduce((s, l) => s + l.debit, 0)).toBe(fix.reduce((s, l) => s + l.credit, 0));
    }
  });

  it('refuses to produce a lopsided entry', () => {
    expect(() => correctionLines({ '1112': 100 }, {})).toThrow('does not balance');
  });
});
