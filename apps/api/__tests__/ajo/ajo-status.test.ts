/**
 * Spec §16.3 and §16.9 (4): one set of statuses. Reported never shows as paid, a dispute never shows as missed, and the circle's figures
 * come from the same function the board and the officer screens both use. Pure, so no database.
 */
import { behindText, emptyCounts, onTimeBps, paymentStatus, spreadReported, statusSortRank, STATUS_LABEL, summariseRound, type RoundPayment } from '../../src/modules/ajo/ajo-status';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const TEN_K = 1_000_000n;

const round = (over: Partial<RoundPayment> = {}): RoundPayment => ({ dueDate: day('2027-03-10'), amountKobo: TEN_K, paidKobo: 0n, reportedKobo: 0n, waived: false, completedOn: null, disputed: false, graceDays: 3, isCurrentRound: true, ...over });

describe('paymentStatus', () => {
  it('is paid on time when the confirmed payment counted for the due date or earlier', () => {
    expect(paymentStatus(round({ paidKobo: TEN_K, completedOn: day('2027-03-10') }), day('2027-03-12')).status).toBe('PAID_ON_TIME');
    expect(paymentStatus(round({ paidKobo: TEN_K, completedOn: day('2027-03-08') }), day('2027-03-12')).status).toBe('PAID_ON_TIME');
  });

  it('is paid late, with the days late, when the confirmed payment counted for a later day', () => {
    expect(paymentStatus(round({ paidKobo: TEN_K, completedOn: day('2027-03-12') }), day('2027-03-20'))).toMatchObject({ status: 'PAID_LATE', daysLate: 2, behindKobo: 0n });
  });

  it('never shows a reported payment as paid', () => {
    const state = paymentStatus(round({ reportedKobo: TEN_K }), day('2027-03-09'));
    expect(state.status).toBe('REPORTED');
    expect(STATUS_LABEL.REPORTED).toBe('Reported, awaiting confirmation');
  });

  it('keeps a reported payment as Reported even after the due date, because the member did pay and is waiting on an officer', () => {
    expect(paymentStatus(round({ reportedKobo: TEN_K }), day('2027-03-30')).status).toBe('REPORTED');
  });

  it('is due today and in the current round, and upcoming in a later round', () => {
    expect(paymentStatus(round(), day('2027-03-10')).status).toBe('DUE');
    expect(paymentStatus(round({ isCurrentRound: false, dueDate: day('2027-04-10') }), day('2027-03-10')).status).toBe('UPCOMING');
  });

  it('is overdue inside the grace period and says when grace ends', () => {
    const state = paymentStatus(round(), day('2027-03-12'));
    expect(state.status).toBe('OVERDUE');
    expect(state.graceEndsOn).toEqual(day('2027-03-13'));
    expect(state.behindKobo).toBe(TEN_K);
  });

  it('is missed once grace is over, on the first day after it', () => {
    expect(paymentStatus(round(), day('2027-03-13')).status).toBe('OVERDUE');
    expect(paymentStatus(round(), day('2027-03-14'))).toMatchObject({ status: 'MISSED', graceEndsOn: null, daysLate: 4 });
  });

  it('never shows a disputed round as missed, or as overdue', () => {
    expect(paymentStatus(round({ disputed: true }), day('2027-04-30')).status).toBe('UNDER_REVIEW');
  });

  it('lets a confirmed full payment win over an old open dispute', () => {
    expect(paymentStatus(round({ disputed: true, paidKobo: TEN_K, completedOn: day('2027-03-09') }), day('2027-04-01')).status).toBe('PAID_ON_TIME');
  });

  it('shows a waived round as waived, whatever else is true of it', () => {
    expect(paymentStatus(round({ waived: true }), day('2027-05-01'))).toMatchObject({ status: 'WAIVED', behindKobo: 0n });
  });

  it('counts only the unpaid part as behind when a round is part-paid', () => {
    expect(paymentStatus(round({ paidKobo: 400_000n }), day('2027-03-20'))).toMatchObject({ status: 'MISSED', behindKobo: 600_000n });
  });

  it('subtracts a partly reported amount from what is behind, but does not call it reported until it covers the rest', () => {
    expect(paymentStatus(round({ reportedKobo: 300_000n }), day('2027-03-20'))).toMatchObject({ status: 'MISSED', behindKobo: 700_000n });
  });

  it('works with a grace of zero: overdue the day after, missed the day after that', () => {
    expect(paymentStatus(round({ graceDays: 0 }), day('2027-03-11')).status).toBe('MISSED');
    expect(paymentStatus(round({ graceDays: 0 }), day('2027-03-10')).status).toBe('DUE');
  });
});

