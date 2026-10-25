/**
 * A recorded donation reaches the member's ledger (once the money is received), the books and the caches, and is validated.
 */
const prismaMock: any = {
  member: { findFirst: jest.fn() },
  financialCategory: { findFirst: jest.fn() },
  donationAllocation: { findFirst: jest.fn() },
  donationRecord: { count: jest.fn() },
  transaction: { findUnique: jest.fn() },
  payment: { findUnique: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
const createFromPayment = jest.fn();
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({
  memberLedgerService: { createFromPayment: (...a: any[]) => createFromPayment(...a) },
}));
const onPaymentRecorded = jest.fn();
const onTransactionCreated = jest.fn();
jest.mock('../../src/services/accounting-integration.service', () => ({
  accountingIntegrationService: { onPaymentRecorded: (...a: any[]) => onPaymentRecorded(...a), onTransactionCreated: (...a: any[]) => onTransactionCreated(...a) },
}));
const onTransactionChange = jest.fn();
const onPaymentChange = jest.fn();
jest.mock('../../src/services/cache-invalidation.service', () => ({
  cacheInvalidationService: { onTransactionChange: (...a: any[]) => onTransactionChange(...a), onPaymentChange: (...a: any[]) => onPaymentChange(...a) },
}));

import { donationsService } from '../../src/modules/finance/advanced/donations.service';

const member = (over: object = {}) => ({ id: 3, memberId: 'M3', firstName: 'Ada', lastName: 'Obi', email: null, status: 'active', ...over });

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.member.findFirst.mockResolvedValue(member());
  prismaMock.financialCategory.findFirst.mockResolvedValue({ id: 8, name: 'Building fund' });
  prismaMock.donationAllocation.findFirst.mockResolvedValue({ id: 2 });
  prismaMock.donationRecord.count.mockResolvedValue(0);
  prismaMock.transaction.findUnique.mockResolvedValue({ id: 70 });
  prismaMock.payment.findUnique.mockResolvedValue({ id: 80 });
  prismaMock.$transaction.mockImplementation(async () => ({
    transaction: { id: 70 }, payment: { id: 80 }, donationRecord: { id: 5 },
  }));
});

const base = { memberId: 3, categoryId: 8, amount: 5000 };

describe('recordDonation', () => {
  it('an instant donation credits the member ledger, syncs the books and clears the caches', async () => {
    await donationsService.recordDonation(1, 99, { ...base, donationType: 'instant' });
    expect(createFromPayment).toHaveBeenCalledWith(80, 99);
    expect(onTransactionCreated).toHaveBeenCalled();
    expect(onPaymentRecorded).toHaveBeenCalled();
    expect(onTransactionChange).toHaveBeenCalledWith(1);
    expect(onPaymentChange).toHaveBeenCalledWith(1);
  });

  it('a pledge has no payment yet, so nothing is credited until it is paid', async () => {
    prismaMock.$transaction.mockImplementation(async () => ({ transaction: { id: 70 }, payment: null, donationRecord: { id: 5 } }));
    await donationsService.recordDonation(1, 99, { ...base, donationType: 'pledge', pledgeDate: new Date(Date.now() + 86_400_000 * 10).toISOString() });
    expect(createFromPayment).not.toHaveBeenCalled();
    expect(onPaymentRecorded).not.toHaveBeenCalled();
    expect(onTransactionChange).toHaveBeenCalledWith(1);
  });

  it('refuses an inactive donor, a zero amount and a pledge dated in the past, and records nothing', async () => {
    prismaMock.member.findFirst.mockResolvedValue(member({ status: 'suspended' }));
    await expect(donationsService.recordDonation(1, 99, base)).rejects.toMatchObject({ status: 409, code: 'MEMBER_NOT_ACTIVE' });
    prismaMock.member.findFirst.mockResolvedValue(member());
    await expect(donationsService.recordDonation(1, 99, { ...base, amount: 0 })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    await expect(donationsService.recordDonation(1, 99, { ...base, donationType: 'pledge', pledgeDate: '2020-01-01' })).rejects.toMatchObject({ code: 'PLEDGE_DATE_IN_PAST' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('says plainly when the cause or the fund is missing or switched off', async () => {
    prismaMock.financialCategory.findFirst.mockResolvedValue(null);
    await expect(donationsService.recordDonation(1, 99, base)).rejects.toMatchObject({ status: 404, code: 'CAUSE_NOT_FOUND' });
    prismaMock.financialCategory.findFirst.mockResolvedValue({ id: 8, name: 'Building fund' });
    prismaMock.donationAllocation.findFirst.mockResolvedValue(null);
    await expect(donationsService.recordDonation(1, 99, { ...base, allocationId: 2 })).rejects.toMatchObject({ status: 404, code: 'ALLOCATION_NOT_FOUND' });
  });

  it('a ledger or accounting problem never undoes a recorded donation', async () => {
    createFromPayment.mockRejectedValueOnce(new Error('ledger down'));
    onPaymentRecorded.mockRejectedValueOnce(new Error('books down'));
    const result = await donationsService.recordDonation(1, 99, { ...base, donationType: 'instant' });
    expect(result.donationRecord).toEqual({ id: 5 });
  });
});
