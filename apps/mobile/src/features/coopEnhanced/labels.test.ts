import { CELL_WORDS, WITHDRAWAL_STATUS_KEYS, WITHDRAWAL_STATUS_LABELS, isPositive, withdrawalActions, withdrawalProgress } from './labels';

const base = { twoStage: true, payoutMethod: null, payoutReference: null, rejectionReason: null };

describe('withdrawalProgress: where a request has got to, in words', () => {
  it('says who it is waiting for at each stage', () => {
    expect(withdrawalProgress({ ...base, status: 'PENDING_REVIEW' })).toBe('Waiting for an officer to review it.');
    expect(withdrawalProgress({ ...base, status: 'PENDING_APPROVAL' })).toBe('Reviewed. Waiting for a second officer to approve and pay.');
  });

  it('does not talk about a review when the cooperative runs one stage', () => {
    expect(withdrawalProgress({ ...base, twoStage: false, status: 'PENDING_APPROVAL' })).toBe('Waiting for an officer to approve and pay.');
  });

  it('says how an approved withdrawal was paid, with its reference', () => {
    expect(withdrawalProgress({ ...base, status: 'APPROVED', payoutMethod: 'BANK_TRANSFER', payoutReference: 'TRF-1' })).toBe('Approved and paid by bank transfer (ref TRF-1).');
    expect(withdrawalProgress({ ...base, status: 'APPROVED' })).toBe('Approved.');
  });

  it("gives the officer's reason when it was turned down, and says so when you cancelled", () => {
    expect(withdrawalProgress({ ...base, status: 'REJECTED', rejectionReason: 'Loan guarantee outstanding' })).toBe('Not approved: Loan guarantee outstanding');
    expect(withdrawalProgress({ ...base, status: 'CANCELLED' })).toBe('You cancelled this request.');
  });
});

describe('status wording', () => {
  it('has a label and a chip key for every withdrawal status', () => {
    for (const status of ['PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'] as const) {
      expect(WITHDRAWAL_STATUS_LABELS[status]).toBeTruthy();
      expect(WITHDRAWAL_STATUS_KEYS[status]).toBeTruthy();
    }
  });

  it('describes every contribution-table cell in words, so colour is never the only signal', () => {
    for (const status of ['PAID', 'PARTIAL', 'DEFAULTED', 'DUE', 'NONE'] as const) expect(CELL_WORDS[status].length).toBeGreaterThan(0);
  });
});

describe('isPositive', () => {
  it('is true only for an amount above zero', () => {
    expect(isPositive('5000.00')).toBe(true);
    expect(isPositive('0')).toBe(false);
    expect(isPositive('0.00')).toBe(false);
    expect(isPositive(null)).toBe(false);
    expect(isPositive(undefined)).toBe(false);
  });
});

describe('withdrawalActions: which buttons an officer gets', () => {
  const w = { status: 'PENDING_REVIEW' as const, twoStage: true, memberId: 10, reviewedBy: null as number | null };
  const both = { review: true, approve: true };

  it('offers review at stage one only to someone who may review', () => {
    expect(withdrawalActions(w, both, { userId: 1, memberId: 2 })).toEqual({ review: true });
    expect(withdrawalActions(w, { review: false, approve: true }, { userId: 1, memberId: 2 }).note).toMatch(/permission to review/);
  });

  it('never lets the member decide their own request, at either stage', () => {
    expect(withdrawalActions(w, both, { userId: 1, memberId: 10 }).note).toMatch(/your own request/);
    expect(withdrawalActions({ ...w, status: 'PENDING_APPROVAL' }, both, { userId: 1, memberId: 10 }).note).toMatch(/your own request/);
  });

  it('offers final approval only to a different officer than the reviewer, when there are two stages', () => {
    const waiting = { ...w, status: 'PENDING_APPROVAL' as const, reviewedBy: 1 };
    expect(withdrawalActions(waiting, both, { userId: 2, memberId: 3 })).toEqual({ approve: true });
    expect(withdrawalActions(waiting, both, { userId: 1, memberId: 3 }).note).toMatch(/different officer/);
    expect(withdrawalActions(waiting, { review: true, approve: false }, { userId: 2, memberId: 3 }).note).toMatch(/permission to approve/);
  });

  it('lets the reviewer approve when the cooperative runs one stage (there is no separate review)', () => {
    expect(withdrawalActions({ ...w, status: 'PENDING_APPROVAL', twoStage: false, reviewedBy: 1 }, both, { userId: 1, memberId: 3 })).toEqual({ approve: true });
  });

  it('offers nothing on a request that is already decided', () => {
    expect(withdrawalActions({ ...w, status: 'APPROVED' }, both, { userId: 1, memberId: 3 })).toEqual({});
  });
});
