/**
 * Announcements: one message to chosen members, kept as a record. The app feed and push reach members with a login; members without one
 * are reached by SMS or email if those are ticked; texts are reserved before anything goes out. Prisma and the senders are mocked.
 */
const mockPrisma: any = {
  association: { findUnique: jest.fn() },
  user: { findMany: jest.fn() },
  member: { findMany: jest.fn() },
  sMSCreditBalance: { findUnique: jest.fn() },
  sMSMessage: { groupBy: jest.fn() },
  announcement: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUniqueOrThrow: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, prisma: mockPrisma, default: mockPrisma }));
const email = jest.fn();
jest.mock('../../src/lib/email', () => ({ sendEmail: (...a: unknown[]) => email(...a) }));
const moduleOn = jest.fn();
jest.mock('../../src/services/module-feature.service', () => ({ ModuleFeatureService: { isModuleEnabled: (...a: unknown[]) => moduleOn(...a) } }));
const setting = jest.fn();
jest.mock('../../src/modules/settings/settings.service', () => ({ SettingsService: { getSetting: (...a: unknown[]) => setting(...a) } }));
const notify = jest.fn();
jest.mock('../../src/services/notification-preferences.service', () => ({ dispatchNotification: (...a: unknown[]) => notify(...a) }));
const audience = jest.fn();
jest.mock('../../src/modules/sms/sms-audience', () => ({ resolveSmsAudience: (...a: unknown[]) => audience(...a) }));
const dispatch = jest.fn();
jest.mock('../../src/modules/sms/sms-engine', () => ({ dispatchMessages: (...a: unknown[]) => dispatch(...a), INLINE_LIMIT: 25 }));

import { RuleError } from '../../src/modules/finance/rule-error';
import { announcementsService } from '../../src/modules/notifications/announcements.service';

const member = (id: number, over: object = {}) => ({ id, firstName: `M${id}`, lastName: 'Obi', phone: `0803000000${id}`, userId: id * 10, ...over });
const input = (over: object = {}) => ({ title: 'AGM', message: 'We meet on Saturday', priority: 'info' as const, audience: 'ALL' as const, sendEmail: false, sendSms: false, ...over });

beforeEach(() => {
  jest.resetAllMocks();
  mockPrisma.association.findUnique.mockResolvedValue({ name: 'Oko Youth Forum' });
  moduleOn.mockResolvedValue(true);
  setting.mockResolvedValue('termii');
  mockPrisma.announcement.create.mockResolvedValue({ id: 5 });
  mockPrisma.announcement.update.mockResolvedValue({});
  mockPrisma.announcement.findUniqueOrThrow.mockResolvedValue({ id: 5, inAppCount: 2, emailCount: 0, noLoginCount: 1 });
  mockPrisma.sMSCreditBalance.findUnique.mockResolvedValue({ balance: 100 });
  // three members: two with a login, one without (and with an email); one has no phone number
  const members = [member(1), member(2), member(3, { userId: null, phone: null })];
  audience.mockResolvedValue({
    members,
    willText: [{ phone: '2348030000001', memberId: 1 }, { phone: '2348030000002', memberId: 2 }],
    noPhone: [members[2]],
    optedOut: [],
    invalidNumbers: [],
  });
  mockPrisma.user.findMany.mockResolvedValue([{ id: 10, email: 'a@x.com' }, { id: 20, email: 'b@x.com' }]);
  mockPrisma.member.findMany.mockResolvedValue([{ id: 3, email: 'c@x.com', firstName: 'M3', lastName: 'Obi' }]);
  notify.mockResolvedValue({ inAppCreated: true, emailSent: false, smsSent: false });
  dispatch.mockResolvedValue({ accepted: 2, credits: 2, messageIds: [1, 2], done: Promise.resolve({ sent: 2, failed: 0, refunded: 0 }) });
});

describe('preview', () => {
  it('says who an announcement reaches and who it misses', async () => {
    const result = await announcementsService.preview(1, input());
    expect(result.reach).toEqual({ members: 3, withLogin: 2, noLogin: 1, withEmail: 3, willText: 2, noPhone: 1, optedOut: 0 });
    expect(result.sms).toBeNull();
  });

  it('shows the cost of the SMS against the balance, and what is short', async () => {
    mockPrisma.sMSCreditBalance.findUnique.mockResolvedValue({ balance: 1 });
    const result = await announcementsService.preview(1, input({ sendSms: true }));
    expect(result.sms).toMatchObject({ segments: 1, credits: 2, balance: 1, enough: false, shortBy: 1 });
    expect(result.smsText).toBe('Oko Youth Forum - AGM: We meet on Saturday');
  });

  it("an officer's own text wins over the default", async () => {
    const result = await announcementsService.preview(1, input({ sendSms: true, smsText: 'AGM Sat 4pm' }));
    expect(result.smsText).toBe('AGM Sat 4pm');
  });

  it('an audience that names nobody is refused, not treated as everyone', async () => {
    await expect(announcementsService.preview(1, input({ audience: 'CATEGORY', categories: [] }))).rejects.toMatchObject({ code: 'AUDIENCE_EMPTY' });
    await expect(announcementsService.preview(1, input({ audience: 'SELECTED', memberIds: [] }))).rejects.toMatchObject({ code: 'AUDIENCE_EMPTY' });
  });
});

