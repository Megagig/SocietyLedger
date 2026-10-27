import { planLedgerReconciliation, runningBalances, type ExistingLedgerEntry, type ReconcileTransaction } from '../../src/modules/member-finance/ledger-reconcile-rules';

const day = (d: number) => new Date(`2026-10-${String(d).padStart(2, '0')}T10:00:00Z`);

const donation = (id: number, amount: number, payments: Array<{ id: number; amount: number }> = []): ReconcileTransaction => ({
  id,
  amount,
  isVoided: false,
  createdAt: day(1),
  category: { type: 'donation', name: 'Building Fund' },
  payments: payments.map((p) => ({ id: p.id, amountPaid: p.amount, paymentDate: day(2), receiptNumber: `RCP-${p.id}` })),
});

const dues = (id: number, amount: number, payments: Array<{ id: number; amount: number }> = []): ReconcileTransaction => ({
  ...donation(id, amount, payments),
  category: { type: 'due', name: 'Monthly Dues' },
});

const net = (plan: ReturnType<typeof planLedgerReconciliation>) =>
  plan.toCreate.reduce((s, e) => s + (e.entryType === 'DEBIT' ? e.amount : -e.amount), 0);

describe('what a member ledger should hold for their charges and payments', () => {
  it('an instant donation is a debit and a credit of the same amount, so it leaves the member owing nothing', () => {
    const plan = planLedgerReconciliation({ transactions: [donation(1, 20000, [{ id: 10, amount: 20000 }])], existing: [], neutralisedPaymentIds: new Set() });
    expect(plan.toCreate.map((e) => [e.entryType, e.category, e.amount, e.description])).toEqual([
      ['DEBIT', 'DONATION', 20000, 'Donation: Building Fund'],
      ['CREDIT', 'DONATION', 20000, 'Donation received: Building Fund'],
    ]);
    expect(net(plan)).toBe(0);
  });

  it('an unpaid pledge is owed for the amount promised, and a part-payment reduces it', () => {
    expect(net(planLedgerReconciliation({ transactions: [donation(1, 10000)], existing: [], neutralisedPaymentIds: new Set() }))).toBe(10000);
    expect(net(planLedgerReconciliation({ transactions: [donation(1, 10000, [{ id: 10, amount: 4000 }])], existing: [], neutralisedPaymentIds: new Set() }))).toBe(6000);
  });

  it('a payment made online lands on the ledger like any other (the old online routes never wrote it)', () => {
    const existing: ExistingLedgerEntry[] = [{ id: 1, sourceTable: 'transaction', sourceId: 5, entryType: 'DEBIT', amount: 15000 }];
    const plan = planLedgerReconciliation({ transactions: [dues(5, 15000, [{ id: 50, amount: 15000 }])], existing, neutralisedPaymentIds: new Set() });
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0]).toMatchObject({ entryType: 'CREDIT', sourceTable: 'payment', sourceId: 50, amount: 15000 });
    expect(plan.toRemoveIds).toEqual([]);
  });

  it('a ledger that is already right needs no change at all', () => {
    const existing: ExistingLedgerEntry[] = [
      { id: 1, sourceTable: 'transaction', sourceId: 1, entryType: 'DEBIT', amount: 20000 },
      { id: 2, sourceTable: 'payment', sourceId: 10, entryType: 'CREDIT', amount: 20000 },
    ];
    expect(planLedgerReconciliation({ transactions: [donation(1, 20000, [{ id: 10, amount: 20000 }])], existing, neutralisedPaymentIds: new Set() })).toEqual({
      toCreate: [],
      toRemoveIds: [],
      toUpdate: [],
    });
  });

  it('removes the credit of a donation that was deleted', () => {
    const existing: ExistingLedgerEntry[] = [{ id: 7, sourceTable: 'payment', sourceId: 99, entryType: 'CREDIT', amount: 8000 }];
    const plan = planLedgerReconciliation({ transactions: [], existing, neutralisedPaymentIds: new Set() });
    expect(plan.toRemoveIds).toEqual([7]);
  });

  it('leaves a voided cash receipt alone: its credit is already offset by the "payment_void" entry', () => {
    const existing: ExistingLedgerEntry[] = [{ id: 7, sourceTable: 'payment', sourceId: 99, entryType: 'CREDIT', amount: 8000 }];
    const plan = planLedgerReconciliation({ transactions: [], existing, neutralisedPaymentIds: new Set([99]) });
    expect(plan.toRemoveIds).toEqual([]);
  });

  it('a voided charge is no longer owed, but a payment already made against it still counts', () => {
    const voided = { ...dues(3, 10000, [{ id: 30, amount: 4000 }]), isVoided: true };
    const existing: ExistingLedgerEntry[] = [{ id: 1, sourceTable: 'transaction', sourceId: 3, entryType: 'DEBIT', amount: 10000 }];
    const plan = planLedgerReconciliation({ transactions: [voided], existing, neutralisedPaymentIds: new Set() });
    expect(plan.toRemoveIds).toEqual([1]);
    expect(plan.toCreate.map((e) => e.sourceTable)).toEqual(['payment']);
  });

  it('keeps the first of two copies and removes the duplicate', () => {
    const existing: ExistingLedgerEntry[] = [
      { id: 1, sourceTable: 'transaction', sourceId: 1, entryType: 'DEBIT', amount: 5000 },
      { id: 2, sourceTable: 'transaction', sourceId: 1, entryType: 'DEBIT', amount: 5000 },
    ];
    expect(planLedgerReconciliation({ transactions: [dues(1, 5000)], existing, neutralisedPaymentIds: new Set() }).toRemoveIds).toEqual([2]);
  });

  it('corrects an amount that no longer matches the charge', () => {
    const existing: ExistingLedgerEntry[] = [{ id: 1, sourceTable: 'transaction', sourceId: 1, entryType: 'DEBIT', amount: 5000 }];
    expect(planLedgerReconciliation({ transactions: [dues(1, 7500)], existing, neutralisedPaymentIds: new Set() }).toUpdate).toEqual([{ id: 1, amount: 7500 }]);
  });
});

