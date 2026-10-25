import {
  donationHasReceipt,
  donationStatusKey,
  donationStatusLabel,
  lateFeeOutcomeSummary,
  lateFeePreviewHeadline,
  penaltyCanWaive,
  receiptShareText,
  ruleFeeLabel,
  ruleScheduleLabel,
  ruleScopeLabel,
  waiveOutcomeSummary,
} from './labels';

const donation = (over: object = {}) => ({ isVoided: false, isPledge: false, status: 'paid', ...over });

describe('donation status', () => {
  it('a paid gift is Received, a pledge is Pledged, a voided one says so', () => {
    expect(donationStatusLabel(donation())).toBe('Received');
    expect(donationStatusLabel(donation({ isPledge: true, status: 'pending' }))).toBe('Pledged');
    expect(donationStatusLabel(donation({ isVoided: true }))).toBe('Voided');
    expect(donationStatusLabel(donation({ status: 'partial' }))).toBe('Part paid');
    expect(donationStatusKey(donation({ isPledge: true }))).toBe('pending');
    expect(donationStatusKey(donation({ isVoided: true }))).toBe('cancelled');
    expect(donationStatusKey(donation())).toBe('paid');
  });

  it('only money received has a receipt', () => {
    expect(donationHasReceipt(donation())).toBe(true);
    expect(donationHasReceipt(donation({ isPledge: true }))).toBe(false);
    expect(donationHasReceipt(donation({ isVoided: true }))).toBe(false);
  });
});

describe('receiptShareText', () => {
  const receipt = {
    receiptNumber: 'DON-2026-000012', donationDate: '2026-10-20T10:00:00.000Z', amount: 25000,
    donor: { name: 'Ada Obi' }, category: 'Building fund', allocation: { id: 2, name: 'Hall roof', type: 'project' },
    donorMessage: 'God bless', association: { id: 1, name: 'Oko Union' }, paymentMethod: 'bank_transfer',
  };

  it('reads as a plain receipt', () => {
    const text = receiptShareText(receipt);
    expect(text).toContain('Oko Union');
    expect(text).toContain('Donation receipt DON-2026-000012');
    expect(text).toContain('From: Ada Obi');
    expect(text).toContain('Fund: Hall roof');
    expect(text).toContain('Amount: ₦25,000.00');
    expect(text).toContain('Paid by: bank transfer');
    expect(text).toContain('Message: God bless');
  });

  it('keeps an anonymous donor anonymous and leaves out what is missing', () => {
    const text = receiptShareText({ ...receipt, donor: { name: 'Anonymous Donor' }, allocation: null, donorMessage: null, paymentMethod: 'N/A' });
    expect(text).toContain('From: Anonymous Donor');
    expect(text).not.toContain('Fund:');
    expect(text).not.toContain('Paid by');
    expect(text).not.toContain('Message:');
  });
});

describe('rules', () => {
  it('describes the fee, the schedule and what the rule covers', () => {
    expect(ruleFeeLabel({ feeType: 'fixed', feeAmount: '500', maxFeeAmount: null })).toBe('₦500.00 flat');
    expect(ruleFeeLabel({ feeType: 'percentage', feeAmount: '5', maxFeeAmount: '2000' })).toBe('5% of what is owed (at most ₦2,000.00)');
    expect(ruleScheduleLabel({ gracePeriodDays: 7, isCompounding: false, compoundingDays: null })).toBe('After 7 days · once');
    expect(ruleScheduleLabel({ gracePeriodDays: 0, isCompounding: true, compoundingDays: 30 })).toBe('Straight away · repeats every 30 days');
    expect(ruleScopeLabel({ category: null })).toBe('All dues and levies');
    expect(ruleScopeLabel({ category: { id: 3, name: 'Annual dues', type: 'due' } })).toBe('Annual dues');
  });
});

describe('waiving', () => {
  const penalty = (over: object = {}) => ({ category: { type: 'penalty' }, isVoided: false, status: 'pending', balance: '5000', ...over });

  it('a live penalty with something owed can be waived', () => {
    expect(penaltyCanWaive(penalty())).toBe(true);
    expect(penaltyCanWaive(penalty({ status: 'partial' }))).toBe(true);
  });

  it('nothing else can: a due, a voided, waived or settled penalty', () => {
    expect(penaltyCanWaive(penalty({ category: { type: 'due' } }))).toBe(false);
    expect(penaltyCanWaive(penalty({ isVoided: true }))).toBe(false);
    expect(penaltyCanWaive(penalty({ status: 'waived' }))).toBe(false);
    expect(penaltyCanWaive(penalty({ balance: '0' }))).toBe(false);
  });

  it('says what happened', () => {
    expect(waiveOutcomeSummary({ newAmount: 3000, fullyWaived: false })).toBe('Penalty reduced — ₦3,000.00 is still owed');
    expect(waiveOutcomeSummary({ newAmount: 0, fullyWaived: true })).toBe('Penalty waived in full');
  });
});

describe('late fees', () => {
  it('summarises a preview and an outcome', () => {
    expect(lateFeePreviewHeadline({ count: 12, memberCount: 9, totalAmount: 48000 })).toBe('12 late fees for 9 members · ₦48,000.00');
    expect(lateFeePreviewHeadline({ count: 1, memberCount: 1, totalAmount: 500 })).toBe('1 late fee for 1 member · ₦500.00');
    expect(lateFeePreviewHeadline({ count: 0, memberCount: 0, totalAmount: 0 })).toBe('No late fees are due right now.');
    expect(lateFeeOutcomeSummary({ applied: 3, totalAmount: 1500 })).toBe('Charged 3 late fees · ₦1,500.00');
    expect(lateFeeOutcomeSummary({ applied: 0, totalAmount: 0 })).toBe('No late fees were due.');
  });
});
