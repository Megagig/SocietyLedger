import { allocateOldestFirst, checkReconcile, formatNaira, handoverFigures, hashProof, installmentStatusFor, newReference, normaliseBankReference, receiptMessage, smsForMoment, totalOwed, type OpenInstallment, type ReceiptMoment } from '../../src/modules/ajo/ajo-collections';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const open = (id: number, due: string, remaining: bigint): OpenInstallment => ({ id, dueDate: d(due), remainingKobo: remaining });

describe('Ajo money in full', () => {
  it('writes kobo as naira with thousands separators and two decimals, never shortened', () => {
    expect(formatNaira(500_000n)).toBe('₦5,000.00');
    expect(formatNaira(1_234_567_89n)).toBe('₦1,234,567.89');
    expect(formatNaira(5n)).toBe('₦0.05');
    expect(formatNaira(0n)).toBe('₦0.00');
    expect(formatNaira(100_000_000_000n)).toBe('₦1,000,000,000.00');
    expect(formatNaira(-250_000n)).toBe('-₦2,500.00');
    for (const k of [500_000n, 1_000_000n, 120_000_000n]) expect(formatNaira(k)).not.toMatch(/\b\d+(\.\d+)?[km]\b/i);
  });

  it('does not lose precision at amounts beyond what a float holds exactly', () => {
    expect(formatNaira(9_007_199_254_740_993n)).toBe('₦90,071,992,547,409.93');
  });
});

describe('Ajo allocation: oldest installment first', () => {
  const owed = [open(3, '2027-03-15', 500_000n), open(1, '2027-03-01', 500_000n), open(2, '2027-03-08', 500_000n)];

  it('fills the oldest due date first, whatever order the installments arrive in', () => {
    const { allocations, leftoverKobo } = allocateOldestFirst(owed, 500_000n);
    expect(allocations).toEqual([{ installmentId: 1, amountKobo: 500_000n }]);
    expect(leftoverKobo).toBe(0n);
  });

  it('pays arrears before anything newer, even when the payment is "for this week"', () => {
    // Last week (id 1) is unpaid; this week's amount still goes to last week.
    expect(allocateOldestFirst([open(1, '2027-03-01', 500_000n), open(2, '2027-03-08', 500_000n)], 500_000n).allocations).toEqual([{ installmentId: 1, amountKobo: 500_000n }]);
  });

  it('spreads a bigger payment across installments and leaves a part-payment on the last one', () => {
    const { allocations } = allocateOldestFirst(owed, 1_200_000n);
    expect(allocations).toEqual([{ installmentId: 1, amountKobo: 500_000n }, { installmentId: 2, amountKobo: 500_000n }, { installmentId: 3, amountKobo: 200_000n }]);
  });

  it('allocates exactly the amount paid: nothing created, nothing lost', () => {
    for (const amount of [1n, 499_999n, 500_000n, 500_001n, 1_000_000n, 1_499_999n, 1_500_000n]) {
      const { allocations, leftoverKobo } = allocateOldestFirst(owed, amount);
      expect(allocations.reduce((s, a) => s + a.amountKobo, 0n) + leftoverKobo).toBe(amount);
      expect(allocations.every((a) => a.amountKobo > 0n)).toBe(true);
    }
  });

  it('finishes a part-paid installment before it starts the next', () => {
    const { allocations } = allocateOldestFirst([open(1, '2027-03-01', 200_000n), open(2, '2027-03-08', 500_000n)], 300_000n);
    expect(allocations).toEqual([{ installmentId: 1, amountKobo: 200_000n }, { installmentId: 2, amountKobo: 100_000n }]);
  });

  it('reports what is left over when the payment is bigger than everything owed', () => {
    const { allocations, leftoverKobo } = allocateOldestFirst(owed, 2_000_000n);
    expect(allocations.reduce((s, a) => s + a.amountKobo, 0n)).toBe(1_500_000n);
    expect(leftoverKobo).toBe(500_000n);
    expect(totalOwed(owed)).toBe(1_500_000n);
  });

  it('breaks ties between installments due the same day by id, so the result never depends on the database order', () => {
    const a = allocateOldestFirst([open(9, '2027-03-01', 100n), open(4, '2027-03-01', 100n)], 100n).allocations;
    const b = allocateOldestFirst([open(4, '2027-03-01', 100n), open(9, '2027-03-01', 100n)], 100n).allocations;
    expect(a).toEqual([{ installmentId: 4, amountKobo: 100n }]);
    expect(b).toEqual(a);
  });

  it('ignores installments with nothing left to pay, and refuses a zero or negative payment', () => {
    expect(allocateOldestFirst([open(1, '2027-03-01', 0n), open(2, '2027-03-08', 100n)], 100n).allocations).toEqual([{ installmentId: 2, amountKobo: 100n }]);
    expect(() => allocateOldestFirst(owed, 0n)).toThrow();
    expect(() => allocateOldestFirst(owed, -5n)).toThrow();
  });

  it('shows the right status for what has been paid', () => {
    const today = d('2027-03-10');
    expect(installmentStatusFor(500_000n, 500_000n, d('2027-03-01'), today)).toBe('PAID');
    expect(installmentStatusFor(500_000n, 100_000n, d('2027-03-01'), today)).toBe('PARTIAL');
    expect(installmentStatusFor(500_000n, 0n, d('2027-03-01'), today)).toBe('OVERDUE');
    expect(installmentStatusFor(500_000n, 0n, d('2027-03-15'), today)).toBe('DUE');
    expect(installmentStatusFor(500_000n, 0n, d('2027-03-10'), today)).toBe('DUE');
  });
});

