/**
 * Officers who can verify proofs hear when one is waiting; the member hears how it was decided (with the reason if rejected).
 * Best-effort: a failure never reaches the request. Prisma and the dispatcher are mocked.
 */
const mockPrisma = { userRole: { findMany: jest.fn() } };
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
const mockDispatch = jest.fn();
jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: (...args: unknown[]) => mockDispatch(...args),
}));

import { notifyProofDecided, notifyProofSubmitted } from '../../src/services/payment-proof-notifications';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 11 }, { userId: 12 }]);
  mockDispatch.mockResolvedValue({});
});

describe('notifyProofSubmitted', () => {
  it('tells every officer who can verify, with the proof as the deep-link entity', async () => {
    await notifyProofSubmitted(15, { id: 9, memberUserId: 70, memberName: 'Ngozi Eze' });

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ associationId: 15, userId: 11, kind: 'approval', entityId: 9, pushType: 'payment.proof_submitted' }),
    );
    expect(JSON.stringify(mockPrisma.userRole.findMany.mock.calls[0]?.[0].where)).toContain('payments.approve');
  });

  it('never alerts the member who submitted it', async () => {
    mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 70 }, { userId: 11 }]);
    await notifyProofSubmitted(15, { id: 9, memberUserId: 70, memberName: 'Ngozi Eze' });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 70 }));
  });

  it('never throws, even when the lookup or a dispatch fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockDispatch.mockRejectedValueOnce(new Error('push down'));
    await expect(notifyProofSubmitted(15, { id: 9, memberUserId: 70, memberName: 'N' })).resolves.toBeUndefined();
    mockPrisma.userRole.findMany.mockRejectedValue(new Error('db down'));
    await expect(notifyProofSubmitted(15, { id: 9, memberUserId: 70, memberName: 'N' })).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});

describe('notifyProofDecided', () => {
  it('confirms an approval to the member', async () => {
    await notifyProofDecided(15, { id: 9, status: 'APPROVED', member: { userId: 70 } });
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ userId: 70, entityId: 9, pushType: 'payment.proof_verified' }));
  });

  it('gives the member the reason for a rejection', async () => {
    await notifyProofDecided(15, { id: 9, status: 'REJECTED', rejectionReason: 'Only ₦3,000 received', member: { userId: 70 } });
    const call = mockDispatch.mock.calls[0]?.[0];
    expect(call.pushType).toBe('payment.proof_rejected');
    expect(call.message).toContain('Only ₦3,000 received');
  });

  it('skips a member with no login and never throws', async () => {
    await notifyProofDecided(15, { id: 9, status: 'APPROVED', member: { userId: null } });
    expect(mockDispatch).not.toHaveBeenCalled();

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockDispatch.mockRejectedValue(new Error('push down'));
    await expect(notifyProofDecided(15, { id: 9, status: 'APPROVED', member: { userId: 70 } })).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});

describe('notifyTransferRecorded', () => {
  // imported lazily so the module-level mocks above apply
  const load = () => import('../../src/services/payment-proof-notifications').then((m) => m.notifyTransferRecorded);

  it('tells every officer who can verify, except the one who recorded it, with the transfer as the deep-link entity', async () => {
    mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 5 }, { userId: 11 }, { userId: 12 }]);
    const notifyTransferRecorded = await load();

    await notifyTransferRecorded(15, { id: 31, recorderUserId: 5, amount: '25000', reference: 'TRF-1' });

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ associationId: 15, userId: 11, kind: 'approval', entityId: 31, pushType: 'bank_transfer.pending' }),
    );
    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 5 }));
    expect(mockDispatch.mock.calls[0]?.[0].message).toContain('25,000.00');
    expect(mockDispatch.mock.calls[0]?.[0].message).toContain('TRF-1');
  });

  it('never throws', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockPrisma.userRole.findMany.mockRejectedValue(new Error('db down'));
    const notifyTransferRecorded = await load();
    await expect(notifyTransferRecorded(15, { id: 31, recorderUserId: 5, amount: '1', reference: 'x' })).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
