/**
 * Officers who can approve a savings deposit, loan repayment or loan application are told when a member submits one.
 * Best-effort: a failure never reaches the member's request. Prisma and the dispatcher are mocked.
 */
const mockPrisma = {
  member: { findUnique: jest.fn() },
  userRole: { findMany: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: {} }));
const mockDispatch = jest.fn();
jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: (...args: unknown[]) => mockDispatch(...args),
}));

import { cooperativesService } from '../../src/modules/cooperatives/cooperatives.service';

const alert = {
  memberId: 4,
  entityId: 9,
  pushType: 'savings.deposit_submitted',
  title: 'Savings deposit awaiting confirmation',
  what: (name: string) => `${name} submitted a deposit.`,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.member.findUnique.mockResolvedValue({ userId: 30, firstName: 'Ada', lastName: 'Obi' });
  mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 11 }, { userId: 12 }, { userId: 30 }]);
  mockDispatch.mockResolvedValue({});
});

describe('notifyApprovers', () => {
  it('alerts every approver except the member who submitted, with a deep-link type', async () => {
    await cooperativesService.notifyApprovers(15, ['ledger.create'], alert);

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ associationId: 15, userId: 11, kind: 'approval', entityId: 9, pushType: 'savings.deposit_submitted', message: 'Ada Obi submitted a deposit.' })
    );
    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 30 }));
    expect(mockPrisma.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ associationId: 15, isActive: true }) })
    );
  });

  it('keeps going when one alert fails, and never throws', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockDispatch.mockRejectedValueOnce(new Error('push down'));

    await expect(cooperativesService.notifyApprovers(15, ['ledger.create'], alert)).resolves.toBeUndefined();
    expect(mockDispatch).toHaveBeenCalledTimes(2);

    mockPrisma.userRole.findMany.mockRejectedValue(new Error('db down'));
    await expect(cooperativesService.notifyApprovers(15, ['ledger.create'], alert)).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
