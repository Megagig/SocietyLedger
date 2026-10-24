/**
 * The SMS engine: credits are reserved before anything is sent and never go below zero, every text is recorded first, a credit is only
 * spent on a text that went out, and a send cut short by a restart is cleaned up. Prisma and the provider are mocked.
 */
const tx: any = {
  sMSCreditBalance: { upsert: jest.fn(), updateMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  sMSCreditTransaction: { create: jest.fn() },
  sMSMessage: { createManyAndReturn: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
};
const mockPrisma: any = {
  ...tx,
  sMSMessage: { createManyAndReturn: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  sMSCampaign: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  announcement: { update: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn(async (arg: any) => arg(tx)),
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, prisma: mockPrisma, default: mockPrisma }));
jest.mock('../../src/lib/sms', () => ({ sendSMS: jest.fn() }));

import { applyDeliveryReport, dispatchMessages, mapProviderStatus, recoverInterruptedSends, refundFailed, reserveCredits } from '../../src/modules/sms/sms-engine';

const people = [
  { phone: '2348031234567', name: 'Ada', memberId: 1 },
  { phone: '2348039999999', name: 'Bayo', memberId: 2 },
  { phone: '2348035555555', name: 'Chi', memberId: 3 },
];

beforeEach(() => {
  jest.resetAllMocks();
  mockPrisma.$transaction.mockImplementation(async (arg: any) => arg(tx));
  tx.sMSCreditBalance.upsert.mockResolvedValue({ id: 7 });
  tx.sMSCreditBalance.updateMany.mockResolvedValue({ count: 1 });
  tx.sMSMessage.createManyAndReturn.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
  mockPrisma.sMSMessage.findMany.mockResolvedValue([
    { id: 1, recipientPhone: people[0].phone, message: 'Hi' },
    { id: 2, recipientPhone: people[1].phone, message: 'Hi' },
    { id: 3, recipientPhone: people[2].phone, message: 'Hi' },
  ]);
  mockPrisma.sMSMessage.updateMany.mockResolvedValue({ count: 1 });
  tx.sMSMessage.findMany.mockResolvedValue([]);
});

const input = (over: object = {}) => ({ associationId: 1, description: 'Quick SMS', recipients: people, text: 'Hi', segments: 2, messageType: 'SINGLE' as const, inline: true, ...over });

describe('reserving credits', () => {
  it('takes them in one statement that only succeeds if the balance holds them', async () => {
    await reserveCredits(tx, 1, 6, 'Quick SMS');
    expect(tx.sMSCreditBalance.updateMany).toHaveBeenCalledWith({
      where: { associationId: 1, balance: { gte: 6 } },
      data: { balance: { decrement: 6 }, totalUsed: { increment: 6 } },
    });
    expect(tx.sMSCreditTransaction.create.mock.calls[0][0].data).toMatchObject({ type: 'USAGE', amount: -6 });
  });

  it('refuses when the balance is short, saying how many to buy, and writes nothing', async () => {
    tx.sMSCreditBalance.updateMany.mockResolvedValue({ count: 0 });
    tx.sMSCreditBalance.findUnique.mockResolvedValue({ balance: 40 });
    await expect(reserveCredits(tx, 1, 100, 'Quick SMS')).rejects.toMatchObject({ status: 409, code: 'INSUFFICIENT_CREDITS', message: expect.stringContaining('Buy 60 more') });
    expect(tx.sMSCreditTransaction.create).not.toHaveBeenCalled();
  });
});

describe('sending', () => {
  it('reserves credits and records every text as pending before any is sent', async () => {
    const order: string[] = [];
    tx.sMSCreditBalance.updateMany.mockImplementation(async () => (order.push('reserve'), { count: 1 }));
    tx.sMSMessage.createManyAndReturn.mockImplementation(async () => (order.push('record'), [{ id: 1 }, { id: 2 }, { id: 3 }]));
    const send = jest.fn(async () => (order.push('send'), { success: true, message: 'ok', messageId: 'm' }));
    await dispatchMessages(input({ send }));
    expect(order.slice(0, 2)).toEqual(['reserve', 'record']);
    expect(order.filter((o) => o === 'send')).toHaveLength(3);
    expect(tx.sMSMessage.createManyAndReturn.mock.calls[0][0].data[0]).toMatchObject({ status: 'PENDING', segments: 2, recipientPhone: people[0].phone });
    expect(tx.sMSCreditBalance.updateMany.mock.calls[0][0].where.balance).toEqual({ gte: 6 }); // 3 people x 2 segments
  });

  it('nothing is sent when the credits are not there', async () => {
    tx.sMSCreditBalance.updateMany.mockResolvedValue({ count: 0 });
    tx.sMSCreditBalance.findUnique.mockResolvedValue({ balance: 1 });
    const send = jest.fn();
    await expect(dispatchMessages(input({ send }))).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    expect(send).not.toHaveBeenCalled();
    expect(tx.sMSMessage.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('marks each text sent or failed, and gives back the credits for the ones that failed', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({ success: true, message: 'ok', messageId: 'a' })
      .mockResolvedValueOnce({ success: false, message: 'no', error: 'Invalid number' })
      .mockRejectedValueOnce(new Error('Network down'));
    tx.sMSMessage.findMany.mockResolvedValue([{ id: 2, segments: 2 }, { id: 3, segments: 2 }]);
    tx.sMSMessage.updateMany.mockResolvedValue({ count: 2 });

    const result = await dispatchMessages(input({ send }));
    const totals = await result.done;

    expect(totals).toEqual({ sent: 1, failed: 2, refunded: 4 });
    const updates = mockPrisma.sMSMessage.updateMany.mock.calls.map((c: any[]) => c[0]);
    expect(updates.find((u: any) => u.where.id === 1 || u.where.id === 2)).toBeDefined();
    expect(mockPrisma.sMSMessage.updateMany.mock.calls.some(([a]: any[]) => a.data.status === 'SENT' && a.data.termiiMessageId === 'a')).toBe(true);
    expect(mockPrisma.sMSMessage.updateMany.mock.calls.some(([a]: any[]) => a.data.status === 'FAILED' && a.data.errorMessage === 'Network down')).toBe(true);
    expect(tx.sMSCreditBalance.update).toHaveBeenCalledWith({ where: { associationId: 1 }, data: { balance: { increment: 4 }, totalUsed: { decrement: 4 } } });
    expect(tx.sMSCreditTransaction.create.mock.calls.at(-1)[0].data).toMatchObject({ type: 'REFUND', amount: 4 });
  });

  it('a campaign shows progress as it goes and ends completed', async () => {
    const send = jest.fn(async () => ({ success: true, message: 'ok', messageId: 'm' }));
    mockPrisma.sMSCampaign.findUnique.mockResolvedValue({ status: 'IN_PROGRESS' });
    await (await dispatchMessages(input({ send, campaignId: 9, messageType: 'BULK' }))).done;
    expect(mockPrisma.sMSCampaign.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { sentCount: { increment: 3 }, failedCount: { increment: 0 } } });
    expect(mockPrisma.sMSCampaign.updateMany.mock.calls.at(-1)[0]).toMatchObject({ where: { id: 9, status: 'IN_PROGRESS' }, data: { status: 'COMPLETED' } });
  });

  it('a campaign cancelled part-way stops sending and gives back what was not sent', async () => {
    const send = jest.fn(async () => ({ success: true, message: 'ok', messageId: 'm' }));
    mockPrisma.sMSCampaign.findUnique.mockResolvedValue({ status: 'CANCELLED' });
    tx.sMSMessage.findMany.mockResolvedValue([{ id: 1, segments: 2 }, { id: 2, segments: 2 }, { id: 3, segments: 2 }]);
    tx.sMSMessage.updateMany.mockResolvedValue({ count: 3 });
    const totals = await (await dispatchMessages(input({ send, campaignId: 9, messageType: 'BULK' }))).done;
    expect(send).not.toHaveBeenCalled();
    expect(totals).toMatchObject({ sent: 0, failed: 3, refunded: 6 });
    expect(mockPrisma.sMSMessage.updateMany.mock.calls.some(([a]: any[]) => a.data.errorMessage === 'Cancelled before it was sent')).toBe(true);
  });

  it('an announcement records how many were sent and how many failed', async () => {
    const send = jest.fn().mockResolvedValueOnce({ success: true, message: 'ok' }).mockResolvedValue({ success: false, message: 'no', error: 'x' });
    tx.sMSMessage.findMany.mockResolvedValue([]);
    await (await dispatchMessages(input({ send, announcementId: 5 }))).done;
    expect(mockPrisma.announcement.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({ smsSent: 1, smsFailed: 2, creditsUsed: 2, status: 'COMPLETED' }),
    });
  });

  it('a big send returns at once and carries on in the background', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const send = jest.fn(async () => (await gate, { success: true, message: 'ok' }));
    const result = await dispatchMessages(input({ send, inline: false }));
    expect(result.accepted).toBe(3); // accepted and recorded; nothing has gone out yet
    expect(mockPrisma.sMSMessage.updateMany.mock.calls.some(([a]: any[]) => a.data.status === 'SENT')).toBe(false);
    release();
    expect((await result.done).sent).toBe(3);
  });
});

describe('refunds happen once', () => {
  it('only texts that are failed and not already refunded are given back, and they are flagged in the same step', async () => {
    tx.sMSMessage.findMany.mockResolvedValue([{ id: 2, segments: 1 }]);
    tx.sMSMessage.updateMany.mockResolvedValue({ count: 1 });
    expect(await refundFailed(1, [1, 2, 3], 'Refund')).toBe(1);
    expect(tx.sMSMessage.findMany.mock.calls[0][0].where).toMatchObject({ status: { in: ['FAILED', 'REJECTED'] }, refunded: false });
    expect(tx.sMSMessage.updateMany).toHaveBeenCalledWith({ where: { id: { in: [2] }, refunded: false }, data: { refunded: true } });
  });

  it('a second run refunds nothing', async () => {
    tx.sMSMessage.findMany.mockResolvedValue([]);
    expect(await refundFailed(1, [1, 2, 3], 'Refund')).toBe(0);
    expect(tx.sMSCreditBalance.update).not.toHaveBeenCalled();
  });

  it('losing the race to another run refunds nothing', async () => {
    tx.sMSMessage.findMany.mockResolvedValue([{ id: 2, segments: 1 }]);
    tx.sMSMessage.updateMany.mockResolvedValue({ count: 0 });
    expect(await refundFailed(1, [2], 'Refund')).toBe(0);
    expect(tx.sMSCreditBalance.update).not.toHaveBeenCalled();
  });
});

describe('delivery reports', () => {
  it('understands the words a provider uses, and ignores the ones that are not final', () => {
    expect(mapProviderStatus('DELIVRD')).toBe('DELIVERED');
    expect(mapProviderStatus('Delivered')).toBe('DELIVERED');
    expect(mapProviderStatus('undelivered')).toBe('FAILED');
    expect(mapProviderStatus('Rejected')).toBe('FAILED');
    expect(mapProviderStatus('Message Failed')).toBe('FAILED');
    expect(mapProviderStatus('DND Active on Phone Number')).toBe('FAILED');
    expect(mapProviderStatus('Message Sent')).toBeNull();
    expect(mapProviderStatus('queued')).toBeNull();
    expect(mapProviderStatus('sent')).toBeNull();
    expect(mapProviderStatus('')).toBeNull();
  });

  it('a delivered report marks a sent text delivered, once, and counts it on its campaign', async () => {
    mockPrisma.sMSMessage.findFirst.mockResolvedValue({ id: 8, associationId: 1, campaignId: 4 });
    mockPrisma.sMSMessage.updateMany.mockResolvedValue({ count: 1 });
    expect(await applyDeliveryReport('abc', 'DELIVRD')).toEqual({ applied: true });
    expect(mockPrisma.sMSMessage.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 8, status: 'SENT' }, data: { status: 'DELIVERED' } });
    expect(mockPrisma.sMSCampaign.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { deliveredCount: { increment: 1 } } });
  });

  it('the same report twice changes nothing the second time', async () => {
    mockPrisma.sMSMessage.findFirst.mockResolvedValue({ id: 8, associationId: 1, campaignId: 4 });
    mockPrisma.sMSMessage.updateMany.mockResolvedValue({ count: 0 });
    expect(await applyDeliveryReport('abc', 'DELIVRD')).toEqual({ applied: false });
    expect(mockPrisma.sMSCampaign.update).not.toHaveBeenCalled();
  });

  it('a text the carrier could not deliver is marked failed and its credit is given back', async () => {
    mockPrisma.sMSMessage.findFirst.mockResolvedValue({ id: 8, associationId: 1, campaignId: null });
    mockPrisma.sMSMessage.updateMany.mockResolvedValue({ count: 1 });
    tx.sMSMessage.findMany.mockResolvedValue([{ id: 8, segments: 2 }]);
    tx.sMSMessage.updateMany.mockResolvedValue({ count: 1 });
    expect(await applyDeliveryReport('abc', 'failed')).toEqual({ applied: true });
    expect(tx.sMSCreditBalance.update).toHaveBeenCalledWith({ where: { associationId: 1 }, data: { balance: { increment: 2 }, totalUsed: { decrement: 2 } } });
  });

  it('a report for a text we do not know, or with a status that is not final, is ignored', async () => {
    mockPrisma.sMSMessage.findFirst.mockResolvedValue(null);
    expect(await applyDeliveryReport('nope', 'DELIVRD')).toEqual({ applied: false });
    expect(await applyDeliveryReport('abc', 'queued')).toEqual({ applied: false });
    expect(mockPrisma.sMSMessage.updateMany).not.toHaveBeenCalled();
  });
});

