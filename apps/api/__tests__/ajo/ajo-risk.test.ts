import { FEE_NOTICE_HOURS, composeDigest, composeReminder, computeTrust, draftPlan, feeEligibleOn, graceEndsOn, isOverdue, isoWeekKey, lateFeeFor, planReminders, trackPlan, trustBand, versionInForceOn, type TrustInstallment } from '../../src/modules/ajo/ajo-risk';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string) => new Date(iso);
const iso = (x: Date) => x.toISOString().slice(0, 10);

describe('overdue, grace and when a fee may be assessed (T6.1)', () => {
  it('is overdue only after the due date has passed', () => {
    expect(isOverdue(d('2027-03-01'), d('2027-03-01'))).toBe(false);
    expect(isOverdue(d('2027-03-01'), d('2027-03-02'))).toBe(true);
  });

  it('puts the last day of grace the group’s grace days after the due date', () => {
    expect(iso(graceEndsOn(d('2027-03-01'), 3))).toBe('2027-03-04');
    expect(iso(graceEndsOn(d('2027-03-01'), 0))).toBe('2027-03-01');
  });

  it('allows a fee from the day after grace ends', () => {
    expect(iso(feeEligibleOn({ dueDate: d('2027-03-01'), graceDays: 3 }))).toBe('2027-03-05');
    expect(iso(feeEligibleOn({ dueDate: d('2027-03-01'), graceDays: 0 }))).toBe('2027-03-02');
  });

  it('gives a member one clear day after a check about them ended, if that is later than grace', () => {
    // Grace ended on the 4th. A claim was turned down on the 10th: no fee before the 11th.
    expect(iso(feeEligibleOn({ dueDate: d('2027-03-01'), graceDays: 3, lastCheckEndedOn: d('2027-03-10') }))).toBe('2027-03-11');
    // A check that ended inside grace changes nothing.
    expect(iso(feeEligibleOn({ dueDate: d('2027-03-01'), graceDays: 3, lastCheckEndedOn: d('2027-03-02') }))).toBe('2027-03-05');
    expect(iso(feeEligibleOn({ dueDate: d('2027-03-01'), graceDays: 3, lastCheckEndedOn: null }))).toBe('2027-03-05');
  });

  it('keeps a 48-hour notice window before a fee can be owed', () => {
    expect(FEE_NOTICE_HOURS).toBe(48);
  });
});

describe('which rule version binds a member on a due date (T6.2)', () => {
  const v1 = { id: 1, version: 1, effectiveFrom: at('2027-01-01T00:00:00Z') };
  const v2 = { id: 2, version: 2, effectiveFrom: at('2027-03-10T00:00:00Z') };

  it('uses the highest version accepted by the end of the due date and already in effect', () => {
    const accepted = [{ ruleVersionId: 1, acceptedAt: at('2027-01-05T10:00:00Z') }];
    expect(versionInForceOn(d('2027-03-01'), [v1, v2], accepted)).toBe(1);
  });

  it('never uses a version accepted after the due date, or one that was not in effect yet', () => {
    const lateAcceptance = [{ ruleVersionId: 1, acceptedAt: at('2027-03-02T10:00:00Z') }];
    expect(versionInForceOn(d('2027-03-01'), [v1, v2], lateAcceptance)).toBeNull();
    const early = [{ ruleVersionId: 1, acceptedAt: at('2027-01-05T10:00:00Z') }, { ruleVersionId: 2, acceptedAt: at('2027-03-02T10:00:00Z') }];
    expect(versionInForceOn(d('2027-03-05'), [v1, v2], early)).toBe(1); // v2 is not in effect until the 10th
    expect(versionInForceOn(d('2027-03-12'), [v1, v2], early)).toBe(2);
  });

  it('counts an acceptance made on the due date itself, and returns nothing when nothing was accepted', () => {
    expect(versionInForceOn(d('2027-03-01'), [v1], [{ ruleVersionId: 1, acceptedAt: at('2027-03-01T23:30:00Z') }])).toBe(1);
    expect(versionInForceOn(d('2027-03-01'), [v1, v2], [])).toBeNull();
  });
});

