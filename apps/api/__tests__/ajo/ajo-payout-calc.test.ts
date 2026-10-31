import { LEVY_OVERDUE_DAYS, describeLevy, isLevyExempt, levyAmount, percentOfBps } from '../../src/modules/ajo/ajo-levy';
import { calculatePayout, collectorFeeFor, roundHalfUp, type PayoutInput } from '../../src/modules/ajo/ajo-payout-calc';

const base: PayoutInput = { scheduledKobo: 5_000_000n, confirmedKobo: 5_000_000n, feeType: 'NONE', feeValue: 0n, perInstallmentKobo: 500_000n, earlier: [] };

describe('Ajo payout calculation (T5.1)', () => {
  it('pays everything when the round is fully confirmed and there is no fee', () => {
    const f = calculatePayout(base);
    expect(f).toMatchObject({ grossKobo: 5_000_000n, shortfallKobo: 0n, confirmedKobo: 5_000_000n, feeKobo: 0n, netKobo: 5_000_000n, canPay: true });
  });

  it('shows the shortfall in full and pays only what is confirmed', () => {
    const f = calculatePayout({ ...base, confirmedKobo: 4_500_000n });
    expect(f).toMatchObject({ grossKobo: 5_000_000n, shortfallKobo: 500_000n, netKobo: 4_500_000n });
    expect(f.explanation.join(' ')).toContain('Shortfall ₦5,000.00');
    expect(f.explanation.join(' ')).toContain('To pay now: ₦45,000.00');
  });

  it('never lets gross, shortfall and net disagree: confirmed money is exactly net plus fee plus what was already planned', () => {
    for (const confirmed of [0n, 1n, 123_457n, 4_999_999n, 5_000_000n]) {
      for (const [type, value] of [['NONE', 0n], ['FIXED', 100_000n], ['PERCENT', 250n], ['DAYS', 1n]] as const) {
        const f = calculatePayout({ ...base, confirmedKobo: confirmed, feeType: type, feeValue: value });
        expect(f.netKobo + f.feeKobo + f.earlierNetKobo).toBe(confirmed);
        expect(f.shortfallKobo).toBe(base.scheduledKobo - confirmed);
        expect(f.netKobo >= 0n && f.feeKobo >= 0n).toBe(true);
      }
    }
  });

  it('takes the collector fee off the confirmed money, in each of its three forms', () => {
    expect(calculatePayout({ ...base, feeType: 'FIXED', feeValue: 50_000n })).toMatchObject({ feeKobo: 50_000n, netKobo: 4_950_000n });
    expect(calculatePayout({ ...base, feeType: 'PERCENT', feeValue: 200n })).toMatchObject({ feeKobo: 100_000n, netKobo: 4_900_000n }); // 2%
    expect(calculatePayout({ ...base, feeType: 'DAYS', feeValue: 1n })).toMatchObject({ feeKobo: 500_000n, netKobo: 4_500_000n }); // one instalment
    expect(calculatePayout({ ...base, feeType: 'DAYS', feeValue: 2n }).feeKobo).toBe(1_000_000n);
  });

  it('rounds a percentage fee half up, in whole kobo', () => {
    expect(collectorFeeFor('PERCENT', 50n, 1_001n, 0n)).toBe(5n); // 0.5% of 1001 = 5.005
    expect(collectorFeeFor('PERCENT', 50n, 1_100n, 0n)).toBe(6n); // 5.5 rounds up
    expect(roundHalfUp(5n, 2n)).toBe(3n);
    expect(roundHalfUp(4n, 2n)).toBe(2n);
  });

  it('never takes a fee bigger than the money there is', () => {
    expect(collectorFeeFor('FIXED', 9_000_000n, 1_000_000n, 0n)).toBe(1_000_000n);
    const f = calculatePayout({ ...base, confirmedKobo: 100_000n, feeType: 'FIXED', feeValue: 300_000n });
    expect(f).toMatchObject({ feeKobo: 100_000n, netKobo: 0n, canPay: false });
    expect(f.explanation.join(' ')).toContain('nothing to pay');
  });

  it('pays nothing when nothing is confirmed', () => {
    expect(calculatePayout({ ...base, confirmedKobo: 0n })).toMatchObject({ netKobo: 0n, canPay: false, shortfallKobo: 5_000_000n });
    expect(calculatePayout({ ...base, confirmedKobo: -5n })).toMatchObject({ confirmedKobo: 0n, canPay: false });
  });

  it('makes a supplementary payout of only the late money, and takes the rest of the fee, not the whole fee again', () => {
    // First payout: ₦45,000.00 confirmed, fixed fee ₦500.00, so net ₦44,500.00.
    const first = calculatePayout({ ...base, confirmedKobo: 4_500_000n, feeType: 'FIXED', feeValue: 50_000n });
    expect(first).toMatchObject({ feeKobo: 50_000n, netKobo: 4_450_000n });
    // Later the missing ₦5,000.00 is confirmed. The fee was already taken once.
    const top = calculatePayout({ ...base, confirmedKobo: 5_000_000n, feeType: 'FIXED', feeValue: 50_000n, earlier: [{ netKobo: first.netKobo, feeKobo: first.feeKobo }] });
    expect(top).toMatchObject({ feeKobo: 0n, netKobo: 500_000n, shortfallKobo: 0n, earlierNetKobo: 4_450_000n });
    expect(first.netKobo + first.feeKobo + top.netKobo + top.feeKobo).toBe(5_000_000n);
  });

  it('shares a percentage fee fairly across a payout and its supplement', () => {
    const first = calculatePayout({ ...base, confirmedKobo: 4_000_000n, feeType: 'PERCENT', feeValue: 100n });
    expect(first).toMatchObject({ feeKobo: 40_000n, netKobo: 3_960_000n });
    const top = calculatePayout({ ...base, confirmedKobo: 5_000_000n, feeType: 'PERCENT', feeValue: 100n, earlier: [{ netKobo: first.netKobo, feeKobo: first.feeKobo }] });
    expect(top).toMatchObject({ feeKobo: 10_000n, netKobo: 990_000n });
    expect(first.feeKobo + top.feeKobo).toBe(50_000n); // 1% of ₦50,000.00 in all
  });

  it('carries a fixed fee that was bigger than the first payment into the next one', () => {
    const first = calculatePayout({ ...base, confirmedKobo: 30_000n, feeType: 'FIXED', feeValue: 50_000n });
    expect(first).toMatchObject({ feeKobo: 30_000n, netKobo: 0n, canPay: false }); // nothing to pay yet, the fee ate it all
    const later = calculatePayout({ ...base, confirmedKobo: 1_000_000n, feeType: 'FIXED', feeValue: 50_000n });
    expect(later).toMatchObject({ feeKobo: 50_000n, netKobo: 950_000n });
  });

  it('pays nothing more when the round has already been paid out in full', () => {
    const done = calculatePayout({ ...base, earlier: [{ netKobo: 5_000_000n, feeKobo: 0n }] });
    expect(done).toMatchObject({ netKobo: 0n, canPay: false });
  });

  it('pays nothing if money was reversed after an earlier payout planned it', () => {
    const f = calculatePayout({ ...base, confirmedKobo: 3_000_000n, earlier: [{ netKobo: 4_000_000n, feeKobo: 0n }] });
    expect(f).toMatchObject({ netKobo: 0n, feeKobo: 0n, canPay: false });
  });
});

