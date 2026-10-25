/**
 * Deciding a payment proof records money, so it can only happen once and only for what is genuinely owed. These cover the
 * guards: pending proofs only (a double tap, a second officer, or approving a rejected proof must fail), no self-approval,
 * nothing-to-apply refused, and each declared charge paid for its remaining balance — never twice, never voided or waived.
 * Prisma and the accounting syncs are mocked.
 */
const mockTx = {
  paymentProof: { findFirst: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  transaction: { findMany: jest.fn(), update: jest.fn() },
  payment: { count: jest.fn(), create: jest.fn() },
  levyCampaignAssignment: { updateMany: jest.fn() },
  bankTransfer: { update: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: { $transaction: (cb: (tx: typeof mockTx) => unknown) => cb(mockTx) } }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: { onPaymentRecorded: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({ memberLedgerService: { createFromPayment: jest.fn().mockResolvedValue(undefined) } }));

import { Decimal } from '@prisma/client/runtime/library';
import { decidePaymentProof, ProofDecisionError, targetTransactionIds } from '../../src/modules/nigerian-payments/payment-proof-decision';

const OFFICER = 5;
const proofRow = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  associationId: 1,
  memberId: 40,
  status: 'PENDING',
  transactionId: null,
  transactionIds: [100, 101],
  bankTransferId: null,
  paymentMethod: 'bank_transfer',
  member: { userId: 77 },
  ...overrides,
});
const charge = (id: number, amount: string, paid: string[] = [], overrides: Record<string, unknown> = {}) => ({
  id,
  amount: new Decimal(amount),
  status: 'pending',
  payments: paid.map((p) => ({ amountPaid: new Decimal(p) })),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockTx.paymentProof.findFirst.mockResolvedValue(proofRow());
  mockTx.paymentProof.updateMany.mockResolvedValue({ count: 1 });
  mockTx.paymentProof.findUniqueOrThrow.mockResolvedValue({ id: 9, status: 'APPROVED' });
  mockTx.transaction.findMany.mockResolvedValue([charge(100, '5000.00'), charge(101, '2500.00', ['500.00'])]);
  mockTx.payment.count.mockResolvedValue(0);
  mockTx.payment.create.mockImplementation(({ data }: { data: { amountPaid: Decimal } }) => Promise.resolve({ id: 1, ...data }));
});

describe('approving a proof', () => {
  it('records one payment per declared charge for what is still owed, and marks each paid', async () => {
    await decidePaymentProof(9, 1, OFFICER, { status: 'APPROVED' });

    const amounts = mockTx.payment.create.mock.calls.map(([arg]) => (arg.data.amountPaid as Decimal).toString());
    expect(amounts).toEqual(['5000', '2000']);
    expect(mockTx.transaction.update).toHaveBeenCalledTimes(2);
    expect(mockTx.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 100 }, data: expect.objectContaining({ status: 'paid' }) }));
  });

  it("only looks at this member's own, unvoided charges", async () => {
    await decidePaymentProof(9, 1, OFFICER, { status: 'APPROVED' });

    expect(mockTx.transaction.findMany.mock.calls[0]?.[0].where).toMatchObject({ associationId: 1, memberId: 40, isVoided: false, id: { in: [100, 101] } });
  });

  it('skips a charge that was settled another way or waived since — never pays twice', async () => {
    mockTx.transaction.findMany.mockResolvedValue([charge(100, '5000.00', ['5000.00']), charge(101, '2500.00', [], { status: 'waived' })]);

    await decidePaymentProof(9, 1, OFFICER, { status: 'APPROVED' });

    expect(mockTx.payment.create).not.toHaveBeenCalled();
  });

  it('applies the single charge an officer linked, with the same balance rule', async () => {
    mockTx.paymentProof.findFirst.mockResolvedValue(proofRow({ transactionIds: [], transactionId: 100 }));
    mockTx.transaction.findMany.mockResolvedValue([charge(100, '5000.00', ['1000.00'])]);

    await decidePaymentProof(9, 1, OFFICER, { status: 'APPROVED' });

    expect((mockTx.payment.create.mock.calls[0]?.[0].data.amountPaid as Decimal).toString()).toBe('4000');
  });

  it('marks a linked bank transfer verified', async () => {
    mockTx.paymentProof.findFirst.mockResolvedValue(proofRow({ bankTransferId: 3 }));
    await decidePaymentProof(9, 1, OFFICER, { status: 'APPROVED' });
    expect(mockTx.bankTransfer.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3 } }));
  });
});

describe('rejecting a proof', () => {
  it('records no payment and stores the reason', async () => {
    await decidePaymentProof(9, 1, OFFICER, { status: 'REJECTED', rejectionReason: 'Only ₦3,000 received' });

    expect(mockTx.payment.create).not.toHaveBeenCalled();
    expect(mockTx.paymentProof.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED', rejectionReason: 'Only ₦3,000 received', verifiedBy: OFFICER }) }),
    );
  });
});

describe('the guards', () => {
  const failsWith = async (code: string) => {
    const error = await decidePaymentProof(9, 1, OFFICER, { status: 'APPROVED' }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ProofDecisionError);
    expect((error as ProofDecisionError).code).toBe(code);
  };

  it('refuses a proof that does not exist', async () => {
    mockTx.paymentProof.findFirst.mockResolvedValue(null);
    await failsWith('NOT_FOUND');
  });

  it.each(['APPROVED', 'REJECTED'])('refuses a proof that was already %s — approving twice would record the payment twice', async (status) => {
    mockTx.paymentProof.findFirst.mockResolvedValue(proofRow({ status }));
    await failsWith('ALREADY_DECIDED');
    expect(mockTx.paymentProof.updateMany).not.toHaveBeenCalled();
    expect(mockTx.payment.create).not.toHaveBeenCalled();
  });

  it('loses the race cleanly when another officer decides it between the read and the claim', async () => {
    mockTx.paymentProof.updateMany.mockResolvedValue({ count: 0 });
    await failsWith('ALREADY_DECIDED');
    expect(mockTx.payment.create).not.toHaveBeenCalled();
  });

  it("won't let an officer decide a proof they submitted themselves", async () => {
    mockTx.paymentProof.findFirst.mockResolvedValue(proofRow({ member: { userId: OFFICER } }));
    await failsWith('OWN_PROOF');
    expect(mockTx.paymentProof.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to approve a proof with nothing to apply — it would record no payment', async () => {
    mockTx.paymentProof.findFirst.mockResolvedValue(proofRow({ transactionIds: [], transactionId: null, bankTransferId: null }));
    await failsWith('NOTHING_TO_APPLY');
    expect(mockTx.paymentProof.updateMany).not.toHaveBeenCalled();
  });

  it('still lets such a proof be rejected', async () => {
    mockTx.paymentProof.findFirst.mockResolvedValue(proofRow({ transactionIds: [], transactionId: null }));
    await expect(decidePaymentProof(9, 1, OFFICER, { status: 'REJECTED', rejectionReason: 'No charges listed' })).resolves.toBeTruthy();
  });
});

describe('targetTransactionIds', () => {
  it('prefers the declared list, then the single linked charge, then nothing', () => {
    expect(targetTransactionIds({ transactionIds: [1, 2], transactionId: 9 })).toEqual([1, 2]);
    expect(targetTransactionIds({ transactionIds: [], transactionId: 9 })).toEqual([9]);
    expect(targetTransactionIds({ transactionIds: [], transactionId: null })).toEqual([]);
  });
});