describe('the late fee (T6.2)', () => {
  const none = { lateFeeType: 'NONE' as const, lateFeeValue: 0n, lateFeeCapKobo: null };

  it('charges nothing when the rules have no late fee', () => {
    expect(lateFeeFor(none, 500_000n)).toBeNull();
    expect(lateFeeFor({ lateFeeType: 'FIXED', lateFeeValue: 0n, lateFeeCapKobo: null }, 500_000n)).toBeNull();
  });

  it('applies a fixed fee, and shows the calculation in words with money in full', () => {
    const fee = lateFeeFor({ lateFeeType: 'FIXED', lateFeeValue: 50_000n, lateFeeCapKobo: null }, 500_000n)!;
    expect(fee).toMatchObject({ feeKobo: 50_000n, capApplied: false, rawKobo: 50_000n });
    expect(fee.text).toContain('fixed late fee of ₦500.00');
    expect(fee.text).toContain('Late fee: ₦500.00');
    expect(fee.calculation).toEqual({ type: 'FIXED', value: '50000', basisKobo: '500000', rawKobo: '50000', capKobo: null });
  });

  it('applies a percentage of the instalment, rounded half up in whole kobo', () => {
    const fee = lateFeeFor({ lateFeeType: 'PERCENT', lateFeeValue: 500n, lateFeeCapKobo: null }, 500_000n)!;
    expect(fee.feeKobo).toBe(25_000n); // 5% of ₦5,000.00
    expect(fee.text).toContain('5% of the ₦5,000.00 contribution');
    expect(lateFeeFor({ lateFeeType: 'PERCENT', lateFeeValue: 50n, lateFeeCapKobo: null }, 10_100n)!.feeKobo).toBe(51n); // 50.5 → 51
  });

  it('holds the fee to the cap for each missed instalment and says so', () => {
    const fee = lateFeeFor({ lateFeeType: 'PERCENT', lateFeeValue: 1_000n, lateFeeCapKobo: 15_000n }, 500_000n)!;
    expect(fee).toMatchObject({ feeKobo: 15_000n, capApplied: true, rawKobo: 50_000n });
    expect(fee.text).toContain('held to the group’s limit of ₦150.00');
    expect(lateFeeFor({ lateFeeType: 'PERCENT', lateFeeValue: 100n, lateFeeCapKobo: 15_000n }, 500_000n)!.capApplied).toBe(false);
  });
});