describe('spreadReported', () => {
  it('puts waiting money on the oldest unpaid round first, the way confirming it would', () => {
    const rounds = [
      { amountKobo: TEN_K, paidKobo: TEN_K, waived: false },
      { amountKobo: TEN_K, paidKobo: 0n, waived: false },
      { amountKobo: TEN_K, paidKobo: 0n, waived: false },
    ];
    expect(spreadReported(rounds, 1_500_000n)).toEqual([0n, TEN_K, 500_000n]);
  });

  it('skips waived rounds and never over-allocates', () => {
    const rounds = [
      { amountKobo: TEN_K, paidKobo: 0n, waived: true },
      { amountKobo: TEN_K, paidKobo: 0n, waived: false },
    ];
    expect(spreadReported(rounds, 5_000_000n)).toEqual([0n, TEN_K]);
  });
});

describe('summariseRound', () => {
  const rows = [
    { amountKobo: TEN_K, paidKobo: TEN_K, status: 'PAID_ON_TIME' as const },
    { amountKobo: TEN_K, paidKobo: TEN_K, status: 'PAID_LATE' as const },
    { amountKobo: TEN_K, paidKobo: 0n, status: 'REPORTED' as const },
    { amountKobo: TEN_K, paidKobo: 0n, status: 'OVERDUE' as const },
    { amountKobo: TEN_K, paidKobo: 0n, status: 'WAIVED' as const },
  ];

  it('counts reported money as not yet collected, and a waived member as not expected', () => {
    const s = summariseRound(rows);
    expect(s).toMatchObject({ expectedCount: 4, paidCount: 2, expectedKobo: 4n * TEN_K, collectedKobo: 2n * TEN_K, collectionBps: 5000 });
    expect(s.counts).toMatchObject({ PAID_ON_TIME: 1, PAID_LATE: 1, REPORTED: 1, OVERDUE: 1, WAIVED: 1, MISSED: 0 });
  });

  it('has no collection rate when nothing is expected', () => {
    expect(summariseRound([]).collectionBps).toBeNull();
    expect(summariseRound([{ amountKobo: TEN_K, paidKobo: 0n, status: 'WAIVED' }]).collectionBps).toBeNull();
  });

  it('never counts more than a round asked for, even if a member overpaid', () => {
    expect(summariseRound([{ amountKobo: TEN_K, paidKobo: TEN_K * 2n, status: 'PAID_ON_TIME' }]).collectedKobo).toBe(TEN_K);
  });
});

describe('the rest of the language', () => {
  it('orders a round so the people who still need to act come first', () => {
    const order = (['PAID_ON_TIME', 'REPORTED', 'DUE', 'MISSED', 'OVERDUE'] as const).slice().sort((a, b) => statusSortRank(a) - statusSortRank(b));
    expect(order).toEqual(['MISSED', 'OVERDUE', 'DUE', 'REPORTED', 'PAID_ON_TIME']);
  });

  it('measures the on-time rate over decided rounds only', () => {
    const counts = { ...emptyCounts(), PAID_ON_TIME: 6, PAID_LATE: 2, MISSED: 2, OVERDUE: 5, REPORTED: 3, UNDER_REVIEW: 1, WAIVED: 1 };
    expect(onTimeBps(counts)).toBe(6000);
    expect(onTimeBps(emptyCounts())).toBeNull();
  });

  it('says "Behind by", never "defaulter"', () => {
    expect(behindText(2_000_000n, (k) => `₦${Number(k) / 100}`)).toBe('Behind by ₦20000');
    for (const label of Object.values(STATUS_LABEL)) expect(label.toLowerCase()).not.toContain('defaulter');
  });
});
