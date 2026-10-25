/**
 * The SMS service on top of the engine: a campaign is claimed once and started once, quick SMS reaches each number once, credits only
 * move through the engine, and a top-up is applied once. Prisma and the engine are mocked.
 */
const tx: any = {
  sMSCreditTransaction: { findFirst: jest.fn(), create: jest.fn() },
  sMSCreditBalance: { findUnique: jest.fn(), upsert: jest.fn() },
};
const mockPrisma: any = {
  sMSCampaign: { findFirst: jest.fn(), updateMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), findFirstOrThrow: jest.fn() },
  sMSTemplate: { findFirst: jest.fn(), update: jest.fn() },
  sMSMessage: { findMany: jest.fn() },
  sMSCreditBalance: { findUnique: jest.fn() },
  member: { findFirst: jest.fn() },
  $transaction: jest.fn(async (arg: any) => arg(tx)),
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, prisma: mockPrisma, default: mockPrisma }));
jest.mock('../../src/lib/sms', () => ({
  sendSMS: jest.fn(),
  sendBulkSMS: jest.fn(),
  getSMSBalance: jest.fn(),
  formatPhoneNumber: (p: string) => p,
  isValidPhoneNumber: () => true,
  calculateSMSSegments: () => 1,
  applyMessageTemplate: (t: string) => t,
}));
const settings = jest.fn();
jest.mock('../../src/modules/settings/settings.service', () => ({ SettingsService: { getSetting: (...a: unknown[]) => settings(...a) } }));
const dispatch = jest.fn();
jest.mock('../../src/modules/sms/sms-engine', () => ({
  dispatchMessages: (...a: unknown[]) => dispatch(...a),
  INLINE_LIMIT: 25,
  reserveCredits: jest.fn(),
}));
const audience = jest.fn();
jest.mock('../../src/modules/sms/sms-audience', () => ({ resolveSmsAudience: (...a: unknown[]) => audience(...a) }));

import { RuleError } from '../../src/modules/finance/rule-error';
import { SMSService } from '../../src/modules/sms/sms.service';

const service = new SMSService();
const people = [
  { phone: '2348031234567', name: 'Ada', memberId: 1 },
  { phone: '2348039999999', name: 'Bayo', memberId: 2 },
];

beforeEach(() => {
  jest.resetAllMocks();
  mockPrisma.$transaction.mockImplementation(async (arg: any) => arg(tx));
  settings.mockResolvedValue('termii');
  audience.mockResolvedValue({ willText: people, noPhone: [{ id: 3 }], optedOut: [{ id: 4 }, { id: 5 }], members: [], invalidNumbers: [] });
  dispatch.mockResolvedValue({ accepted: 2, credits: 2, messageIds: [1, 2], done: Promise.resolve({ sent: 2, failed: 0, refunded: 0 }) });
  mockPrisma.sMSCreditBalance.findUnique.mockResolvedValue({ balance: 90 });
});

const campaign = (over: object = {}) => ({ id: 9, associationId: 1, name: 'Dues reminder', message: 'Pay your dues', status: 'DRAFT', recipientType: 'ALL_MEMBERS', recipientFilter: null, ...over });

