import type { ReportColumn, ReportMetric } from '@/types/api/ajoReports';
import { describeRow, formatCell, formatMetric, rangeFor, reportFileName } from './reportFormat';
import { reportParams } from '@/api/endpoints/ajoReportParams';

// The phone shows exactly what the API works out, so what is tested here is how it is written: money in full, a dash for a figure that
// does not apply, every column of a table row still on its card, and the dates a quick choice means.
const TZ = 'Africa/Lagos';
const m = (over: Partial<ReportMetric>): ReportMetric => ({ key: 'k', label: 'K', kind: 'money', value: '0', ...over });
const col = (key: string, kind: ReportColumn['kind'], label = key): ReportColumn => ({ key, label, kind });

describe('formatMetric', () => {
  it('writes money in full, never abbreviated', () => {
    expect(formatMetric(m({ value: '4500000' }))).toBe('₦45,000.00');
    expect(formatMetric(m({ value: '123456789012' }))).toBe('₦1,234,567,890.12');
    expect(formatMetric(m({ value: '4500000' }))).not.toMatch(/\dk\b|\dm\b/i);
  });
  it('keeps the minus sign of a shortfall', () => {
    expect(formatMetric(m({ value: '-50000' }))).toBe('-₦500.00');
  });
  it('writes a percentage from basis points and a count with separators', () => {
    expect(formatMetric(m({ kind: 'percent', value: 1111 }))).toBe('11.1%');
    expect(formatMetric(m({ kind: 'int', value: 12345 }))).toBe('12,345');
  });
  it('shows a dash for a figure that does not apply, never a zero', () => {
    expect(formatMetric(m({ kind: 'percent', value: null }))).toBe('—');
  });
});

describe('formatCell', () => {
  it('writes each kind of cell, and leaves an empty one empty', () => {
    expect(formatCell(col('a', 'money'), '1000000', TZ)).toBe('₦10,000.00');
    expect(formatCell(col('a', 'date'), '2027-03-04', TZ)).toBe('4 Mar 2027');
    expect(formatCell(col('a', 'int'), 1234, TZ)).toBe('1,234');
    expect(formatCell(col('a', 'text'), 'Adaeze', TZ)).toBe('Adaeze');
    expect(formatCell(col('a', 'text'), null, TZ)).toBe('');
    expect(formatCell(col('a', 'text'), '', TZ)).toBe('');
  });
  it('writes a moment in the circle\'s own clock, not the phone\'s', () => {
    // 22:30 UTC is 23:30 in Lagos (UTC+1) and 17:30 in New York (UTC-5).
    expect(formatCell(col('a', 'datetime'), '2027-03-31T22:30:00.000Z', 'Africa/Lagos')).toContain('23:30');
    expect(formatCell(col('a', 'datetime'), '2027-03-31T22:30:00.000Z', 'America/New_York')).toContain('18:30');
  });
});

describe('describeRow', () => {
  const columns = [col('circle', 'text', 'Circle'), col('member', 'text', 'Member'), col('dueDate', 'date', 'Due date'), col('toPayKobo', 'money', 'Still to pay'), col('reason', 'text', 'Reason'), col('daysLate', 'int', 'Days late')];

  it('keeps every column of the web table on the card: the first text column is the title, the rest are lines', () => {
    const d = describeRow(columns, { circle: 'Market circle', member: 'Adaeze Okafor', dueDate: '2027-03-01', toPayKobo: '500000', reason: 'Hardship', daysLate: 9 }, TZ);
    expect(d.title).toBe('Adaeze Okafor');
    expect(d.circle).toBe('Market circle');
    expect(d.lines.map((l) => [l.label, l.value])).toEqual([['Due date', '1 Mar 2027'], ['Still to pay', '₦5,000.00'], ['Reason', 'Hardship'], ['Days late', '9']]);
  });
  it('leaves out an empty cell instead of drawing a blank line, but keeps a zero', () => {
    const d = describeRow(columns, { circle: 'A', member: 'Ada', dueDate: '2027-03-01', toPayKobo: '0', reason: null, daysLate: 0 }, TZ);
    expect(d.lines.map((l) => l.label)).toEqual(['Due date', 'Still to pay', 'Days late']);
    expect(d.lines.find((l) => l.label === 'Still to pay')?.value).toBe('₦0.00');
  });
  it('puts long free text under its label so it can use the whole width', () => {
    const d = describeRow([col('event', 'text'), col('what', 'text', 'What happened'), col('by', 'text', 'By')], { event: 'Payment reversed', what: 'A payment of ₦5,000.00 from Adaeze Okafor was reversed', by: 'Funke' }, TZ);
    expect(d.lines.find((l) => l.label === 'What happened')?.stacked).toBe(true);
    expect(d.lines.find((l) => l.label === 'By')?.stacked).toBe(false);
  });
  it('titles a row that has no text column by its first column', () => {
    const d = describeRow([col('dueDate', 'date', 'Due date'), col('amount', 'money', 'Amount')], { dueDate: '2027-03-01', amount: '100' }, TZ);
    expect(d.title).toBe('1 Mar 2027');
    expect(d.lines.map((l) => l.label)).toEqual(['Amount']);
  });
});

describe('rangeFor', () => {
  it('leaves "this month" to the API, which counts the running month in the circle\'s own timezone like the web', () => {
    expect(rangeFor('month', new Date(2027, 2, 15))).toEqual({});
  });
  it('gives last month, across a year end too', () => {
    expect(rangeFor('last-month', new Date(2027, 2, 15))).toEqual({ from: '2027-02-01', to: '2027-02-28' });
    expect(rangeFor('last-month', new Date(2028, 2, 15))).toEqual({ from: '2028-02-01', to: '2028-02-29' }); // a leap year
    expect(rangeFor('last-month', new Date(2027, 0, 5))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
  it('gives the last three months up to the end of this one', () => {
    expect(rangeFor('last-3-months', new Date(2027, 2, 15))).toEqual({ from: '2027-01-01', to: '2027-03-31' });
    expect(rangeFor('last-3-months', new Date(2027, 0, 10))).toEqual({ from: '2026-11-01', to: '2027-01-31' });
  });
  it('gives the whole year, which is within the 12-month limit', () => {
    const r = rangeFor('year', new Date(2027, 5, 1));
    expect(r).toEqual({ from: '2027-01-01', to: '2027-12-31' });
    expect((Date.parse(r.to as string) - Date.parse(r.from as string)) / 86_400_000 + 1).toBeLessThanOrEqual(366);
  });
});

describe('what is sent to the API', () => {
  it('leaves out every empty filter so the API\'s own default applies', () => {
    expect(reportParams({})).toEqual({});
    expect(reportParams({ groupId: null, from: '', membershipId: null, collectorUserId: null })).toEqual({});
  });
  it('sends what was chosen, and extras such as the page', () => {
    expect(reportParams({ groupId: 4, from: '2027-03-01', to: '2027-03-31', membershipId: 9, collectorUserId: 7 }, { page: 2, pageSize: 25 })).toEqual({ groupId: 4, from: '2027-03-01', to: '2027-03-31', membershipId: 9, collectorUserId: 7, page: 2, pageSize: 25 });
  });
  it('names the shared file the way the API does', () => {
    expect(reportFileName('contributions', '2027-03-01', '2027-03-31', 'pdf')).toBe('ajo-contributions-2027-03-01-to-2027-03-31.pdf');
  });
});
