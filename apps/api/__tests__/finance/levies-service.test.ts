/**
 * The levy service keeps a levy a debt: removing a wrong assignment voids the charge and rebuilds the ledger (never a hard delete),
 * a closed campaign takes nobody new, and "all active members" assigns everyone without a chosen list.
 */
const txClient: any = {
  transaction: { update: jest.fn() },
  levyCampaignAssignment: { delete: jest.fn() },
};
const prismaMock: any = {
  levyCampaign: { findFirst: jest.fn() },
  levyCampaignAssignment: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  member: { findMany: jest.fn() },
  transaction: { count: jest.fn(), create: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(async (fn: any) => fn(txClient)),
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
const syncExistingTransactions = jest.fn();
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({
  memberLedgerService: { syncExistingTransactions: (...args: any[]) => syncExistingTransactions(...args), createFromTransaction: jest.fn() },
}));
jest.mock('../../src/services/cache-invalidation.service', () => ({ cacheInvalidationService: { onTransactionChange: jest.fn() } }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: { onTransactionCreated: jest.fn() } }));
jest.mock('../../src/modules/finance/ledger-sync', () => ({ syncLedgerDebit: jest.fn() }));

import { leviesService } from '../../src/modules/finance/advanced/levies.service';

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txClient));
});

describe('removeAssignment', () => {
  const assignment = (payments: object[]) => ({
    id: 4, memberId: 9, transactionId: 30,
    campaign: { associationId: 1, name: 'Building fund' },
    transaction: { id: 30, payments },
  });

  it('voids the charge instead of deleting it, drops the assignment and rebuilds the member ledger', async () => {
    prismaMock.levyCampaignAssignment.findFirst.mockResolvedValue(assignment([]));
    await leviesService.removeAssignment(4, 1, 77);
    const update = txClient.transaction.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 30 });
    expect(update.data).toMatchObject({ isVoided: true, voidedBy: 77 });
    expect(update.data.voidReason).toContain('Building fund');
    expect(prismaMock.transaction.delete).not.toHaveBeenCalled();
    expect(txClient.levyCampaignAssignment.delete).toHaveBeenCalledWith({ where: { id: 4 } });
    expect(syncExistingTransactions).toHaveBeenCalledWith(1, 9, 77, true);
  });

  it('is refused once the member has paid something', async () => {
    prismaMock.levyCampaignAssignment.findFirst.mockResolvedValue(assignment([{ id: 1 }]));
    await expect(leviesService.removeAssignment(4, 1, 77)).rejects.toMatchObject({ status: 409, code: 'ASSIGNMENT_HAS_PAYMENTS' });
    expect(txClient.transaction.update).not.toHaveBeenCalled();
  });

  it('cannot reach another association\'s assignment', async () => {
    prismaMock.levyCampaignAssignment.findFirst.mockResolvedValue({ ...assignment([]), campaign: { associationId: 2, name: 'x' } });
    await expect(leviesService.removeAssignment(4, 1, 77)).rejects.toMatchObject({ status: 404 });
  });
});

describe('assignToMembers', () => {
  it('refuses a closed campaign', async () => {
    prismaMock.levyCampaign.findFirst.mockResolvedValue({ id: 2, status: 'CLOSED' });
    await expect(leviesService.assignToMembers(2, 1, 77, { memberIds: [1] })).rejects.toMatchObject({ status: 409, code: 'CAMPAIGN_NOT_ACTIVE' });
  });

  it('assigns every active member when asked for all of them', async () => {
    prismaMock.levyCampaign.findFirst.mockResolvedValue({ id: 2, status: 'ACTIVE', categoryId: 5, name: 'L', deadline: new Date(), amountPerMember: { toNumber: () => 1000 } });
    prismaMock.member.findMany
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]) // everyone active
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]); // verification
    prismaMock.levyCampaignAssignment.findMany.mockResolvedValue([{ memberId: 2 }]);
    prismaMock.transaction.count.mockResolvedValue(0);
    prismaMock.transaction.create.mockImplementation(async ({ data }: any) => ({ id: 100 + data.memberId, ...data }));
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.levyCampaignAssignment.create.mockImplementation(async ({ data }: any) => data);

    const result = await leviesService.assignToMembers(2, 1, 77, { allActive: true });
    expect(result.assigned).toBe(2);
    expect(result.skipped).toBe(1);
    expect(prismaMock.member.findMany.mock.calls[0][0].where).toEqual({ associationId: 1, status: 'active' });
  });

  it('needs members from somewhere', async () => {
    prismaMock.levyCampaign.findFirst.mockResolvedValue({ id: 2, status: 'ACTIVE' });
    await expect(leviesService.assignToMembers(2, 1, 77, {})).rejects.toMatchObject({ status: 400, code: 'NO_MEMBERS' });
  });
});

describe('updateCampaign', () => {
  it('closing an active campaign changes only its status', async () => {
    const existing = { id: 2, status: 'ACTIVE', deadline: new Date('2027-01-01') };
    prismaMock.levyCampaign.findFirst.mockResolvedValue(existing);
    (prismaMock.levyCampaign as any).update = jest.fn(async ({ data }: any) => ({ ...existing, ...data }));
    await leviesService.updateCampaign(2, 1, 77, { status: 'CLOSED' });
    expect((prismaMock.levyCampaign as any).update.mock.calls[0][0].data.status).toBe('CLOSED');
    expect(prismaMock.transaction.delete).not.toHaveBeenCalled();
  });

  it('refuses to reopen a closed campaign', async () => {
    prismaMock.levyCampaign.findFirst.mockResolvedValue({ id: 2, status: 'CLOSED', deadline: new Date('2027-01-01') });
    await expect(leviesService.updateCampaign(2, 1, 77, { status: 'ACTIVE' })).rejects.toMatchObject({ status: 409 });
  });
});