describe('Ajo handover arithmetic', () => {
  const lines = [{ contributionId: 1, amountKobo: 500_000n }, { contributionId: 2, amountKobo: 300_000n }, { contributionId: 3, amountKobo: 200_000n }];

  it('works out collected, handed over and what is still in hand', () => {
    expect(handoverFigures(lines, 1_000_000n)).toEqual({ collectedKobo: 1_000_000n, handedOverKobo: 1_000_000n, differenceKobo: 0n });
    expect(handoverFigures(lines, 800_000n).differenceKobo).toBe(200_000n);
    expect(handoverFigures(lines, 0n).differenceKobo).toBe(1_000_000n);
  });

  it('will not accept more handed over than was recorded, or a negative amount', () => {
    expect(() => handoverFigures(lines, 1_000_001n)).toThrow(/Record the missing payments/);
    expect(() => handoverFigures(lines, -1n)).toThrow();
  });
});

describe('Ajo reconcile: the count must agree with the lines ticked', () => {
  const lines = [{ contributionId: 1, amountKobo: 500_000n }, { contributionId: 2, amountKobo: 300_000n }, { contributionId: 3, amountKobo: 200_000n }];

  it('accepts a count that equals the ticked lines and splits received from missing', () => {
    const r = checkReconcile(lines, [1, 3], 700_000n);
    expect(r).toEqual({ receivedIds: [1, 3], missingIds: [2], receivedKobo: 700_000n, missingKobo: 300_000n });
    expect(checkReconcile(lines, [1, 2, 3], 1_000_000n).missingIds).toEqual([]);
  });

  it('refuses a count that does not equal the ticked lines, so a difference cannot hide in a total', () => {
    expect(() => checkReconcile(lines, [1, 2, 3], 900_000n)).toThrow(expect.objectContaining({ code: 'COUNT_MISMATCH' }));
    expect(() => checkReconcile(lines, [1], 800_000n)).toThrow(expect.objectContaining({ code: 'COUNT_MISMATCH' }));
  });

  it('says the amounts in full when it refuses', () => {
    try {
      checkReconcile(lines, [1, 2, 3], 900_000n);
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('₦9,000.00');
      expect((error as Error).message).toContain('₦10,000.00');
    }
  });

  it('refuses a ticked payment that is not part of the handover', () => {
    expect(() => checkReconcile(lines, [1, 99], 500_000n)).toThrow(expect.objectContaining({ code: 'LINE_NOT_IN_HANDOVER' }));
  });

  it('allows ticking nothing when nothing was received', () => {
    expect(checkReconcile(lines, [], 0n)).toMatchObject({ receivedIds: [], missingIds: [1, 2, 3], receivedKobo: 0n, missingKobo: 1_000_000n });
  });
});

