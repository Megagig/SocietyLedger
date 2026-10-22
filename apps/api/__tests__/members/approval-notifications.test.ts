/**
 * Approvers are told when someone registers and is waiting for approval. Best-effort: a failure never reaches the registration.
 * Prisma and the dispatcher are mocked.
 */
const mockPrisma = { userRole: { findMany: jest.fn() } };
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
const mockDispatch = jest.fn();
jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: (...args: unknown[]) => mockDispatch(...args),
}));

import { notifyApprovalPending } from '../../src/services/approval-notifications';
import { isMemberDisabled } from '../../src/lib/member-access';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 11 }, { userId: 12 }]);
  mockDispatch.mockResolvedValue({});
});

describe('notifyApprovalPending', () => {
  it('tells every approver, with the deep-link type and the registrant as the entity', async () => {
    await notifyApprovalPending(15, { userId: 90, name: 'Ngozi Eze' });

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ associationId: 15, userId: 11, kind: 'approval', entityId: 90, pushType: 'user.approval_pending' }),
    );
    expect(mockDispatch.mock.calls[0]?.[0].message).toContain('Ngozi Eze');
  });

  it('looks for active holders of the approve key in this association only', async () => {
    await notifyApprovalPending(15, { userId: 90, name: 'Ngozi Eze' });

    const where = mockPrisma.userRole.findMany.mock.calls[0]?.[0].where;
    expect(where).toMatchObject({ associationId: 15, isActive: true });
    expect(JSON.stringify(where)).toContain('members.edit_all');
  });

  it('never alerts the registrant themselves', async () => {
    mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 90 }, { userId: 11 }]);
    await notifyApprovalPending(15, { userId: 90, name: 'Ngozi Eze' });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 90 }));
  });

  it('keeps going when one alert fails, and never throws', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockDispatch.mockRejectedValueOnce(new Error('push down'));
    await expect(notifyApprovalPending(15, { userId: 90, name: 'Ngozi Eze' })).resolves.toBeUndefined();
    expect(mockDispatch).toHaveBeenCalledTimes(2);

    mockPrisma.userRole.findMany.mockRejectedValue(new Error('db down'));
    await expect(notifyApprovalPending(15, { userId: 90, name: 'Ngozi Eze' })).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});

describe('isMemberDisabled', () => {
  it('blocks terminated members only', () => {
    expect(isMemberDisabled('terminated')).toBe(true);
    expect(isMemberDisabled('suspended')).toBe(false);
    expect(isMemberDisabled('inactive')).toBe(false);
    expect(isMemberDisabled('active')).toBe(false);
    expect(isMemberDisabled(undefined)).toBe(false);
  });
});
