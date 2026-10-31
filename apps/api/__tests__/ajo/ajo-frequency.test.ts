/**
 * How often a group collects: daily, weekly, monthly, quarterly, annually, or the group's own step ("every 2 weeks", "every 2 months").
 * The due dates, the words shown to people, what a custom step may be, and the two places that act on it (reminders and repayment plans).
 */
import { addPeriods, describeCadence, dueDates, groupDates, periodDays, stepOf } from '../../src/modules/ajo/ajo-schedule';
import { resolveGroupFields } from '../../src/modules/ajo/ajo-group.service';
import { draftPlan, planReminders } from '../../src/modules/ajo/ajo-risk';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

describe('due dates for every frequency', () => {
  it('keeps the original three exactly as they were', () => {
    expect(dueDates(d('2027-01-30'), 'DAILY', 3).map(iso)).toEqual(['2027-01-30', '2027-01-31', '2027-02-01']);
    expect(dueDates(d('2027-01-04'), 'WEEKLY', 3).map(iso)).toEqual(['2027-01-04', '2027-01-11', '2027-01-18']);
    expect(dueDates(d('2027-01-31'), 'MONTHLY', 3).map(iso)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });

  it('quarterly is every three months and annually is every twelve, both counted from the start day', () => {
    expect(dueDates(d('2027-01-31'), 'QUARTERLY', 4).map(iso)).toEqual(['2027-01-31', '2027-04-30', '2027-07-31', '2027-10-31']);
    expect(dueDates(d('2027-11-15'), 'QUARTERLY', 3).map(iso)).toEqual(['2027-11-15', '2028-02-15', '2028-05-15']);
    expect(dueDates(d('2028-02-29'), 'ANNUALLY', 3).map(iso)).toEqual(['2028-02-29', '2029-02-28', '2030-02-28']); // a leap day falls back, then holds
    expect(dueDates(d('2027-06-10'), 'ANNUALLY', 2).map(iso)).toEqual(['2027-06-10', '2028-06-10']);
  });

  it('a custom step in days, weeks or months', () => {
    expect(dueDates(d('2027-03-01'), 'CUSTOM', 4, { intervalCount: 2, intervalUnit: 'WEEKS' }).map(iso)).toEqual(['2027-03-01', '2027-03-15', '2027-03-29', '2027-04-12']);
    expect(dueDates(d('2027-03-01'), 'CUSTOM', 3, { intervalCount: 10, intervalUnit: 'DAYS' }).map(iso)).toEqual(['2027-03-01', '2027-03-11', '2027-03-21']);
    expect(dueDates(d('2027-01-31'), 'CUSTOM', 4, { intervalCount: 2, intervalUnit: 'MONTHS' }).map(iso)).toEqual(['2027-01-31', '2027-03-31', '2027-05-31', '2027-07-31']);
    expect(dueDates(d('2027-03-01'), 'CUSTOM', 2, { intervalCount: 1, intervalUnit: 'MONTHS' }).map(iso)).toEqual(['2027-03-01', '2027-04-01']);
    expect(addPeriods(d('2027-03-01'), 'CUSTOM', 3, { intervalCount: 6, intervalUnit: 'MONTHS' }).toISOString().slice(0, 10)).toBe('2028-09-01');
  });

  it('refuses a custom schedule with no usable step, rather than guessing', () => {
    for (const bad of [{}, { intervalCount: 2 }, { intervalUnit: 'WEEKS' as const }, { intervalCount: 0, intervalUnit: 'DAYS' as const }, { intervalCount: 61, intervalUnit: 'DAYS' as const }, { intervalCount: 1.5, intervalUnit: 'DAYS' as const }]) {
      expect(() => stepOf('CUSTOM', bad)).toThrow(RangeError);
    }
    expect(() => stepOf('CUSTOM', { intervalCount: 60, intervalUnit: 'MONTHS' })).not.toThrow();
  });

  it('a whole group follows its own step from the first payment to the last', () => {
    const shape = { model: 'COLLECTOR_THRIFT' as const, frequency: 'CUSTOM' as const, intervalCount: 2, intervalUnit: 'WEEKS' as const, startDate: d('2027-03-01'), cycleLength: 6, rounds: null };
    const { dates, endsOn } = groupDates(shape);
    expect(dates.map(iso)).toEqual(['2027-03-01', '2027-03-15', '2027-03-29', '2027-04-12', '2027-04-26', '2027-05-10']);
    expect(iso(endsOn)).toBe('2027-05-10');
    // a rotating pot's rounds follow the same step
    expect(groupDates({ ...shape, model: 'ROTATING_POT', cycleLength: null, rounds: 3, frequency: 'QUARTERLY' }).dates.map(iso)).toEqual(['2027-03-01', '2027-06-01', '2027-09-01']);
  });
});

describe('saying it in words', () => {
  it('describes every cadence plainly, including a step of one', () => {
    expect(describeCadence('DAILY')).toBe('every day');
    expect(describeCadence('WEEKLY')).toBe('every week');
    expect(describeCadence('MONTHLY')).toBe('every month');
    expect(describeCadence('QUARTERLY')).toBe('every 3 months');
    expect(describeCadence('ANNUALLY')).toBe('every year');
    expect(describeCadence('CUSTOM', { intervalCount: 2, intervalUnit: 'WEEKS' })).toBe('every 2 weeks');
    expect(describeCadence('CUSTOM', { intervalCount: 1, intervalUnit: 'MONTHS' })).toBe('every month');
    expect(describeCadence('CUSTOM', { intervalCount: 10, intervalUnit: 'DAYS' })).toBe('every 10 days');
  });

  it('measures how often a group asks for money, to decide how much to remind', () => {
    expect(periodDays('DAILY')).toBe(1);
    expect(periodDays('WEEKLY')).toBe(7);
    expect(periodDays('CUSTOM', { intervalCount: 3, intervalUnit: 'DAYS' })).toBe(3);
    expect(periodDays('CUSTOM', { intervalCount: 2, intervalUnit: 'WEEKS' })).toBe(14);
    expect(periodDays('QUARTERLY')).toBe(90);
  });
});

describe('choosing a frequency for a group', () => {
  const base = { name: 'Market Circle', model: 'COLLECTOR_THRIFT' as const, frequency: 'DAILY' as const, contributionKobo: 100_000, startDate: '2027-03-01', cycleLength: 30, maxParticipants: 20 };

  it('accepts each frequency, and carries no step for any but custom', () => {
    for (const frequency of ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'] as const) {
      expect(resolveGroupFields(null, { ...base, frequency, intervalCount: 5, intervalUnit: 'DAYS' })).toMatchObject({ frequency, intervalCount: null, intervalUnit: null });
    }
    expect(resolveGroupFields(null, { ...base, frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'WEEKS' })).toMatchObject({ frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'WEEKS' });
  });

  it('refuses a custom group with no step, a bad step or a made-up frequency, in words', () => {
    expect(() => resolveGroupFields(null, { ...base, frequency: 'CUSTOM' })).toThrow(/how many days, weeks or months/);
    expect(() => resolveGroupFields(null, { ...base, frequency: 'CUSTOM', intervalCount: 0, intervalUnit: 'DAYS' })).toThrow(/1 to 60/);
    expect(() => resolveGroupFields(null, { ...base, frequency: 'CUSTOM', intervalCount: 61, intervalUnit: 'DAYS' })).toThrow(/1 to 60/);
    expect(() => resolveGroupFields(null, { ...base, frequency: 'CUSTOM', intervalCount: 2 })).toThrow(/days, weeks or months/);
    expect(() => resolveGroupFields(null, { ...base, frequency: 'FORTNIGHTLY' as never })).toThrow(/how often/);
  });

  it('changing an existing group between frequencies keeps the step only for custom', () => {
    const custom = resolveGroupFields(null, { ...base, frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'WEEKS' });
    expect(resolveGroupFields(custom, { name: 'Renamed' })).toMatchObject({ frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'WEEKS' });
    expect(resolveGroupFields(custom, { frequency: 'WEEKLY' })).toMatchObject({ frequency: 'WEEKLY', intervalCount: null, intervalUnit: null });
    expect(resolveGroupFields(custom, { intervalCount: 3 })).toMatchObject({ intervalCount: 3, intervalUnit: 'WEEKS' });
  });
});

describe('reminders and repayment plans follow the group’s own step', () => {
  const inst = (id: number, due: string) => ({ id, dueDate: d(due), remainingKobo: 100_000n });
  const common = { graceDays: 3, hasLateFee: false, membershipId: 7 };

  it('a group that collects every few days gets one overdue message a week, like a daily group, and a longer step is reminded per instalment', () => {
    const today = d('2027-03-06');
    const fast = planReminders({ ...common, today, frequency: 'CUSTOM', intervalCount: 3, intervalUnit: 'DAYS', installments: [inst(1, '2027-03-01'), inst(2, '2027-03-04')] });
    expect(fast).toHaveLength(1);
    expect(fast[0].dedupeKey).toMatch(/^w:7:/);
    const biweekly = planReminders({ ...common, today: d('2027-03-14'), frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'WEEKS', installments: [inst(1, '2027-03-15')] });
    expect(biweekly.map((r) => r.kind)).toEqual(['UPCOMING']);
    const quarterly = planReminders({ ...common, today: d('2027-06-30'), frequency: 'QUARTERLY', installments: [inst(1, '2027-07-01')] });
    expect(quarterly.map((r) => r.kind)).toEqual(['UPCOMING']);
  });

  it('a repayment plan is spread on the group’s own step', () => {
    const lines = draftPlan({ outstandingKobo: 300_000n, frequency: 'CUSTOM', intervalCount: 2, intervalUnit: 'WEEKS', from: d('2027-03-01'), periods: 3 });
    expect(lines.map((l) => l.dueDate)).toEqual(['2027-03-15', '2027-03-29', '2027-04-12']);
    expect(draftPlan({ outstandingKobo: 300_000n, frequency: 'QUARTERLY', from: d('2027-01-31'), periods: 2 }).map((l) => l.dueDate)).toEqual(['2027-04-30', '2027-07-31']);
  });
});
