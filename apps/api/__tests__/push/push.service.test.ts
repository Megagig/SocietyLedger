/**
 * F0.2 unit tests — push.service.ts, with expo-server-sdk and Prisma mocked
 * (no real network call, no real DB). node-cron is also mocked so importing
 * the module under test doesn't start a real 15-min interval during the run.
 */
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })),
}));

const mockExpoInstance = {
  chunkPushNotifications: jest.fn((messages: any[]) => [messages]),
  sendPushNotificationsAsync: jest.fn(),
  chunkPushNotificationReceiptIds: jest.fn((ids: string[]) => [ids]),
  getPushNotificationReceiptsAsync: jest.fn(),
};

jest.mock('expo-server-sdk', () => {
  const MockExpo: any = jest.fn(() => mockExpoInstance);
  MockExpo.isExpoPushToken = jest.fn(() => true);
  return { __esModule: true, default: MockExpo };
});

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    deviceToken: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/prisma';
import {
  sendPushToUsers,
  checkPushReceipts,
  __getPendingTicketsForTest,
  __resetPendingTicketsForTest,
} from '../../src/services/push.service';

const deviceTokenFindMany = prisma.deviceToken.findMany as jest.Mock;
const deviceTokenUpdateMany = prisma.deviceToken.updateMany as jest.Mock;

describe('push.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetPendingTicketsForTest();
  });

  describe('sendPushToUsers', () => {
    it('does nothing when the user list is empty', async () => {
      await sendPushToUsers([], { title: 't', body: 'b' });
      expect(deviceTokenFindMany).not.toHaveBeenCalled();
    });

    it('does nothing when no device tokens are registered', async () => {
      deviceTokenFindMany.mockResolvedValue([]);
      await sendPushToUsers([1], { title: 't', body: 'b' });
      expect(mockExpoInstance.sendPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it('sends a chunked push message for each registered, non-disabled token', async () => {
      deviceTokenFindMany.mockResolvedValue([{ expoPushToken: 'ExponentPushToken[aaa]' }]);
      mockExpoInstance.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);

      await sendPushToUsers([1], { title: 'Hello', body: 'World', data: { type: 'announcement' }, channelId: 'announcements' });

      expect(deviceTokenFindMany).toHaveBeenCalledWith({
        where: { userId: { in: [1] }, disabledAt: null },
        select: { expoPushToken: true },
      });
      expect(mockExpoInstance.sendPushNotificationsAsync).toHaveBeenCalledWith([
        expect.objectContaining({
          to: 'ExponentPushToken[aaa]',
          title: 'Hello',
          body: 'World',
          data: { type: 'announcement' },
          channelId: 'announcements',
        }),
      ]);
      // the successful ticket should be queued for the receipts job
      expect(__getPendingTicketsForTest()).toEqual([{ ticketId: 'ticket-1', expoPushToken: 'ExponentPushToken[aaa]' }]);
    });

    it('disables a token immediately when its send ticket reports DeviceNotRegistered', async () => {
      deviceTokenFindMany.mockResolvedValue([{ expoPushToken: 'ExponentPushToken[dead]' }]);
      mockExpoInstance.sendPushNotificationsAsync.mockResolvedValue([
        { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
      ]);

      await sendPushToUsers([1], { title: 't', body: 'b' });

      expect(deviceTokenUpdateMany).toHaveBeenCalledWith({
        where: { expoPushToken: 'ExponentPushToken[dead]' },
        data: { disabledAt: expect.any(Date) },
      });
      // an error ticket is never queued for a receipt check
      expect(__getPendingTicketsForTest()).toEqual([]);
    });

    it('never throws when the Expo send call itself rejects', async () => {
      deviceTokenFindMany.mockResolvedValue([{ expoPushToken: 'ExponentPushToken[aaa]' }]);
      mockExpoInstance.sendPushNotificationsAsync.mockRejectedValue(new Error('network down'));

      await expect(sendPushToUsers([1], { title: 't', body: 'b' })).resolves.toBeUndefined();
    });

    it('never throws when the device-token lookup itself rejects', async () => {
      deviceTokenFindMany.mockRejectedValue(new Error('db down'));
      await expect(sendPushToUsers([1], { title: 't', body: 'b' })).resolves.toBeUndefined();
    });
  });

  describe('checkPushReceipts', () => {
    it('does nothing when there are no pending tickets', async () => {
      await checkPushReceipts();
      expect(mockExpoInstance.getPushNotificationReceiptsAsync).not.toHaveBeenCalled();
    });

    it('disables a token whose receipt reports DeviceNotRegistered', async () => {
      deviceTokenFindMany.mockResolvedValue([{ expoPushToken: 'ExponentPushToken[aaa]' }]);
      mockExpoInstance.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);
      await sendPushToUsers([1], { title: 't', body: 'b' });
      expect(__getPendingTicketsForTest()).toHaveLength(1);

      mockExpoInstance.getPushNotificationReceiptsAsync.mockResolvedValue({
        'ticket-1': { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
      });

      await checkPushReceipts();

      expect(deviceTokenUpdateMany).toHaveBeenCalledWith({
        where: { expoPushToken: 'ExponentPushToken[aaa]' },
        data: { disabledAt: expect.any(Date) },
      });
      // the queue is drained after a check, success or failure
      expect(__getPendingTicketsForTest()).toEqual([]);
    });

    it('never throws when the receipt lookup itself rejects', async () => {
      deviceTokenFindMany.mockResolvedValue([{ expoPushToken: 'ExponentPushToken[aaa]' }]);
      mockExpoInstance.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);
      await sendPushToUsers([1], { title: 't', body: 'b' });

      mockExpoInstance.getPushNotificationReceiptsAsync.mockRejectedValue(new Error('network down'));
      await expect(checkPushReceipts()).resolves.toBeUndefined();
    });
  });
});
