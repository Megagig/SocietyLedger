import { matchesSearch, matchesSettlement, settle, transactionStatusesFor } from '../../src/modules/finance/collections/settlement';

describe('settle', () => {
  it('is paid at or over the amount, part when some was paid, unpaid when none', () => {
    expect(settle(3000, 3000).status).toBe('paid');
    expect(settle(3000, 3500).status).toBe('paid');
    expect(settle(3000, 1000)).toMatchObject({ status: 'part' });
    expect(settle(3000, 1000).balance.toNumber()).toBe(2000);
    expect(settle(3000, 0)).toMatchObject({ status: 'unpaid' });
  });
  it('never reports a negative balance', () => {
    expect(settle('3000.00', '3500.00').balance.toNumber()).toBe(0);
  });
});

describe('matchesSettlement', () => {
  it('treats "owing" as part paid and not paid together', () => {
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
    expect(matchesSearch('  ', 'Ada Obi')).toBe(true);
    expect(matchesSearch('zzz', 'Ada Obi', 'MEM0001')).toBe(false);
  });
});

describe('transactionStatusesFor', () => {
  it('maps the filter to the stored charge statuses', () => {
    expect(transactionStatusesFor('all')).toBeNull();
    expect(transactionStatusesFor('owing')).toEqual(['pending', 'partial']);
    expect(transactionStatusesFor('paid')).toEqual(['paid']);
  });
});
