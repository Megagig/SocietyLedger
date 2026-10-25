/** Journal entries waiting for the signed-in officer: to approve (never their own) and approved ones still to post. */
const prismaMock: any = { journalEntry: { count: jest.fn() }, expenseVoucher: { count: jest.fn() } };
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }));
jest.mock('../../src/services/rbac.service', () => ({ RBACService: { hasAnyPermission: jest.fn() } }));
jest.mock('../../src/services/module-feature.service', () => ({ ModuleFeatureService: { isModuleEnabled: jest.fn() } }));

import { ATTENTION_SOURCES } from '../../src/modules/dashboard/attention.service';

const source = () => ATTENTION_SOURCES.find((s) => s.key === 'journalEntries')!;

describe('the journal entries attention count', () => {
  it('needs the approve permission and the accounting module', () => {
    expect(source().permissions).toEqual(['payments.approve']);
    expect(source().module).toBe('accounting');
  });

  it('counts pending entries written by someone else, and approved entries to post', async () => {
    prismaMock.journalEntry.count.mockResolvedValue(3);
    expect(await source().count({ associationId: 7, userId: 9 })).toBe(3);
    expect(prismaMock.journalEntry.count).toHaveBeenCalledWith({
      where: { associationId: 7, OR: [{ status: 'PENDING_APPROVAL', createdBy: { not: 9 } }, { status: 'APPROVED' }] },
    });
  });
});

describe('the expenses attention count', () => {
  const expenses = () => ATTENTION_SOURCES.find((s) => s.key === 'expenses')!;

  it('needs the approve permission and the accounting module', () => {
    expect(expenses().permissions).toEqual(['payments.approve']);
    expect(expenses().module).toBe('accounting');
  });

  it('counts vouchers waiting for approval that someone else recorded', async () => {
    prismaMock.expenseVoucher.count.mockResolvedValue(2);
    expect(await expenses().count({ associationId: 7, userId: 9 })).toBe(2);
    expect(prismaMock.expenseVoucher.count).toHaveBeenCalledWith({ where: { associationId: 7, status: 'PENDING_APPROVAL', createdBy: { not: 9 } } });
  });
});
