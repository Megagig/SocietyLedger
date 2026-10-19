/**
 * F0.2 unit tests — notification-preferences.service.ts's dispatchNotification
 * and filterPushEligible, focused on the new push behavior added this
 * feature. Prisma, email, SMS and push.service are all mocked; no real DB
 * or network call. R3.6's pre-existing in-app/email/SMS gating behavior is
 * exercised too, specifically to confirm it is unchanged by this feature
 * (the "no regression" requirement for this change).
 */
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    notification: { create: jest.fn() },
    notificationPreference: { findUnique: jest.fn(), upsert: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    member: { findFirst: jest.fn() },
  },
}));
jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn() }));
jest.mock('../../src/modules/sms/sms.service', () => ({
  SMSService: jest.fn().mockImplementation(() => ({ sendQuickSMS: jest.fn() })),
}));
jest.mock('../../src/services/push.service', () => ({ sendPushToUsers: jest.fn() }));

import { prisma } from '../../src/lib/prisma';
import { sendPushToUsers } from '../../src/services/push.service';
import { dispatchNotification, filterPushEligible } from '../../src/services/notification-preferences.service';

const notificationCreate = prisma.notification.create as jest.Mock;
const preferenceFindUnique = prisma.notificationPreference.findUnique as jest.Mock;
const preferenceFindMany = prisma.notificationPreference.findMany as jest.Mock;
const sendPushMock = sendPushToUsers as jest.Mock;

describe('dispatchNotification (F0.2 push additions)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationCreate.mockResolvedValue({});
  });

  it('creates the in-app row and sends push when the recipient has no preference row (defaults apply)', async () => {
    preferenceFindUnique.mockResolvedValue(null); // no row -> DEFAULTS, pushEnabled: true

    const result = await dispatchNotification({
      associationId: 1,
      userId: 10,
      title: 'Payment received',
      message: 'Thanks',
      kind: 'payment_received',
      entityId: 555,
    });

    expect(result.inAppCreated).toBe(true);
    expect(notificationCreate).toHaveBeenCalledWith({
      data: { associationId: 1, userId: 10, title: 'Payment received', message: 'Thanks', type: 'payment_received', entityId: 555 },
    });
    expect(sendPushMock).toHaveBeenCalledWith([10], {
      title: 'Payment received',
      body: 'Thanks',
      data: { type: 'payment.received', entityId: 555 },
      channelId: 'payments',
    });
  });

  it('respects an explicit pushType override without changing the stored type', async () => {
    preferenceFindUnique.mockResolvedValue(null);

    await dispatchNotification({
      associationId: 1,
      userId: 10,
      title: 'Meeting reminder',
      message: '...',
      kind: 'announcement',
      entityId: 7,
      pushType: 'meeting.reminder',
    });

    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'announcement' }) })
    );
    expect(sendPushMock).toHaveBeenCalledWith(
      [10],
      expect.objectContaining({ data: { type: 'meeting.reminder', entityId: 7 } })
    );
  });

  it('[pre-existing R3.6 behavior, unchanged] does not create the in-app row when the recipient disabled in-app for this kind', async () => {
    preferenceFindUnique.mockResolvedValue({
      associationId: 1, userId: 10, emailEnabled: true, smsEnabled: false, inAppEnabled: true, pushEnabled: true,
      paymentDueEmail: true, paymentDueSMS: false, paymentDueInApp: true,
      paymentReceivedEmail: true, paymentReceivedSMS: false, paymentReceivedInApp: false, // <- disabled for this kind
      systemEmail: true, systemSMS: false, systemInApp: true,
      approvalEmail: true, approvalSMS: false, approvalInApp: true,
      announcementEmail: true, announcementSMS: false, announcementInApp: true,
    });

    const result = await dispatchNotification({
      associationId: 1, userId: 10, title: 't', message: 'm', kind: 'payment_received',
    });

    expect(result.inAppCreated).toBe(false);
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it('still creates the in-app row but skips push when the recipient turned push off specifically', async () => {
    preferenceFindUnique.mockResolvedValue({
      associationId: 1, userId: 10, emailEnabled: true, smsEnabled: false, inAppEnabled: true, pushEnabled: false,
      paymentDueEmail: true, paymentDueSMS: false, paymentDueInApp: true,
      paymentReceivedEmail: true, paymentReceivedSMS: false, paymentReceivedInApp: true,
      systemEmail: true, systemSMS: false, systemInApp: true,
      approvalEmail: true, approvalSMS: false, approvalInApp: true,
      announcementEmail: true, announcementSMS: false, announcementInApp: true,
    });

    const result = await dispatchNotification({
      associationId: 1, userId: 10, title: 't', message: 'm', kind: 'payment_received',
    });

    expect(result.inAppCreated).toBe(true);
    expect(notificationCreate).toHaveBeenCalled();
    expect(sendPushMock).not.toHaveBeenCalled();
  });
});

describe('filterPushEligible', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an empty array for an empty input without querying', async () => {
    const result = await filterPushEligible(1, []);
    expect(result).toEqual([]);
    expect(preferenceFindMany).not.toHaveBeenCalled();
  });

  it('excludes only the users with an explicit pushEnabled:false row, defaulting everyone else in', async () => {
    preferenceFindMany.mockResolvedValue([{ userId: 20 }]); // only user 20 has opted out

    const result = await filterPushEligible(1, [10, 20, 30]);

    expect(preferenceFindMany).toHaveBeenCalledWith({
      where: { associationId: 1, userId: { in: [10, 20, 30] }, pushEnabled: false },
      select: { userId: true },
    });
    expect(result).toEqual([10, 30]);
  });
});