describe('after a restart', () => {
  it('texts left pending too long are failed, refunded, and their campaign marked interrupted', async () => {
    mockPrisma.sMSMessage.findMany.mockResolvedValue([
      { id: 11, associationId: 1, campaignId: 4, announcementId: null },
      { id: 12, associationId: 1, campaignId: 4, announcementId: null },
    ]);
    tx.sMSMessage.findMany.mockResolvedValue([{ id: 11, segments: 1 }, { id: 12, segments: 1 }]);
    tx.sMSMessage.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.sMSMessage.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);

    const result = await recoverInterruptedSends();

    expect(result).toEqual({ messages: 2, credits: 2 });
    expect(mockPrisma.sMSMessage.updateMany.mock.calls[0][0]).toMatchObject({ data: { status: 'FAILED', errorMessage: 'Interrupted by a server restart' } });
    expect(mockPrisma.sMSCampaign.updateMany).toHaveBeenCalledWith({
      where: { id: 4, status: 'IN_PROGRESS' },
      data: expect.objectContaining({ status: 'INTERRUPTED', sentCount: 5, failedCount: 2 }),
    });
  });

  it('does nothing when nothing is stale', async () => {
    mockPrisma.sMSMessage.findMany.mockResolvedValue([]);
    expect(await recoverInterruptedSends()).toEqual({ messages: 0, credits: 0 });
    expect(mockPrisma.sMSMessage.updateMany).not.toHaveBeenCalled();
  });
});