describe('Ajo platform levy (T5.4)', () => {
  // The owner's settings from T0.1, in kobo.
  const CYCLE = { rate: 50, min: 50_000n, max: 500_000n };
  const PERSON = { rate: 25, min: 5_000n, max: 100_000n };
  const cycle = (base: bigint) => levyAmount(base, CYCLE.rate, CYCLE.min, CYCLE.max);
  const person = (base: bigint) => levyAmount(base, PERSON.rate, PERSON.min, PERSON.max);

  it('matches the spec’s first worked example: 10 people paying ₦5,000.00 weekly for 10 weeks come to ₦3,750.00', () => {
    // ₦500,000.00 scheduled in all; each person's share is ₦50,000.00.
    expect(cycle(50_000_000n)).toBe(250_000n); // ₦2,500.00
    expect(person(5_000_000n)).toBe(12_500n); // ₦125.00 each
    expect(cycle(50_000_000n) + 10n * person(5_000_000n)).toBe(375_000n); // ₦3,750.00
  });

  it('matches the spec’s second worked example: 40 people paying ₦500.00 daily for 31 days come to ₦5,100.00', () => {
    // ₦620,000.00 scheduled; each person's share is ₦15,500.00, so 0.25% is ₦38.75 and the participant minimum of ₦50.00 applies.
    expect(cycle(62_000_000n)).toBe(310_000n); // ₦3,100.00
    expect(person(1_550_000n)).toBe(5_000n); // raised to ₦50.00
    expect(cycle(62_000_000n) + 40n * person(1_550_000n)).toBe(510_000n); // ₦5,100.00
  });

  it('holds the cycle levy between ₦500.00 and ₦5,000.00 and the participant levy between ₦50.00 and ₦1,000.00', () => {
    expect(cycle(1_000_000n)).toBe(50_000n); // 0.5% of ₦10,000.00 is ₦50.00, raised to the ₦500.00 minimum
    expect(cycle(1_000_000_000n)).toBe(500_000n); // 0.5% of ₦10,000,000.00 is ₦50,000.00, held to the ₦5,000.00 maximum
    expect(person(100_000_000n)).toBe(100_000n); // held to ₦1,000.00
    expect(person(100_000n)).toBe(5_000n);
  });

  it('owes nothing on nothing scheduled, or at a rate of zero', () => {
    expect(cycle(0n)).toBe(0n);
    expect(levyAmount(10_000_000n, 0, 50_000n, 500_000n)).toBe(0n);
  });

  it('rounds half up in whole kobo', () => {
    expect(levyAmount(10_100n, 50, 0n, 1_000_000n)).toBe(51n); // 50.5 → 51
    expect(levyAmount(10_099n, 50, 0n, 1_000_000n)).toBe(50n); // 50.495 → 50
  });

  it('writes the calculation in words with every amount in full', () => {
    const text = describeLevy({ kind: 'CYCLE', groupName: 'Market Circle', baseKobo: 50_000_000n, rateBps: 50, minKobo: 50_000n, maxKobo: 500_000n, amountKobo: 250_000n });
    expect(text).toContain('0.5% of ₦500,000.00');
    expect(text).toContain('Levy: ₦2,500.00');
    const raised = describeLevy({ kind: 'PARTICIPANT', groupName: 'Market Circle', who: 'Ngozi Eze', baseKobo: 1_550_000n, rateBps: 25, minKobo: 5_000n, maxKobo: 100_000n, amountKobo: 5_000n });
    expect(raised).toContain('raised to the minimum of ₦50.00');
    expect(raised).toContain('Ngozi Eze');
    expect(describeLevy({ kind: 'CYCLE', groupName: 'G', baseKobo: 1_000_000_000n, rateBps: 50, minKobo: 50_000n, maxKobo: 500_000n, amountKobo: 500_000n })).toContain('held to the maximum of ₦5,000.00');
  });

  it('shows rates as percentages', () => {
    expect([50, 25, 100, 5, 1_000].map(percentOfBps)).toEqual(['0.5%', '0.25%', '1%', '0.05%', '10%']);
  });

  it('exempts the tiers the settings name, and only those', () => {
    expect(isLevyExempt('ajo-starter', ['ajo-starter'])).toBe(true);
    expect(isLevyExempt('ajo-growth', ['ajo-starter'])).toBe(false);
    expect(LEVY_OVERDUE_DAYS).toBe(60);
  });
});
