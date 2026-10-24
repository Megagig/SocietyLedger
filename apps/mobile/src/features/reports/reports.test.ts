import { chargeHref, chargesHref, ledgerHref, parseChargeParams, parsePaymentParams, paymentsHref } from './drill';
import { customRange, defaultPeriod, exportTypeLabel, fileSizeLabel, isExpired, percentLabel, rangeParams, safeFilename } from './labels';

describe('drill-down links', () => {
  it('a figure builds a link the list screen reads back as the same filters', () => {
    const href = chargesHref({ scope: 'aging', bucket: 'over90', memberId: 7, asOfDate: '2026-10-15T12:00:00.000Z' }, 'Over 90 days late');
    expect(href.startsWith('/(app)/(tabs)/manage/reports/charges?')).toBe(true);
    const query = Object.fromEntries(new URLSearchParams(href.split('?')[1]));
    expect(query.title).toBe('Over 90 days late');
    expect(parseChargeParams(query)).toMatchObject({ scope: 'aging', bucket: 'over90', memberId: 7, asOfDate: '2026-10-15T12:00:00.000Z' });
  });

  it('leaves out filters that are not set, and keeps the still-owed flag', () => {
    const href = chargesHref({ scope: 'raised', startDate: 'a', endDate: 'b', owingOnly: true }, 'Still owed');
    expect(href).not.toContain('categoryId');
    expect(parseChargeParams(Object.fromEntries(new URLSearchParams(href.split('?')[1])))).toMatchObject({ scope: 'raised', owingOnly: true });
    expect(parseChargeParams({ scope: 'owing' }).owingOnly).toBeUndefined();
  });

  it('payments carry their period, category and method', () => {
    const href = paymentsHref({ startDate: 's', endDate: 'e', categoryId: 3, paymentMethod: 'unspecified' }, 'Not recorded');
    expect(parsePaymentParams(Object.fromEntries(new URLSearchParams(href.split('?')[1])))).toEqual({
      startDate: 's', endDate: 'e', categoryId: 3, categoryType: undefined, memberId: undefined, paymentMethod: 'unspecified',
    });
  });

  it('the last level opens a charge or a member ledger', () => {
    expect(chargeHref(12)).toBe('/(app)/(tabs)/manage/finance/transactions/12');
    expect(ledgerHref(4)).toBe('/(app)/(tabs)/manage/finance/ledgers/4');
  });
});

describe('periods', () => {
  it('a named period is ready at once; a custom one only when both dates are picked', () => {
    expect(rangeParams(defaultPeriod())).toEqual({ period: 'this_month' });
    expect(rangeParams({ period: 'custom' })).toBeNull();
    expect(rangeParams({ period: 'custom', startDate: 'a' })).toBeNull();
    expect(rangeParams({ period: 'custom', startDate: 'a', endDate: 'b' })).toEqual({ period: 'custom', startDate: 'a', endDate: 'b' });
  });

  it('a custom range runs from the start of the first day to the end of the last', () => {
    const { startDate, endDate } = customRange(new Date(2026, 0, 5, 15, 30), new Date(2026, 0, 9, 8, 0));
    expect(new Date(startDate).getHours()).toBe(0);
    expect(new Date(endDate).getHours()).toBe(23);
    expect(new Date(endDate).getDate()).toBe(9);
  });
});

describe('labels', () => {
  it('shows percentages to one decimal at most, and file sizes in KB or MB', () => {
    expect(percentLabel(12.5)).toBe('12.5%');
    expect(percentLabel(20)).toBe('20%');
    expect(percentLabel(33.333)).toBe('33.3%');
    expect(fileSizeLabel(800)).toBe('1 KB');
    expect(fileSizeLabel(5 * 1024)).toBe('5 KB');
    expect(fileSizeLabel(3.2 * 1_048_576)).toBe('3.2 MB');
  });

  it('knows when a file has expired', () => {
    const now = new Date('2026-10-20T10:00:00Z');
    expect(isExpired('2026-10-19T10:00:00Z', now)).toBe(true);
    expect(isExpired('2026-10-27T10:00:00Z', now)).toBe(false);
  });

  it('only keeps safe characters in a file name', () => {
    expect(safeFilename('financial_summary_1_2026-10-20.pdf')).toBe('financial_summary_1_2026-10-20.pdf');
    expect(safeFilename('../../etc/pass wd?.pdf')).toBe('etc_pass_wd_.pdf');
    expect(safeFilename('')).toBe('export');
  });

  it('gives each export type a readable name', () => {
    expect(exportTypeLabel('financial_summary')).toBe('Financial summary');
    expect(exportTypeLabel('some_new_type')).toBe('Some new type');
  });
});
