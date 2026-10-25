/**
 * The welfare money paths: a contribution adds to a fund once, a payout leaves it once and never below zero, nobody decides their own
 * money, and the recorder can't confirm. Prisma is mocked.
 */
import { Decimal } from '@prisma/client/runtime/library';

const tx: any = {
  welfareContribution: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  welfareFund: { update: jest.fn(), updateMany: jest.fn() },
  welfarePayoutRequest: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
};
const mockPrisma: any = {
  welfareFund: { findFirst: jest.fn() },
  welfareContribution: { findFirst: jest.fn(), create: jest.fn() },
  welfarePayoutRequest: { findFirst: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn(), count: jest.fn(), create: jest.fn() },
  member: { findFirst: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
const onConfirmed = jest.fn();
const onDisbursed = jest.fn();
jest.mock('../../src/services/accounting-integration.service', () => ({
  accountingIntegrationService: { onWelfareContributionConfirmed: (...a: any[]) => onConfirmed(...a), onWelfarePayoutDisbursed: (...a: any[]) => onDisbursed(...a) },
}));

import { welfareService } from '../../src/modules/welfare/welfare.service';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg)));
});

describe('confirmContribution', () => {
  const pending = (over: object = {}) => ({
    id: 5, fundId: 2, memberId: 3, amount: new Decimal(10000), notes: null, status: 'PENDING', recordedBy: 50, fund: { id: 2, name: 'Medical' },
    member: { userId: 30 }, ...over,
  });

  it('confirming adds the amount to the fund once, in the same step it is claimed', async () => {
    mockPrisma.welfareContribution.findFirst.mockResolvedValue(pending());
    tx.welfareContribution.updateMany.mockResolvedValue({ count: 1 });
    tx.welfareContribution.findUniqueOrThrow.mockResolvedValue({ id: 5, fund: { id: 2, name: 'Medical' } });
    await welfareService.confirmContribution(1, 5, 99, 'CONFIRMED');
    expect(tx.welfareContribution.updateMany.mock.calls[0][0].where).toMatchObject({ id: 5, status: 'PENDING' });
    expect(tx.welfareFund.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { currentBalance: { increment: new Decimal(10000) } } });
    expect(onConfirmed).toHaveBeenCalled();
  });

  it('a second confirmation finds it already decided and adds nothing', async () => {
    mockPrisma.welfareContribution.findFirst.mockResolvedValue(pending());
    tx.welfareContribution.updateMany.mockResolvedValue({ count: 0 });
    await expect(welfareService.confirmContribution(1, 5, 99, 'CONFIRMED')).rejects.toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
    expect(tx.welfareFund.update).not.toHaveBeenCalled();
  });

  it('rejecting changes nothing in the fund', async () => {
    mockPrisma.welfareContribution.findFirst.mockResolvedValue(pending());
    tx.welfareContribution.updateMany.mockResolvedValue({ count: 1 });
    tx.welfareContribution.findUniqueOrThrow.mockResolvedValue({ id: 5 });
    await welfareService.confirmContribution(1, 5, 99, 'REJECTED', 'Not received');
    expect(tx.welfareFund.update).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('the officer who recorded it cannot confirm it, nor can the member it is in the name of', async () => {
    mockPrisma.welfareContribution.findFirst.mockResolvedValue(pending({ recordedBy: 99 }));
    await expect(welfareService.confirmContribution(1, 5, 99, 'CONFIRMED')).rejects.toMatchObject({ status: 403, code: 'OWN_RECORDING' });
    mockPrisma.welfareContribution.findFirst.mockResolvedValue(pending({ member: { userId: 99 } }));
    await expect(welfareService.confirmContribution(1, 5, 99, 'CONFIRMED')).rejects.toMatchObject({ status: 403, code: 'OWN_REQUEST' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('an older contribution with no recorder can be confirmed by any allowed officer', async () => {
    mockPrisma.welfareContribution.findFirst.mockResolvedValue(pending({ recordedBy: null }));
    tx.welfareContribution.updateMany.mockResolvedValue({ count: 1 });
    tx.welfareContribution.findUniqueOrThrow.mockResolvedValue({ id: 5, fund: { id: 2, name: 'Medical' } });
    await expect(welfareService.confirmContribution(1, 5, 99, 'CONFIRMED')).resolves.toBeDefined();
  });
});

describe('recording contributions', () => {
  const fund = { id: 2, status: 'ACTIVE', minContribution: new Decimal(1000) };

  it('remembers who recorded it, and refuses an inactive member or an amount below the minimum', async () => {
    mockPrisma.welfareFund.findFirst.mockResolvedValue(fund);
    mockPrisma.member.findFirst.mockResolvedValue({ id: 3, status: 'active' });
    mockPrisma.welfareContribution.create.mockResolvedValue({ id: 1 });
    await welfareService.recordContribution(1, 99, { fundId: 2, memberId: 3, amount: 5000 } as any);
    expect(mockPrisma.welfareContribution.create.mock.calls[0][0].data).toMatchObject({ recordedBy: 99, status: 'PENDING' });

    mockPrisma.member.findFirst.mockResolvedValue({ id: 3, status: 'suspended' });
    await expect(welfareService.recordContribution(1, 99, { fundId: 2, memberId: 3, amount: 5000 } as any)).rejects.toMatchObject({ code: 'MEMBER_NOT_ACTIVE' });
    mockPrisma.member.findFirst.mockResolvedValue({ id: 3, status: 'active' });
    await expect(welfareService.recordContribution(1, 99, { fundId: 2, memberId: 3, amount: 500 } as any)).rejects.toMatchObject({ code: 'BELOW_MINIMUM' });
  });

  it('a fund that is missing or not active is a 404 with a plain message', async () => {
    mockPrisma.welfareFund.findFirst.mockResolvedValue(null);
    await expect(welfareService.recordContribution(1, 99, { fundId: 2, memberId: 3, amount: 5000 } as any)).rejects.toMatchObject({ status: 404, code: 'FUND_NOT_ACTIVE' });
  });

  it('in bulk, the same member twice is one contribution, each stamped with the recorder', async () => {
    mockPrisma.welfareFund.findFirst.mockResolvedValue(fund);
    mockPrisma.member.findMany.mockResolvedValue([{ id: 3, status: 'active' }, { id: 4, status: 'active' }]);
    mockPrisma.welfareContribution.create.mockImplementation(async ({ data }: any) => data);
    const result = await welfareService.bulkRecordContributions(1, 99, { fundId: 2, memberIds: [3, 4, 3], amount: 2000 } as any);
    expect(result.count).toBe(2);
    expect(mockPrisma.member.findMany.mock.calls[0][0].where.id).toEqual({ in: [3, 4] });
    expect(mockPrisma.welfareContribution.create.mock.calls.every((c: any) => c[0].data.recordedBy === 99)).toBe(true);
  });

  it('in bulk, one inactive member stops the whole batch', async () => {
    mockPrisma.welfareFund.findFirst.mockResolvedValue(fund);
    mockPrisma.member.findMany.mockResolvedValue([{ id: 3, status: 'active' }, { id: 4, status: 'terminated' }]);
    await expect(welfareService.bulkRecordContributions(1, 99, { fundId: 2, memberIds: [3, 4], amount: 2000 } as any)).rejects.toMatchObject({ code: 'MEMBER_NOT_ACTIVE' });
    expect(mockPrisma.welfareContribution.create).not.toHaveBeenCalled();
  });
});

describe('reviewPayoutRequest', () => {
  const waiting = (over: object = {}) => ({
    id: 8, fundId: 2, memberId: 3, status: 'PENDING', amount: new Decimal(50000),
    fund: { maxPayout: new Decimal(100000), currentBalance: new Decimal(80000) }, member: { userId: 30 }, ...over,
  });

  it('nobody reviews their own request', async () => {
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(waiting({ member: { userId: 99 } }));
    await expect(welfareService.reviewPayoutRequest(1, 8, 99, { status: 'APPROVED' } as any)).rejects.toMatchObject({ status: 403, code: 'OWN_REQUEST' });
    expect(mockPrisma.welfarePayoutRequest.updateMany).not.toHaveBeenCalled();
  });

  it('an approval can be lower than asked but never higher, and never more than the fund holds', async () => {
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(waiting());
    await expect(welfareService.reviewPayoutRequest(1, 8, 99, { status: 'APPROVED', approvedAmount: 60000 } as any)).rejects.toMatchObject({ code: 'APPROVAL_TOO_LARGE' });
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(waiting({ fund: { maxPayout: null, currentBalance: new Decimal(10000) } }));
    await expect(welfareService.reviewPayoutRequest(1, 8, 99, { status: 'APPROVED' } as any)).rejects.toMatchObject({ code: 'FUND_INSUFFICIENT' });
    expect(mockPrisma.welfarePayoutRequest.updateMany).not.toHaveBeenCalled();
  });

  it('approving claims the request while it is still waiting; two decisions at once cannot both win', async () => {
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(waiting());
    mockPrisma.welfarePayoutRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(welfareService.reviewPayoutRequest(1, 8, 99, { status: 'APPROVED', approvedAmount: 30000 } as any)).rejects.toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
    expect(mockPrisma.welfarePayoutRequest.updateMany.mock.calls[0][0].where.status).toEqual({ in: ['PENDING', 'UNDER_REVIEW'] });
  });

  it('a request that is already decided cannot be reviewed again', async () => {
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(waiting({ status: 'APPROVED' }));
    await expect(welfareService.reviewPayoutRequest(1, 8, 99, { status: 'REJECTED', rejectionReason: 'No' } as any)).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
  });
});

describe('disbursePayoutRequest', () => {
  const approved = (over: object = {}) => ({
    id: 8, fundId: 2, memberId: 3, status: 'APPROVED', approvedAmount: new Decimal(30000), fund: { id: 2, name: 'Medical' }, member: { userId: 30 }, ...over,
  });
  const input = { disbursementMethod: 'cash' } as any;

  it('refuses one already paid out, one not approved, and the officer\'s own', async () => {
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(approved({ status: 'DISBURSED' }));
    await expect(welfareService.disbursePayoutRequest(1, 8, 99, input)).rejects.toMatchObject({ status: 409, code: 'ALREADY_DISBURSED' });
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(approved({ status: 'PENDING' }));
    await expect(welfareService.disbursePayoutRequest(1, 8, 99, input)).rejects.toMatchObject({ code: 'NOT_APPROVED' });
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(approved({ member: { userId: 99 } }));
    await expect(welfareService.disbursePayoutRequest(1, 8, 99, input)).rejects.toMatchObject({ code: 'OWN_REQUEST' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('takes the money out in one conditional step, only if the fund still holds it', async () => {
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(approved());
    tx.welfarePayoutRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.welfareFund.updateMany.mockResolvedValue({ count: 1 });
    tx.welfarePayoutRequest.findUniqueOrThrow.mockResolvedValue({ id: 8, fund: { id: 2, name: 'Medical' } });
    await welfareService.disbursePayoutRequest(1, 8, 99, input);
    expect(tx.welfarePayoutRequest.updateMany.mock.calls[0][0].where).toMatchObject({ id: 8, status: 'APPROVED' });
    const take = tx.welfareFund.updateMany.mock.calls[0][0];
    expect(take.where).toEqual({ id: 2, currentBalance: { gte: new Decimal(30000) } });
    expect(take.data).toEqual({ currentBalance: { decrement: new Decimal(30000) } });
    expect(onDisbursed).toHaveBeenCalled();
  });

  it('two disbursements at once cannot both win: the second finds it already claimed', async () => {
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(approved());
    tx.welfarePayoutRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(welfareService.disbursePayoutRequest(1, 8, 99, input)).rejects.toMatchObject({ code: 'ALREADY_DISBURSED' });
    expect(tx.welfareFund.updateMany).not.toHaveBeenCalled();
  });

  it('if the fund no longer holds enough, nothing is paid out (the claim is rolled back with the transaction)', async () => {
    mockPrisma.welfarePayoutRequest.findFirst.mockResolvedValue(approved());
    tx.welfarePayoutRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.welfareFund.updateMany.mockResolvedValue({ count: 0 });
    await expect(welfareService.disbursePayoutRequest(1, 8, 99, input)).rejects.toMatchObject({ status: 409, code: 'FUND_INSUFFICIENT' });
    expect(onDisbursed).not.toHaveBeenCalled();
  });
});

describe('createPayoutRequest', () => {
  it('only an active member can ask for a payout', async () => {
    mockPrisma.welfareFund.findFirst.mockResolvedValue({ id: 2, maxPayout: null, currentBalance: new Decimal(100000) });
    mockPrisma.member.findFirst.mockResolvedValue({ status: 'suspended' });
    await expect(
      welfareService.createPayoutRequest(1, 3, { fundId: 2, payoutType: 'MEDICAL', amount: 1000, reason: 'Hospital bill for surgery' } as any),
    ).rejects.toMatchObject({ code: 'MEMBER_NOT_ACTIVE' });
  });
});
