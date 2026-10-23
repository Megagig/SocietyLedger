/**
 * A bank transfer is a record of money that reached the account. These cover the rules that matter: what it links to must belong to
 * this association, a reference can't repeat (ignoring case and spaces), editing can't set the status or reach a transfer that was
 * already decided, and verifying or rejecting happens once. Prisma is mocked.
 */
const mockPrisma = {
  associationBankAccount: { findFirst: jest.fn() },
  member: { findFirst: jest.fn() },
  transaction: { findFirst: jest.fn() },
  bankTransfer: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn(), findMany: jest.fn(), count: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: {} }));
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({ memberLedgerService: {} }));

import { BankRuleError } from '../../src/modules/nigerian-payments/bank-rules';
import { nigerianPaymentsService as service } from '../../src/modules/nigerian-payments/nigerian-payments.service';
import { updateBankTransferSchema } from '../../src/modules/nigerian-payments/nigerian-payments.validation';

const base = {
  senderBankName: 'Access Bank',
  amount: 25000,
  reference: 'TRF-2026-001',
  transferDate: '2026-10-20T09:00:00.000Z',
};

const codeOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BankRuleError);
  return (error as BankRuleError).code;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.associationBankAccount.findFirst.mockResolvedValue({ id: 4, isActive: true });
  mockPrisma.member.findFirst.mockResolvedValue({ id: 40 });
  mockPrisma.transaction.findFirst.mockResolvedValue({ id: 100, memberId: 40 });
  mockPrisma.bankTransfer.findFirst.mockResolvedValue(null);
  mockPrisma.bankTransfer.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 9, ...data }));
});

describe('recording a transfer', () => {
  it('saves it as pending, with the reference trimmed', async () => {
    await service.createBankTransfer(1, { ...base, reference: '  TRF-2026-001 ', bankAccountId: 4, memberId: 40 } as never);

    expect(mockPrisma.bankTransfer.create.mock.calls[0]?.[0].data).toMatchObject({ associationId: 1, status: 'PENDING', reference: 'TRF-2026-001' });
  });

  it('checks the links against this association only', async () => {
    await service.createBankTransfer(1, { ...base, bankAccountId: 4, memberId: 40, transactionId: 100 } as never);

    expect(mockPrisma.associationBankAccount.findFirst.mock.calls[0]?.[0].where).toMatchObject({ id: 4, associationId: 1 });
    expect(mockPrisma.member.findFirst.mock.calls[0]?.[0].where).toMatchObject({ id: 40, associationId: 1 });
    expect(mockPrisma.transaction.findFirst.mock.calls[0]?.[0].where).toMatchObject({ id: 100, associationId: 1 });
  });

  it.each([
    ['receiving account', () => mockPrisma.associationBankAccount.findFirst.mockResolvedValue(null), { bankAccountId: 4 }],
    ['member', () => mockPrisma.member.findFirst.mockResolvedValue(null), { memberId: 40 }],
    ['charge', () => mockPrisma.transaction.findFirst.mockResolvedValue(null), { transactionId: 100 }],
  ])('refuses a %s that is not in this association', async (_name, arrange, links) => {
    arrange();
    expect(await codeOf(service.createBankTransfer(1, { ...base, ...links } as never))).toBe('INVALID_LINK');
    expect(mockPrisma.bankTransfer.create).not.toHaveBeenCalled();
  });

  it('refuses an inactive receiving account', async () => {
    mockPrisma.associationBankAccount.findFirst.mockResolvedValue({ id: 4, isActive: false });
    expect(await codeOf(service.createBankTransfer(1, { ...base, bankAccountId: 4 } as never))).toBe('INVALID_LINK');
  });

  it("refuses a charge that belongs to a different member than the one named", async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: 100, memberId: 77 });
    expect(await codeOf(service.createBankTransfer(1, { ...base, memberId: 40, transactionId: 100 } as never))).toBe('INVALID_LINK');
  });

  it('refuses a reference that is already used, ignoring case and spaces', async () => {
    mockPrisma.bankTransfer.findFirst.mockResolvedValue({ id: 3 });

    expect(await codeOf(service.createBankTransfer(1, { ...base, reference: ' trf-2026-001 ' } as never))).toBe('DUPLICATE_REFERENCE');
    expect(mockPrisma.bankTransfer.findFirst.mock.calls[0]?.[0].where.reference).toEqual({ equals: 'trf-2026-001', mode: 'insensitive' });
  });
});

