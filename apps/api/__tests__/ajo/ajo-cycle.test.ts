/**
 * Spec §16.5: collector-thrift cycles. Each saver keeps one amount for the whole cycle, then withdraws or continues, and no answer means
 * withdraw. The collector's fee is one contribution of that saver. Pure, so no database.
 */
import { formatNaira } from '../../src/modules/ajo/ajo-collections';
import { calculatePayout } from '../../src/modules/ajo/ajo-payout-calc';
import { carryForward, checkSaverAmount, CYCLE_PROMPT_DAYS, cycleStartOf, effectiveChoice, isPromptOpen, nextCycleStart, promptOpensOn } from '../../src/modules/ajo/ajo-cycle';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('effectiveChoice', () => {
  it('treats no answer as a withdrawal, so nobody\'s money stays in the group because they did not reply', () => {
    expect(effectiveChoice('PENDING')).toBe('WITHDRAW');
    expect(effectiveChoice('WITHDRAW')).toBe('WITHDRAW');
    expect(effectiveChoice('CONTINUE')).toBe('CONTINUE');
  });
});

describe('checkSaverAmount', () => {
  const min = 50_000n; // ₦500.00
  it('accepts anything from the group\'s smallest amount up', () => {
    expect(checkSaverAmount(50_000n, min, formatNaira)).toBeNull();
    expect(checkSaverAmount(100_000n, min, formatNaira)).toBeNull();
  });
  it('says the smallest amount in full naira when it is too small', () => {
    expect(checkSaverAmount(49_999n, min, formatNaira)).toBe('The smallest amount for this group is ₦500.00.');
  });
  it('refuses zero, negative and absurd amounts', () => {
    expect(checkSaverAmount(0n, min, formatNaira)).toMatch(/more than zero/);
    expect(checkSaverAmount(-5n, min, formatNaira)).toMatch(/more than zero/);
    expect(checkSaverAmount(1_000_000_001n, min, formatNaira)).toMatch(/largest allowed/);
  });
});

describe('the end-of-cycle question', () => {
  it('opens three days before the last due date and stays open after it', () => {
    expect(CYCLE_PROMPT_DAYS).toBe(3);
    const ends = day('2027-03-31');
    expect(promptOpensOn(ends)).toEqual(day('2027-03-28'));
    expect(isPromptOpen(ends, day('2027-03-27'))).toBe(false);
    expect(isPromptOpen(ends, day('2027-03-28'))).toBe(true);
    expect(isPromptOpen(ends, day('2027-04-05'))).toBe(true);
  });
});

describe('where the next cycle starts', () => {
  const base = { cycleStart: day('2027-03-01'), frequency: 'DAILY' as const, cycleLength: 31 };
  it('is one period after the last due date, so the rhythm carries on', () => {
    expect(nextCycleStart({ ...base, today: day('2027-03-31') })).toEqual(day('2027-04-01'));
  });
  it('works for weekly and monthly groups', () => {
    expect(nextCycleStart({ cycleStart: day('2027-01-04'), frequency: 'WEEKLY', cycleLength: 4, today: day('2027-01-29') })).toEqual(day('2027-02-01'));
    expect(nextCycleStart({ cycleStart: day('2027-01-31'), frequency: 'MONTHLY', cycleLength: 3, today: day('2027-04-01') })).toEqual(day('2027-04-30'));
  });
  it('starts today when the admin starts it late, so nobody is overdue on day one', () => {
    expect(nextCycleStart({ ...base, today: day('2027-04-10') })).toEqual(day('2027-04-10'));
  });
  it('starts the first cycle on the group\'s start date and later ones where they were started', () => {
    expect(cycleStartOf({ startDate: day('2027-03-01'), cycleStartsOn: null })).toEqual(day('2027-03-01'));
    expect(cycleStartOf({ startDate: day('2027-03-01'), cycleStartsOn: day('2027-04-01') })).toEqual(day('2027-04-01'));
  });
});

describe('what a continuing saver carries into the next cycle', () => {
  it('takes one contribution of that saver as the collector fee: a ₦500.00 saver pays ₦500.00, a ₦1,000.00 saver pays ₦1,000.00', () => {
    const a = carryForward({ carriedInKobo: 0n, confirmedKobo: 1_550_000n, feeType: 'DAYS', feeValue: 1n, amountKobo: 50_000n });
    expect(a).toEqual({ feeKobo: 50_000n, carriedKobo: 1_500_000n }); // ₦15,500 saved, less ₦500, is ₦15,000
    const b = carryForward({ carriedInKobo: 0n, confirmedKobo: 3_100_000n, feeType: 'DAYS', feeValue: 1n, amountKobo: 100_000n });
    expect(b).toEqual({ feeKobo: 100_000n, carriedKobo: 3_000_000n });
  });

  it('adds what was already carried in, and never charges a fee on it again', () => {
    const r = carryForward({ carriedInKobo: 1_500_000n, confirmedKobo: 1_000_000n, feeType: 'PERCENT', feeValue: 500n, amountKobo: 50_000n });
    expect(r.feeKobo).toBe(50_000n); // 5% of this cycle's ₦10,000.00 only, not of the ₦25,000.00 in hand
    expect(r.carriedKobo).toBe(1_500_000n + 1_000_000n - 50_000n);
  });

  it('carries everything when there is no fee, and nothing is lost to rounding', () => {
    expect(carryForward({ carriedInKobo: 0n, confirmedKobo: 123_457n, feeType: 'NONE', feeValue: 0n, amountKobo: 50_000n })).toEqual({ feeKobo: 0n, carriedKobo: 123_457n });
  });

  it('never takes more fee than the saver saved', () => {
    expect(carryForward({ carriedInKobo: 0n, confirmedKobo: 20_000n, feeType: 'DAYS', feeValue: 1n, amountKobo: 50_000n })).toEqual({ feeKobo: 20_000n, carriedKobo: 0n });
  });
});

describe('a payout that includes carried savings', () => {
  const base = { feeType: 'DAYS' as const, feeValue: 1n, perInstallmentKobo: 100_000n, earlier: [] };

  it('pays the carried savings and this cycle\'s, takes this cycle\'s fee once, and shows no shortfall for money already in hand', () => {
    const f = calculatePayout({ ...base, scheduledKobo: 3_100_000n, confirmedKobo: 3_100_000n, carriedKobo: 1_500_000n });
    expect(f.confirmedKobo).toBe(4_600_000n);
    expect(f.shortfallKobo).toBe(0n);
    expect(f.feeKobo).toBe(100_000n);
    expect(f.netKobo).toBe(4_500_000n);
  });

  it('does not charge a percentage fee on the carried part', () => {
    const f = calculatePayout({ ...base, feeType: 'PERCENT', feeValue: 1_000n, scheduledKobo: 1_000_000n, confirmedKobo: 1_000_000n, carriedKobo: 9_000_000n });
    expect(f.feeKobo).toBe(100_000n); // 10% of this cycle's ₦10,000.00, not of ₦100,000.00
    expect(f.netKobo).toBe(9_900_000n);
  });

  it('is exactly as before when nothing was carried', () => {
    const without = calculatePayout({ ...base, scheduledKobo: 3_100_000n, confirmedKobo: 3_000_000n });
    const zero = calculatePayout({ ...base, scheduledKobo: 3_100_000n, confirmedKobo: 3_000_000n, carriedKobo: 0n });
    expect(zero).toEqual(without);
    expect(without.shortfallKobo).toBe(100_000n);
  });
});