describe('reminders (T6.1)', () => {
  const base = { frequency: 'WEEKLY' as const, graceDays: 3, hasLateFee: true, membershipId: 7 };
  const inst = (id: number, due: string, remaining = 500_000n) => ({ id, dueDate: d(due), remainingKobo: remaining });

  it('reminds the day before an instalment is due, and the day after', () => {
    expect(planReminders({ ...base, today: d('2027-03-07'), installments: [inst(1, '2027-03-08')] }).map((r) => r.kind)).toEqual(['UPCOMING']);
    expect(planReminders({ ...base, today: d('2027-03-09'), installments: [inst(1, '2027-03-08')] }).map((r) => r.kind)).toEqual(['OVERDUE']);
    expect(planReminders({ ...base, today: d('2027-03-05'), installments: [inst(1, '2027-03-08')] })).toEqual([]);
  });

  it('reminds on the last day of grace only when the rules have a late fee', () => {
    const lastDay = { today: d('2027-03-11'), installments: [inst(1, '2027-03-08')] };
    expect(planReminders({ ...base, ...lastDay }).map((r) => r.kind).sort()).toEqual(['GRACE_ENDING', 'OVERDUE']);
    expect(planReminders({ ...base, hasLateFee: false, ...lastDay }).map((r) => r.kind)).toEqual(['OVERDUE']);
  });

  it('gives every reminder a key that can exist only once, so a repeated run finds it already there', () => {
    const first = planReminders({ ...base, today: d('2027-03-09'), installments: [inst(1, '2027-03-08')] });
    const again = planReminders({ ...base, today: d('2027-03-09'), installments: [inst(1, '2027-03-08')] });
    expect(first.map((r) => r.dedupeKey)).toEqual(again.map((r) => r.dedupeKey));
    expect(first[0].dedupeKey).toBe('i:1:OVERDUE');
    // The next day is still overdue, and it is the same reminder: the key is the same, so nothing more is sent.
    expect(planReminders({ ...base, today: d('2027-03-10'), installments: [inst(1, '2027-03-08')] })[0].dedupeKey).toBe('i:1:OVERDUE');
  });

  it('never reminds about an instalment that is paid, or chases one that is long past', () => {
    expect(planReminders({ ...base, today: d('2027-03-09'), installments: [inst(1, '2027-03-08', 0n)] })).toEqual([]);
    expect(planReminders({ ...base, today: d('2027-04-20'), installments: [inst(1, '2027-03-08')] })).toEqual([]);
  });

  it('keeps a daily group to one overdue message a week, listing what is owed, and no upcoming reminder', () => {
    const daily = { ...base, frequency: 'DAILY' as const };
    const items = [inst(1, '2027-03-05'), inst(2, '2027-03-06'), inst(3, '2027-03-08')];
    const mon = planReminders({ ...daily, today: d('2027-03-08'), installments: [...items, inst(4, '2027-03-09')] });
    expect(mon).toHaveLength(1);
    expect(mon[0]).toMatchObject({ kind: 'OVERDUE', installmentIds: [1, 2] });
    const next = planReminders({ ...daily, today: d('2027-03-09'), installments: [...items, inst(4, '2027-03-09')] });
    expect(next[0].dedupeKey).toBe(mon[0].dedupeKey); // the same week: nothing more is sent
    expect(planReminders({ ...daily, today: d('2027-03-16'), installments: items })[0].dedupeKey).not.toBe(mon[0].dedupeKey);
    expect(isoWeekKey(d('2027-03-08'))).toBe('2027-W10');
    expect(isoWeekKey(d('2027-01-01'))).toBe('2026-W53');
  });

  it('writes one message for everything, in plain words with money in full', () => {
    const { title, message } = composeReminder({ groupName: 'Market Circle', lines: [{ kind: 'UPCOMING', dueDate: d('2027-03-08'), remainingKobo: 500_000n }, { kind: 'OVERDUE', dueDate: d('2027-03-01'), remainingKobo: 1_000_000n }] });
    expect(title).toBe('A payment is overdue');
    expect(message).toContain('₦5,000.00 is due tomorrow (2027-03-08)');
    expect(message).toContain('₦10,000.00 due on 2027-03-01 is still unpaid');
    expect(message).toContain('If you have already paid, ignore this');
    expect(composeReminder({ groupName: 'G', lines: [{ kind: 'GRACE_ENDING', dueDate: d('2027-03-08'), remainingKobo: 500_000n }] }).message).toContain('a late fee applies from tomorrow');
    expect(composeReminder({ groupName: 'G', lines: [{ kind: 'UPCOMING', dueDate: d('2027-03-08'), remainingKobo: 1n }] }).title).toBe('A payment is due soon');
  });

  it('writes the officers’ digest as one message with the largest first', () => {
    const { message } = composeDigest({ groupName: 'Market Circle', people: [{ name: 'Ada', overdueKobo: 500_000n }, { name: 'Bola', overdueKobo: 1_500_000n }, ...Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, overdueKobo: 100_000n }))] });
    expect(message).toContain('7 people are overdue, ₦25,000.00 in all');
    expect(message.indexOf('Bola')).toBeLessThan(message.indexOf('Ada'));
    expect(message).toContain('and 2 more');
    expect(composeDigest({ groupName: 'G', people: [{ name: 'Ada', overdueKobo: 100n }] }).message).toContain('1 person is overdue');
  });
});

