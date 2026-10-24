/**
 * "Needs your attention": a count is only returned when the officer may open that queue and its module is on, zero counts
 * are left out, and one failing count does not blank the list.
 */
const count = () => jest.fn(async () => 0);
const prismaMock: any = {
  userApproval: { count: count() },
  paymentProof: { count: count() },
  bankTransfer: { count: count() },
  cashLodgment: { count: count() },
  transaction: { count: count() },
  supportTicket: { count: count() },
  loanApplication: { count: count() },
  loanRepaymentRequest: { count: count() },
  savingsDepositRequest: { count: count() },
  welfarePayoutRequest: { count: count() },
  welfareContribution: { count: count() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../src/services/rbac.service', () => ({ RBACService: { hasAnyPermission: jest.fn() } }));
jest.mock('../../src/services/module-feature.service', () => ({ ModuleFeatureService: { isModuleEnabled: jest.fn() } }));

import { attentionService } from '../../src/modules/dashboard/attention.service';
import { RBACService } from '../../src/services/rbac.service';
import { ModuleFeatureService } from '../../src/services/module-feature.service';

const context = { userId: 5, associationId: 9, platformRole: null };
const allow = (keys: string[]) =>
  (RBACService.hasAnyPermission as jest.Mock).mockImplementation(async (_c: unknown, wanted: string[]) => wanted.some((k) => keys.includes(k)));

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(prismaMock).forEach((m: any) => m.count.mockResolvedValue(0));
  (ModuleFeatureService.isModuleEnabled as jest.Mock).mockResolvedValue(true);
});

describe('attentionService.getAttention', () => {
  it('returns nothing to an officer who may open none of the queues', async () => {
    allow([]);
    prismaMock.paymentProof.count.mockResolvedValue(4);
    expect(await attentionService.getAttention(context)).toEqual([]);
    expect(prismaMock.paymentProof.count).not.toHaveBeenCalled();
  });

  it('counts only the queues the officer may open, and leaves out empty ones', async () => {
    allow(['payments.view']);
    prismaMock.paymentProof.count.mockResolvedValue(3);
    prismaMock.bankTransfer.count.mockResolvedValue(0);
    prismaMock.userApproval.count.mockResolvedValue(8);
    expect(await attentionService.getAttention(context)).toEqual([{ key: 'paymentProofs', count: 3 }]);
    expect(prismaMock.userApproval.count).not.toHaveBeenCalled();
  });

  it('only counts work in the caller\'s own association', async () => {
    allow(['payments.view', 'members.edit_all']);
    await attentionService.getAttention(context);
    expect(prismaMock.paymentProof.count).toHaveBeenCalledWith({ where: { associationId: 9, status: 'PENDING' } });
    expect(prismaMock.userApproval.count).toHaveBeenCalledWith({ where: { approvalStatus: 'pending', user: { associationId: 9 } } });
  });

  it('leaves out the lodgments the officer made themselves', async () => {
    allow(['cash.verify']);
    await attentionService.getAttention(context);
    expect(prismaMock.cashLodgment.count).toHaveBeenCalledWith({ where: { associationId: 9, status: 'PENDING', lodgedBy: { not: 5 } } });
  });

  it('counts overdue charges from the due date, not the stored status', async () => {
    allow(['ledger.view']);
    prismaMock.transaction.count.mockResolvedValue(2);
    const items = await attentionService.getAttention(context);
    expect(items).toEqual([{ key: 'overdueCharges', count: 2 }]);
    const where = prismaMock.transaction.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ associationId: 9, isVoided: false });
    expect(where.dueDate.lt).toBeInstanceOf(Date);
  });

  it('skips cooperatives and welfare queues when those modules are off', async () => {
    allow(['payments.approve', 'ledger.create']);
    (ModuleFeatureService.isModuleEnabled as jest.Mock).mockImplementation(async (_a: number, code: string) => code !== 'cooperatives');
    prismaMock.loanApplication.count.mockResolvedValue(2);
    prismaMock.welfarePayoutRequest.count.mockResolvedValue(1);
    expect(await attentionService.getAttention(context)).toEqual([{ key: 'welfarePayouts', count: 1 }]);
    expect(prismaMock.loanApplication.count).not.toHaveBeenCalled();
  });

  it('keeps the other counts when one fails', async () => {
    allow(['payments.view']);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    prismaMock.paymentProof.count.mockRejectedValue(new Error('db down'));
    prismaMock.bankTransfer.count.mockResolvedValue(1);
    expect(await attentionService.getAttention(context)).toEqual([{ key: 'bankTransfers', count: 1 }]);
  });
});
