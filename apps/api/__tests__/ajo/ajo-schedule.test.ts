import { addPeriods, businessDay, dayInZone, diffSchedule, dueDates, groupDates, installmentAmount, isValidCutoff, isValidTimeZone, wantedInstallments, type ExistingInstallment } from '../../src/modules/ajo/ajo-schedule';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe('Ajo schedule: due dates', () => {
  it('counts daily and weekly periods from the start date', () => {
    expect(dueDates(d('2027-01-30'), 'DAILY', 4).map(iso)).toEqual(['2027-01-30', '2027-01-31', '2027-02-01', '2027-02-02']);
    expect(dueDates(d('2027-01-04'), 'WEEKLY', 3).map(iso)).toEqual(['2027-01-04', '2027-01-11', '2027-01-18']);
  });

  it('clamps monthly dates to the last day of the month without drifting', () => {
    expect(dueDates(d('2027-01-31'), 'MONTHLY', 5).map(iso)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
    expect(addPeriods(d('2028-01-31'), 'MONTHLY', 1).toISOString().slice(0, 10)).toBe('2028-02-29'); // leap year
    expect(addPeriods(d('2027-11-15'), 'MONTHLY', 3).toISOString().slice(0, 10)).toBe('2028-02-15'); // across a year end
  });

  it('is deterministic: the same input gives the same dates', () => {
    const a = dueDates(d('2027-03-01'), 'MONTHLY', 12).map(iso);
    const b = dueDates(d('2027-03-01'), 'MONTHLY', 12).map(iso);
    expect(a).toEqual(b);
  });

  it('refuses an empty schedule', () => {
    expect(() => dueDates(d('2027-01-01'), 'DAILY', 0)).toThrow();
  });

  it('takes the count from the cycle for collector thrift and from the rounds for a rotating pot', () => {
    const thrift = groupDates({ model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', startDate: d('2027-01-04'), cycleLength: 4, rounds: null });
    expect(thrift.dates).toHaveLength(4);
    expect(iso(thrift.endsOn)).toBe('2027-01-25');
    const pot = groupDates({ model: 'ROTATING_POT', frequency: 'MONTHLY', startDate: d('2027-01-10'), cycleLength: null, rounds: 12 });
    expect(pot.dates).toHaveLength(12);
    expect(iso(pot.endsOn)).toBe('2027-12-10');
    expect(() => groupDates({ model: 'ROTATING_POT', frequency: 'MONTHLY', startDate: d('2027-01-10'), cycleLength: null, rounds: null })).toThrow();
  });
});

describe('Ajo schedule: amounts', () => {
  it('multiplies a rotating-pot contribution by the shares held, and leaves collector thrift alone', () => {
    expect(installmentAmount('ROTATING_POT', 500_000n, 1)).toBe(500_000n);
    expect(installmentAmount('ROTATING_POT', 500_000n, 2)).toBe(1_000_000n);
    expect(installmentAmount('COLLECTOR_THRIFT', 500_000n, 1)).toBe(500_000n);
    expect(() => installmentAmount('ROTATING_POT', 500_000n, 0)).toThrow();
  });
});

describe('Ajo schedule: timezone and cutoff', () => {
  it('knows the calendar day in the group timezone', () => {
    // 23:30 UTC on the 4th is 00:30 on the 5th in Lagos (UTC+1).
    expect(iso(dayInZone(new Date('2027-01-04T23:30:00Z'), 'Africa/Lagos'))).toBe('2027-01-05');
    expect(iso(dayInZone(new Date('2027-01-04T23:30:00Z'), 'UTC'))).toBe('2027-01-04');
  });

  it('moves a payment after the cutoff to the next day, and keeps one at the cutoff on its own day', () => {
    // 17:59, 18:00 and 18:01 Lagos time are 16:59, 17:00, 17:01 UTC.
    expect(iso(businessDay(new Date('2027-01-04T16:59:00Z'), 'Africa/Lagos', '18:00'))).toBe('2027-01-04');
    expect(iso(businessDay(new Date('2027-01-04T17:00:00Z'), 'Africa/Lagos', '18:00'))).toBe('2027-01-04');
    expect(iso(businessDay(new Date('2027-01-04T17:01:00Z'), 'Africa/Lagos', '18:00'))).toBe('2027-01-05');
  });

  it('rolls over a month end after the cutoff', () => {
    expect(iso(businessDay(new Date('2027-01-31T20:00:00Z'), 'Africa/Lagos', '18:00'))).toBe('2027-02-01');
  });

  it('validates timezones and cutoff times', () => {
    expect(isValidTimeZone('Africa/Lagos')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidCutoff('18:00')).toBe(true);
    expect(isValidCutoff('24:00')).toBe(false);
    expect(isValidCutoff('6pm')).toBe(false);
    expect(() => businessDay(new Date(), 'Africa/Lagos', 'late')).toThrow();
  });
});

describe('Ajo schedule: regeneration cannot duplicate or move paid installments', () => {
  const dates = dueDates(d('2027-01-04'), 'WEEKLY', 6);
  const full = wantedInstallments({ dates, amountKobo: 500_000n });
  const row = (i: number, over: Partial<ExistingInstallment> = {}): ExistingInstallment => ({ id: i + 1, dueDate: dates[i], amountKobo: 500_000n, paidKobo: 0n, hasContributions: false, ...over });

  it('creates every installment on a first run and nothing on the second', () => {
    const first = diffSchedule(full, []);
    expect(first.toCreate).toHaveLength(6);
    const existing = first.toCreate.map((w, i) => row(i, { dueDate: w.dueDate }));
    expect(diffSchedule(full, existing)).toEqual({ toCreate: [], toDelete: [], toUpdate: [] });
  });

  it('only adds what is missing', () => {
    const diff = diffSchedule(full, [row(0), row(1), row(3)]);
    expect(diff.toCreate.map((w) => iso(w.dueDate))).toEqual([iso(dates[2]), iso(dates[4]), iso(dates[5])]);
  });

  it('never deletes or changes an installment with money or a contribution against it', () => {
    const existing = [row(0, { paidKobo: 500_000n }), row(1, { hasContributions: true }), row(2), row(3, { paidKobo: 100_000n })];
    const shrunk = wantedInstallments({ dates, amountKobo: 700_000n, from: dates[5] }); // wants only the last date, at a new amount
    const diff = diffSchedule(shrunk, existing);
    expect(diff.toDelete).toEqual([3]); // only the untouched row 2 (id 3) goes
    expect(diff.toUpdate).toEqual([]); // the rows with money are left exactly as they are
    expect(diff.toCreate.map((w) => iso(w.dueDate))).toEqual([iso(dates[5])]);
  });

  it('updates the amount of an untouched installment only', () => {
    const diff = diffSchedule(wantedInstallments({ dates, amountKobo: 1_000_000n }), [row(0), row(1, { paidKobo: 1n })]);
    expect(diff.toUpdate).toEqual([{ id: 1, amountKobo: 1_000_000n }]);
  });

  it('gives a late joiner only the dates from the day they join, so the cycle still ends for everyone on the same day', () => {
    const late = wantedInstallments({ dates, amountKobo: 500_000n, from: d('2027-01-20') });
    expect(late.map((w) => iso(w.dueDate))).toEqual([iso(dates[3]), iso(dates[4]), iso(dates[5])]);
    expect(iso(late[late.length - 1].dueDate)).toBe(iso(dates[5]));
  });
});
