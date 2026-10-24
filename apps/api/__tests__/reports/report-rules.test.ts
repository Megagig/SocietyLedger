/**
 * The rules every report and drill-down list share. These guard the bugs this replaced: periods cut on the server's clock instead of
 * Lagos', a custom range that was silently ignored, and aging buckets that didn't add up to their own members.
 */
import {
  agingBucketOf,
  agingWhere,
  daysOverdue,
  groupKey,
  groupLabel,
  groupRange,
  MAX_RANGE_DAYS,
  monthKey,
  percent,
  periodRange,
  previousRange,
} from '../../src/modules/reports/report-rules';

// 12:00 in Lagos on 15 Oct 2026 (UTC+1)
const NOW = new Date('2026-10-15T11:00:00.000Z');

describe('periods are cut in Lagos time', () => {
  it('this month starts at midnight in Lagos, an hour before midnight UTC', () => {
    const r = periodRange('this_month', {}, NOW);
    expect(r.startDate.toISOString()).toBe('2026-09-30T23:00:00.000Z');
    expect(r.endDate.toISOString()).toBe('2026-10-31T22:59:59.999Z');
    expect(r.label).toBe('October 2026');
  });

  it('a moment just after midnight in Lagos on 1 November is already November', () => {
    const justAfter = new Date('2026-10-31T23:30:00.000Z');
    expect(periodRange('this_month', {}, justAfter).label).toBe('November 2026');
    expect(monthKey(justAfter)).toBe('2026-11');
  });

  it('knows last month across the new year, quarters and years', () => {
    expect(periodRange('last_month', {}, new Date('2027-01-10T10:00:00Z')).label).toBe('December 2026');
    expect(periodRange('this_quarter', {}, NOW).label).toBe('Q4 2026');
    expect(periodRange('last_quarter', {}, new Date('2027-02-10T10:00:00Z')).label).toBe('Q4 2026');
    expect(periodRange('this_year', {}, NOW).label).toBe('2026');
    expect(periodRange('last_year', {}, NOW).startDate.toISOString()).toBe('2024-12-31T23:00:00.000Z');
  });

  it('the period before is the same length and ends where this one starts', () => {
    const r = periodRange('this_month', {}, NOW);
    const p = previousRange(r);
    expect(p.endDate.getTime()).toBe(r.startDate.getTime() - 1);
    expect(r.endDate.getTime() - r.startDate.getTime()).toBe(p.endDate.getTime() - p.startDate.getTime());
  });
});

describe('a custom range', () => {
  const a = new Date('2026-01-01T00:00:00Z');
  const b = new Date('2026-03-01T00:00:00Z');

  it('is used as given', () => {
    const r = periodRange('custom', { startDate: a, endDate: b }, NOW);
    expect(r.startDate).toEqual(a);
    expect(r.endDate).toEqual(b);
  });

  it('needs both dates, in order, and not more than five years', () => {
    expect(() => periodRange('custom', { startDate: a }, NOW)).toThrow(expect.objectContaining({ code: 'RANGE_REQUIRED' }));
    expect(() => periodRange('custom', { startDate: b, endDate: a }, NOW)).toThrow(expect.objectContaining({ code: 'RANGE_INVALID' }));
    const far = new Date(a.getTime() + (MAX_RANGE_DAYS + 5) * 86_400_000);
    expect(() => periodRange('custom', { startDate: a, endDate: far }, NOW)).toThrow(expect.objectContaining({ code: 'RANGE_TOO_LONG' }));
  });
});

describe('aging', () => {
  const asOf = new Date('2026-10-15T12:00:00Z');
  const daysAgo = (d: number) => new Date(asOf.getTime() - d * 86_400_000);

  it('a charge with no due date, or not yet due, is not overdue and goes in its own bucket', () => {
    expect(daysOverdue(null, asOf)).toBe(0);
    expect(agingBucketOf(null, asOf)).toBe('notYetDue');
    expect(agingBucketOf(new Date(asOf.getTime() + 86_400_000), asOf)).toBe('notYetDue');
    expect(agingBucketOf(asOf, asOf)).toBe('notYetDue');
  });

  it('puts a charge in the bucket its age says, at the edges', () => {
    expect(agingBucketOf(new Date(asOf.getTime() - 3_600_000), asOf)).toBe('current'); // an hour late is 1 day overdue
    expect(agingBucketOf(daysAgo(30), asOf)).toBe('current');
    expect(agingBucketOf(daysAgo(31), asOf)).toBe('days31to60');
    expect(agingBucketOf(daysAgo(60), asOf)).toBe('days31to60');
    expect(agingBucketOf(daysAgo(61), asOf)).toBe('days61to90');
    expect(agingBucketOf(daysAgo(90), asOf)).toBe('days61to90');
    expect(agingBucketOf(daysAgo(91), asOf)).toBe('over90');
  });

  // The list behind a bucket's figure has to hold exactly the charges that were counted in it
  it('the database filter for a bucket agrees with the bucket each charge is put in', () => {
    const keys = ['current', 'days31to60', 'days61to90', 'over90'] as const;
    const matches = (key: (typeof keys)[number], due: Date) => {
      const f = agingWhere(key, asOf).dueDate as { lt?: Date; lte?: Date; gt?: Date };
      return (!f.lt || due < f.lt) && (!f.lte || due <= f.lte) && (!f.gt || due > f.gt);
    };
    for (let hours = 1; hours <= 24 * 120; hours += 7) {
      const due = new Date(asOf.getTime() - hours * 3_600_000);
      const bucket = agingBucketOf(due, asOf);
      for (const key of keys) expect(matches(key, due)).toBe(key === bucket);
    }
  });
});

describe('grouping over time', () => {
  it('groups by month, quarter and year in Lagos', () => {
    const d = new Date('2026-11-14T10:00:00Z');
    expect(groupKey(d, 'month')).toBe('2026-11');
    expect(groupKey(d, 'quarter')).toBe('2026-Q4');
    expect(groupKey(d, 'year')).toBe('2026');
    expect(groupLabel('2026-11', 'month')).toBe('November');
    expect(groupLabel('2026-Q4', 'quarter')).toBe('Q4');
  });

  it('a group knows its own first and last moment, so its row can list its charges', () => {
    const q = groupRange('2026-Q4', 'quarter');
    expect(q.startDate.toISOString()).toBe('2026-09-30T23:00:00.000Z');
    expect(q.endDate.toISOString()).toBe('2026-12-31T22:59:59.999Z');
    expect(groupRange('2026-02', 'month').endDate.toISOString()).toBe('2026-02-28T22:59:59.999Z');
    expect(groupKey(q.startDate, 'quarter')).toBe('2026-Q4');
    expect(groupKey(q.endDate, 'quarter')).toBe('2026-Q4');
  });
});

describe('percent', () => {
  it('is to one decimal place and never divides by nothing', () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(5, 0)).toBe(0);
  });
});