describe('running balance', () => {
  it('adds debits and takes away credits in the order given', () => {
    const result = runningBalances([
      { id: 1, entryType: 'DEBIT', amount: 20000 },
      { id: 2, entryType: 'CREDIT', amount: 20000 },
      { id: 3, entryType: 'DEBIT', amount: 10000 },
      { id: 4, entryType: 'CREDIT', amount: 2000 },
    ]);
    expect([...result.values()]).toEqual([20000, 0, 10000, 8000]);
  });
});

describe('how a pledge reads on the ledger', () => {
  const pledge = (id: number, amount: number, payments: Array<{ id: number; amount: number }> = []): ReconcileTransaction => ({ ...donation(id, amount, payments), dueDate: day(24) });

  it('an unpaid pledge reads "Donation pledge", so it is plainly a promise and not a donation the member is owed for', () => {
    const plan = planLedgerReconciliation({ transactions: [pledge(1, 100000)], existing: [], neutralisedPaymentIds: new Set() });
    expect(plan.toCreate.map((e) => [e.entryType, e.description])).toEqual([['DEBIT', 'Donation pledge: Building Fund']]);
  });

  it('a payment against a pledge reads "Pledge payment"', () => {
    const plan = planLedgerReconciliation({ transactions: [pledge(1, 100000, [{ id: 5, amount: 40000 }])], existing: [], neutralisedPaymentIds: new Set() });
    expect(plan.toCreate.map((e) => e.description)).toEqual(['Donation pledge: Building Fund', 'Pledge payment: Building Fund']);
  });

  it('re-words an existing donation line that was written before pledges had their own wording, and nothing else', () => {
    const existing: ExistingLedgerEntry[] = [
      { id: 1, sourceTable: 'transaction', sourceId: 1, entryType: 'DEBIT', amount: 100000, category: 'DONATION', description: 'Donation: Building Fund' },
      { id: 2, sourceTable: 'transaction', sourceId: 2, entryType: 'DEBIT', amount: 5000, category: 'DUES', description: 'A description an officer is used to' },
    ];
    const plan = planLedgerReconciliation({ transactions: [pledge(1, 100000), dues(2, 5000)], existing, neutralisedPaymentIds: new Set() });
    expect(plan.toUpdate).toEqual([{ id: 1, description: 'Donation pledge: Building Fund' }]);
  });
});