describe('the trust score (T6.4)', () => {
  const today = d('2027-06-01');
  const row = (due: string, over: Partial<TrustInstallment> = {}): TrustInstallment => ({ dueDate: d(due), amountKobo: 500_000n, paidKobo: 500_000n, completedOn: d(due), disputed: false, waived: false, ...over });

  it('has the bands the owner decided, exactly at the edges', () => {
    expect(trustBand(95, 100)).toBe('EXCELLENT');
    expect(trustBand(94, 100)).toBe('GOOD');
    expect(trustBand(85, 100)).toBe('GOOD');
    expect(trustBand(84, 100)).toBe('FAIR');
    expect(trustBand(70, 100)).toBe('FAIR');
    expect(trustBand(69, 100)).toBe('AT_RISK');
    expect(trustBand(0, 5)).toBe('AT_RISK');
    expect(trustBand(0, 0)).toBe('NO_HISTORY');
    expect(trustBand(19, 20)).toBe('EXCELLENT'); // 95% exactly, with no rounding
    expect(trustBand(57, 60)).toBe('EXCELLENT'); // 95% exactly
    expect(trustBand(113, 120)).toBe('GOOD'); // 94.17%
  });

  it('counts an instalment on time when it was fully paid on or before its due date', () => {
    const r = computeTrust([row('2027-05-01'), row('2027-05-08', { completedOn: d('2027-05-07') }), row('2027-05-15', { completedOn: d('2027-05-16') }), row('2027-05-22', { paidKobo: 0n, completedOn: null })], today);
    expect(r).toMatchObject({ dueCount: 4, onTimeCount: 2, onTimeBps: 5000, band: 'AT_RISK' });
    expect(r.text).toBe('2 of your last 4 payments were on time (50%).');
  });

  it('does not count a part-paid instalment as on time, even if the part was early', () => {
    const r = computeTrust([row('2027-05-01', { paidKobo: 300_000n, completedOn: null })], today);
    expect(r).toMatchObject({ dueCount: 1, onTimeCount: 0 });
  });

  it('leaves out disputed instalments until they are decided, never counts waived ones, and ignores what is not yet due or older than a year', () => {
    const r = computeTrust([row('2027-05-01'), row('2027-05-08', { paidKobo: 0n, completedOn: null, disputed: true }), row('2027-05-15', { paidKobo: 0n, completedOn: null, waived: true }), row('2027-06-01'), row('2027-07-01'), row('2026-05-01')], today);
    expect(r).toMatchObject({ dueCount: 1, onTimeCount: 1, excludedDisputed: 1, excludedWaived: 1, band: 'EXCELLENT' });
    expect(r.text).toContain('1 under dispute is not counted until decided');
    expect(r.text).toContain('1 waived is not counted');
  });

  it('shows no history for a new member', () => {
    const r = computeTrust([row('2027-06-10'), row('2027-06-17')], today);
    expect(r).toMatchObject({ band: 'NO_HISTORY', onTimeBps: null, dueCount: 0 });
    expect(r.text).toBe('No history yet: nothing has fallen due.');
    expect(computeTrust([], today).band).toBe('NO_HISTORY');
  });
});

describe('repayment plans (T6.3)', () => {
  it('drafts equal instalments on the group’s own cycle, with the total exactly right', () => {
    const plan = draftPlan({ outstandingKobo: 1_000_000n, frequency: 'WEEKLY', from: d('2027-04-01'), periods: 4 });
    expect(plan.map((l) => l.dueDate)).toEqual(['2027-04-08', '2027-04-15', '2027-04-22', '2027-04-29']);
    expect(plan.every((l) => l.amountKobo === '250000')).toBe(true);
    const odd = draftPlan({ outstandingKobo: 1_000_003n, frequency: 'MONTHLY', from: d('2027-01-31'), periods: 3 });
    expect(odd.map((l) => BigInt(l.amountKobo)).reduce((a, b) => a + b, 0n)).toBe(1_000_003n);
    expect(odd.map((l) => l.amountKobo)).toEqual(['333335', '333334', '333334']);
    expect(odd.map((l) => l.dueDate)).toEqual(['2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it('keeps a plan to a sensible length and refuses nothing to repay', () => {
    expect(draftPlan({ outstandingKobo: 100n, frequency: 'DAILY', from: d('2027-04-01'), periods: 500 })).toHaveLength(24);
    expect(draftPlan({ outstandingKobo: 100n, frequency: 'DAILY', from: d('2027-04-01'), periods: 0 })).toHaveLength(1);
    expect(() => draftPlan({ outstandingKobo: 0n, frequency: 'DAILY', from: d('2027-04-01'), periods: 3 })).toThrow();
  });

  const schedule = [{ dueDate: '2027-04-08', amountKobo: '250000' }, { dueDate: '2027-04-15', amountKobo: '250000' }, { dueDate: '2027-04-22', amountKobo: '250000' }];

  it('is on track while payments keep up with the dates, and a date is only missed a day after it passes', () => {
    expect(trackPlan(schedule, 0n, d('2027-04-08')).onTrack).toBe(true);
    expect(trackPlan(schedule, 0n, d('2027-04-09')).onTrack).toBe(true); // a day of leeway
    const late = trackPlan(schedule, 0n, d('2027-04-10'));
    expect(late).toMatchObject({ onTrack: false, missed: ['2027-04-08'], dueByNowKobo: 250_000n, behindKobo: 250_000n });
    expect(trackPlan(schedule, 250_000n, d('2027-04-10')).onTrack).toBe(true);
  });

  it('counts payments against the plan as a running total', () => {
    const t = trackPlan(schedule, 300_000n, d('2027-04-20'));
    expect(t).toMatchObject({ missed: ['2027-04-15'], behindKobo: 200_000n, paidKobo: 300_000n });
    expect(trackPlan(schedule, 750_000n, d('2027-05-30'))).toMatchObject({ onTrack: true, behindKobo: 0n, missed: [] });
  });
});