describe('editing a transfer', () => {
  it('can never set the status — that is only for the verify endpoint', () => {
    const parsed = updateBankTransferSchema.parse({ status: 'VERIFIED', notes: 'sneaky', amount: 500 });
    expect(parsed).not.toHaveProperty('status');
    expect(parsed).toMatchObject({ notes: 'sneaky', amount: 500 });
  });

  it('only lands on a transfer that is still pending', async () => {
    mockPrisma.bankTransfer.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.bankTransfer.findUniqueOrThrow.mockResolvedValue({ id: 9 });

    await service.updateBankTransfer(9, 1, { notes: 'checked' } as never);

    expect(mockPrisma.bankTransfer.updateMany.mock.calls[0]?.[0].where).toEqual({ id: 9, associationId: 1, status: 'PENDING' });
  });

  it('is refused once the transfer was verified, rejected or matched', async () => {
    mockPrisma.bankTransfer.updateMany.mockResolvedValue({ count: 0 });
    expect(await codeOf(service.updateBankTransfer(9, 1, { notes: 'late' } as never))).toBe('ALREADY_DECIDED');
  });

  it('lets a transfer keep its own reference but not take another transfer’s', async () => {
    mockPrisma.bankTransfer.findFirst.mockResolvedValue({ id: 3 });
    expect(await codeOf(service.updateBankTransfer(9, 1, { reference: 'TRF-OTHER' } as never))).toBe('DUPLICATE_REFERENCE');
    expect(mockPrisma.bankTransfer.findFirst.mock.calls[0]?.[0].where.id).toEqual({ not: 9 });
  });
});

describe('verifying or rejecting a transfer', () => {
  it('claims a pending transfer and stamps who decided it', async () => {
    mockPrisma.bankTransfer.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.bankTransfer.findUniqueOrThrow.mockResolvedValue({ id: 9, status: 'VERIFIED' });

    await service.verifyBankTransfer(9, 1, 5, 'VERIFIED', 'On the statement');

    const call = mockPrisma.bankTransfer.updateMany.mock.calls[0]?.[0];
    expect(call.where).toEqual({ id: 9, associationId: 1, status: 'PENDING' });
    expect(call.data).toMatchObject({ status: 'VERIFIED', verifiedBy: 5, notes: 'On the statement' });
  });

  it.each(['VERIFIED', 'REJECTED', 'MATCHED'])('refuses a transfer that is already %s, and says so', async (status) => {
    mockPrisma.bankTransfer.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.bankTransfer.findFirst.mockResolvedValue({ status });

    const error = await service.verifyBankTransfer(9, 1, 5, 'VERIFIED').then(
      () => null,
      (e: unknown) => e,
    );

    expect((error as BankRuleError).code).toBe('ALREADY_DECIDED');
    expect((error as BankRuleError).message).toContain(status.toLowerCase());
  });

  it("404s a transfer of another association", async () => {
    mockPrisma.bankTransfer.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.bankTransfer.findFirst.mockResolvedValue(null);
    expect(await codeOf(service.verifyBankTransfer(9, 1, 5, 'VERIFIED'))).toBe('NOT_FOUND');
  });
});

describe('listing transfers', () => {
  it('hides the storage key of linked proofs', async () => {
    mockPrisma.bankTransfer.findMany.mockResolvedValue([
      { id: 9, paymentProofs: [{ id: 1, filename: 'r.png', filepath: 'payment-proofs/1/r.png', status: 'PENDING', uploadedAt: new Date() }] },
    ]);
    mockPrisma.bankTransfer.count.mockResolvedValue(1);

    const { transfers } = await service.getBankTransfers(1, { page: 1, limit: 20 });

    expect(JSON.stringify(transfers)).not.toContain('payment-proofs/1/r.png');
    expect(transfers[0]?.paymentProofs[0]).toMatchObject({ id: 1, hasFile: true });
  });
});