describe('starting a campaign', () => {
  beforeEach(() => {
    mockPrisma.sMSCampaign.findFirst.mockResolvedValue(campaign());
    mockPrisma.sMSCampaign.updateMany.mockResolvedValue({ count: 1 });
  });

  it('claims the campaign, then sends: it returns at once with who it will reach and who it will miss', async () => {
    const stats = await service.startCampaign(1, 9);
    expect(mockPrisma.sMSCampaign.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 9, status: { in: ['DRAFT', 'SCHEDULED'] } }, data: { status: 'IN_PROGRESS', totalRecipients: 2 } });
    expect(dispatch.mock.calls[0][0]).toMatchObject({ campaignId: 9, messageType: 'BULK', segments: 1, description: 'Campaign: Dues reminder' });
    expect(stats).toMatchObject({ totalRecipients: 2, inProgress: true, skipped: { noPhone: 1, optedOut: 2 } });
  });

  it('a second tap loses the claim and sends nothing', async () => {
    mockPrisma.sMSCampaign.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.startCampaign(1, 9)).rejects.toMatchObject({ status: 409, code: 'ALREADY_STARTED' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('a campaign that is already sending, or finished, cannot be started', async () => {
    mockPrisma.sMSCampaign.findFirst.mockResolvedValue(campaign({ status: 'IN_PROGRESS' }));
    await expect(service.startCampaign(1, 9)).rejects.toMatchObject({ code: 'ALREADY_STARTED' });
    expect(mockPrisma.sMSCampaign.updateMany).not.toHaveBeenCalled();
  });

  it('with nobody to text, nothing is claimed or charged', async () => {
    audience.mockResolvedValue({ willText: [], noPhone: [{ id: 1 }], optedOut: [], members: [], invalidNumbers: [] });
    await expect(service.startCampaign(1, 9)).rejects.toMatchObject({ code: 'NO_RECIPIENTS' });
    expect(mockPrisma.sMSCampaign.updateMany).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('not enough credits: nothing goes out and the campaign is put back as it was, ready to start once credits are bought', async () => {
    dispatch.mockRejectedValue(new RuleError('You need 2 SMS credits for this and have 0.', 409, 'INSUFFICIENT_CREDITS'));
    await expect(service.startCampaign(1, 9)).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    expect(mockPrisma.sMSCampaign.updateMany.mock.calls[1][0]).toMatchObject({ where: { id: 9, status: 'IN_PROGRESS' }, data: { status: 'DRAFT', startedAt: null } });
  });

  it('a provider switched off stops it before anything is claimed', async () => {
    settings.mockResolvedValue('none');
    await expect(service.startCampaign(1, 9)).rejects.toMatchObject({ code: 'SMS_DISABLED' });
    expect(mockPrisma.sMSCampaign.updateMany).not.toHaveBeenCalled();
  });
});

describe('cancelling and deleting a campaign', () => {
  it('can be cancelled while it is draft, scheduled or sending, once', async () => {
    mockPrisma.sMSCampaign.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.sMSCampaign.findFirstOrThrow.mockResolvedValue({ id: 9, status: 'CANCELLED' });
    await service.cancelCampaign(1, 9);
    expect(mockPrisma.sMSCampaign.updateMany.mock.calls[0][0].where.status.in).toEqual(['DRAFT', 'SCHEDULED', 'IN_PROGRESS']);
  });

  it('a campaign already finished cannot be cancelled', async () => {
    mockPrisma.sMSCampaign.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.sMSCampaign.findFirst.mockResolvedValue({ status: 'COMPLETED' });
    await expect(service.cancelCampaign(1, 9)).rejects.toMatchObject({ status: 409, code: 'NOT_CANCELLABLE' });
  });

  it('only a draft can be deleted, claimed in the same step', async () => {
    mockPrisma.sMSCampaign.findFirst.mockResolvedValue(campaign());
    mockPrisma.sMSCampaign.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteCampaign(1, 9)).rejects.toMatchObject({ code: 'NOT_DELETABLE' });
    expect(mockPrisma.sMSCampaign.deleteMany.mock.calls[0][0].where).toMatchObject({ id: 9, status: 'DRAFT' });
  });
});

describe('quick SMS', () => {
  it('texts each number once, even listed twice or written two ways, and a small send finishes inside the request', async () => {
    mockPrisma.sMSMessage.findMany.mockResolvedValue([{ recipientPhone: '2348031234567', status: 'SENT', termiiMessageId: 'a', errorMessage: null }]);
    dispatch.mockResolvedValue({ accepted: 1, credits: 1, messageIds: [1], done: Promise.resolve({ sent: 1, failed: 0, refunded: 0 }) });
    const result = await service.sendQuickSMS(1, 50, { recipients: ['08031234567', '+234 803 123 4567'], message: 'Meeting at 4pm' } as any);
    expect(dispatch.mock.calls[0][0].recipients).toHaveLength(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({ inline: true, messageType: 'SINGLE', segments: 1 });
    expect(result).toMatchObject({ totalSent: 1, totalFailed: 0, creditsUsed: 1, messages: [{ phone: '2348031234567', success: true }] });
  });

  it('a big send returns at once, saying it is in progress', async () => {
    const many = Array.from({ length: 30 }, (_, i) => `0803000${String(1000 + i)}`);
    dispatch.mockResolvedValue({ accepted: 30, credits: 30, messageIds: [], done: new Promise(() => undefined) });
    const result = await service.sendQuickSMS(1, 50, { recipients: many, message: 'Meeting at 4pm' } as any);
    expect(dispatch.mock.calls[0][0].inline).toBe(false);
    expect(result).toMatchObject({ inProgress: true, accepted: 30, totalSent: 0 });
  });

  it('numbers that are not numbers are dropped, and with none left nothing is charged', async () => {
    await expect(service.sendQuickSMS(1, 50, { recipients: ['12345', 'hello'], message: 'Hi' } as any)).rejects.toMatchObject({ code: 'NO_RECIPIENTS' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('an empty or over-long message is refused before anything is reserved', async () => {
    await expect(service.sendQuickSMS(1, 50, { recipients: ['08031234567'], message: '   ' } as any)).rejects.toMatchObject({ code: 'EMPTY_MESSAGE' });
    await expect(service.sendQuickSMS(1, 50, { recipients: ['08031234567'], message: 'a'.repeat(1500) } as any)).rejects.toMatchObject({ code: 'MESSAGE_TOO_LONG' });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('topping up credits', () => {
  it('reports the real balance (the old code added the credits to it a second time)', async () => {
    tx.sMSCreditTransaction.findFirst.mockResolvedValue(null);
    tx.sMSCreditBalance.upsert.mockResolvedValue({ id: 7, balance: 150, totalPurchased: 150, totalUsed: 10, lastTopUpAt: new Date() });
    const result = await service.topUpCredits(1, 100, 'ref-1');
    expect(result).toMatchObject({ balance: 150, totalPurchased: 150, totalUsed: 10 });
    expect(tx.sMSCreditTransaction.create.mock.calls[0][0].data).toMatchObject({ type: 'PURCHASE', amount: 100, reference: 'ref-1', balanceId: 7 });
  });

  it('the same reference is never credited twice', async () => {
    tx.sMSCreditTransaction.findFirst.mockResolvedValue({ id: 1 });
    tx.sMSCreditBalance.findUnique.mockResolvedValue({ balance: 150, totalPurchased: 150, totalUsed: 0, lastTopUpAt: null });
    const result = await service.topUpCredits(1, 100, 'ref-1');
    expect(tx.sMSCreditBalance.upsert).not.toHaveBeenCalled();
    expect(result.balance).toBe(150);
  });
});

describe('previewing an audience', () => {
  it('says who is texted, who is missed, and what it costs against the balance', async () => {
    mockPrisma.sMSCreditBalance.findUnique.mockResolvedValue({ balance: 1, totalPurchased: 1, totalUsed: 0, lastTopUpAt: null });
    mockPrisma.sMSCreditBalance.upsert = jest.fn();
    const preview = await service.previewAudience(1, 'ALL_MEMBERS', null, 'Meeting at 4pm');
    expect(preview).toMatchObject({ members: 0, willText: 2, noPhone: 1, optedOut: 2, segments: 1, credits: 2, balance: 1, enough: false, shortBy: 1 });
  });

  it('with no message it says who, and leaves the cost out', async () => {
    mockPrisma.sMSCreditBalance.findUnique.mockResolvedValue({ balance: 50, totalPurchased: 50, totalUsed: 0, lastTopUpAt: null });
    expect(await service.previewAudience(1, 'ALL_MEMBERS', null)).toMatchObject({ willText: 2, credits: null, enough: null });
  });
});