describe('sending by the app only', () => {
  it('is kept as a record and reaches each member with a login, and sends no texts', async () => {
    const result = await announcementsService.create(1, 50, input());
    expect(mockPrisma.announcement.create.mock.calls[0][0].data).toMatchObject({ title: 'AGM', status: 'COMPLETED', sendSms: false, memberCount: 3, noLoginCount: 1, createdBy: 50 });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[0][0]).toMatchObject({ userId: 10, kind: 'announcement', sendSMS: false, sendEmail: false });
    expect(dispatch).not.toHaveBeenCalled();
    expect(mockPrisma.announcement.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { inAppCount: 2, emailCount: 0 } });
    expect(result.reach.noLogin).toBe(1);
  });

  it('members with no login get an email, when it is ticked, and only then', async () => {
    await announcementsService.create(1, 50, input());
    expect(email).not.toHaveBeenCalled();
    await announcementsService.create(1, 50, input({ sendEmail: true }));
    expect(email).toHaveBeenCalledTimes(1);
    expect(email.mock.calls[0][0]).toMatchObject({ to: 'c@x.com', template: 'announcement' });
  });
});

describe('sending with SMS', () => {
  it('reserves and sends the texts through the engine, tied to the announcement, and the in-app copy still goes', async () => {
    const result = await announcementsService.create(1, 50, input({ sendSms: true }));
    expect(dispatch.mock.calls[0][0]).toMatchObject({ announcementId: 5, messageType: 'BULK', segments: 1, description: 'Announcement: AGM', inline: true });
    expect(mockPrisma.announcement.create.mock.calls[0][0].data).toMatchObject({ status: 'SENDING', smsRequested: 2, noPhoneCount: 1 });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[0][0].sendSMS).toBe(false); // texts do not go through the notification path any more
    expect(result.smsSent).toBe(2);
  });

  it('not enough credits: nothing goes out and no record is left', async () => {
    dispatch.mockRejectedValue(new RuleError('You need 2 SMS credits for this and have 0.', 409, 'INSUFFICIENT_CREDITS'));
    await expect(announcementsService.create(1, 50, input({ sendSms: true }))).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    expect(mockPrisma.announcement.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(notify).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it("a plan without SMS, or a provider switched off, is refused before anything is created", async () => {
    moduleOn.mockResolvedValue(false);
    await expect(announcementsService.create(1, 50, input({ sendSms: true }))).rejects.toMatchObject({ code: 'MODULE_DISABLED' });
    moduleOn.mockResolvedValue(true);
    setting.mockResolvedValue('none');
    await expect(announcementsService.create(1, 50, input({ sendSms: true }))).rejects.toMatchObject({ code: 'SMS_DISABLED' });
    expect(mockPrisma.announcement.create).not.toHaveBeenCalled();
  });

  it('with no one who can be texted it says so, instead of reserving nothing and reporting success', async () => {
    audience.mockResolvedValue({ members: [member(1)], willText: [], noPhone: [member(1)], optedOut: [], invalidNumbers: [] });
    await expect(announcementsService.create(1, 50, input({ sendSms: true }))).rejects.toMatchObject({ code: 'NO_RECIPIENTS' });
    expect(mockPrisma.announcement.create).not.toHaveBeenCalled();
  });

  it('a big audience returns at once and the texts carry on in the background', async () => {
    dispatch.mockResolvedValue({ accepted: 40, credits: 40, messageIds: [], done: new Promise(() => undefined) });
    const result = await announcementsService.create(1, 50, input({ sendSms: true }));
    expect(dispatch.mock.calls[0][0].inline).toBe(true); // 2 people in this audience: the engine decides by audience size
    expect(result.inProgress).toBe(true);
  });
});

describe('the history', () => {
  it('lists what was sent, newest first, with who sent it', async () => {
    mockPrisma.announcement.findMany.mockResolvedValue([{ id: 5, createdBy: 50, creditsUsed: '2' }]);
    mockPrisma.announcement.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 50, email: 'o@x.com', member: { firstName: 'Ada', lastName: 'Obi' } }]);
    const result = await announcementsService.list(1);
    expect(mockPrisma.announcement.findMany.mock.calls[0][0]).toMatchObject({ where: { associationId: 1 }, orderBy: { createdAt: 'desc' } });
    expect(result.announcements[0]).toMatchObject({ id: 5, sentBy: 'Ada Obi', creditsUsed: 2 });
  });

  it('shows where the texts stand now, from the messages themselves', async () => {
    mockPrisma.announcement.findFirst.mockResolvedValue({ id: 5, creditsUsed: '0' });
    mockPrisma.sMSMessage.groupBy.mockResolvedValue([{ status: 'SENT', _count: 7 }, { status: 'DELIVERED', _count: 2 }, { status: 'FAILED', _count: 1 }, { status: 'PENDING', _count: 4 }]);
    const result = await announcementsService.get(1, 5);
    expect(result.sms).toEqual({ pending: 4, sent: 9, delivered: 2, failed: 1 });
  });

  it("another association's announcement is not found", async () => {
    mockPrisma.announcement.findFirst.mockResolvedValue(null);
    await expect(announcementsService.get(1, 99)).rejects.toThrow('Announcement not found');
    expect(mockPrisma.announcement.findFirst.mock.calls[0][0].where).toEqual({ id: 99, associationId: 1 });
  });
});