describe('Ajo references and proofs', () => {
  it('makes a short reference a person can read out, with no look-alike characters', () => {
    const ref = newReference(new Date('2027-03-02T10:00:00Z'));
    expect(ref).toMatch(/^AJO-270302-[A-HJ-NP-Z2-9]{8}$/);
    expect(newReference(new Date('2027-03-02T10:00:00Z'))).not.toBe(ref);
    expect(newReference(new Date('2027-03-02T10:00:00Z'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]))).toBe(newReference(new Date('2027-03-02T10:00:00Z'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7])));
  });

  it('hashes the same file to the same value and different files differently', () => {
    expect(hashProof(Buffer.from('screenshot'))).toBe(hashProof(Buffer.from('screenshot')));
    expect(hashProof(Buffer.from('screenshot'))).not.toBe(hashProof(Buffer.from('screenshot2')));
    expect(hashProof(Buffer.from('x'))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('compares bank references without regard to case, spaces or dashes', () => {
    expect(normaliseBankReference('TRF 123-ab')).toBe('TRF123AB');
    expect(normaliseBankReference('trf123ab')).toBe('TRF123AB');
    expect(normaliseBankReference('  ')).toBeNull();
    expect(normaliseBankReference('ab')).toBeNull();
    expect(normaliseBankReference(undefined)).toBeNull();
  });
});

describe('Ajo receipts', () => {
  const base = { amountKobo: 500_000n, groupName: 'Market Circle', reference: 'AJO-270302-K7P2QX4M' };

  it('writes each moment in plain words with the amount in full and the reference to quote', () => {
    const moments: ReceiptMoment[] = ['RECORDED', 'CONFIRMED', 'REJECTED', 'MISSING', 'REVERSED'];
    for (const moment of moments) {
      const { title, message } = receiptMessage({ ...base, moment, method: 'CASH', reason: 'The bank shows a different amount', collectorName: 'Mr Obi' });
      expect(title.length).toBeGreaterThan(3);
      expect(message).toContain('₦5,000.00');
      expect(message).toContain('Market Circle');
      expect(message).toContain('AJO-270302-K7P2QX4M');
    }
  });

  it('says cash is awaiting confirmation and names the collector, and treats a transfer as a report', () => {
    expect(receiptMessage({ ...base, moment: 'RECORDED', method: 'CASH', collectorName: 'Mr Obi' }).message).toMatch(/by your collector Mr Obi.*awaiting confirmation/);
    expect(receiptMessage({ ...base, moment: 'RECORDED', method: 'TRANSFER' }).message).toMatch(/Your report of ₦5,000.00.*awaiting confirmation/);
  });

  it('carries the reason when something went wrong, and reassures the contributor when cash is missing from a handover', () => {
    expect(receiptMessage({ ...base, moment: 'REJECTED', method: 'TRANSFER', reason: 'The bank shows ₦4,000.00' }).message).toContain('The bank shows ₦4,000.00');
    expect(receiptMessage({ ...base, moment: 'REVERSED', method: 'CASH', reason: 'Recorded against the wrong person' }).message).toContain('Recorded against the wrong person');
    expect(receiptMessage({ ...base, moment: 'MISSING', method: 'CASH' }).message).toMatch(/Keep this message as proof/);
  });

  it('texts a contributor with no login for the moments that matter, and not for a routine confirmation', () => {
    expect(smsForMoment('RECORDED')).toBe(true);
    expect(smsForMoment('REJECTED')).toBe(true);
    expect(smsForMoment('MISSING')).toBe(true);
    expect(smsForMoment('REVERSED')).toBe(true);
    expect(smsForMoment('CONFIRMED')).toBe(false);
  });
});
