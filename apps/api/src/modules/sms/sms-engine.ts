// ============================================
// SMS ENGINE
// The one place texts are sent from — quick SMS, campaigns and announcements all use it — so credits and history behave the same way:
//   1. the credits are reserved first, in one step that only succeeds if the balance covers them (never below zero, and two sends at the
//      same moment can't spend the same credits);
//   2. every text is recorded as pending before it goes out;
//   3. a credit is only spent on a text that went out: failed and interrupted texts are given back, once;
//   4. a big send carries on in the background, so the request doesn't hang until it times out.
// ============================================

import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSMS as providerSend, type SMSSendResult } from '../../lib/sms';
import { assertEnoughCredits, type Recipient } from './sms-rules';

type Db = Prisma.TransactionClient;
type Sender = (options: { to: string; message: string }) => Promise<SMSSendResult>;

/** How many texts go out at once. */
const CHUNK = 5;
/** A send this size or smaller finishes inside the request, so the officer sees what happened straight away. */
export const INLINE_LIMIT = 25;
/** A text still pending after this long belongs to a send the server never finished. */
export const STALE_MINUTES = 10;

export interface DeliveryTotals {
  sent: number;
  failed: number;
  /** Credits given back for texts that didn't go out. */
  refunded: number;
}

export interface DispatchInput {
  associationId: number;
  /** What the credit history says, e.g. "Campaign: Dues reminder". */
  description: string;
  recipients: (Recipient & { phone: string })[];
  text: string;
  segments: number;
  messageType: 'SINGLE' | 'BULK';
  campaignId?: number;
  announcementId?: number;
  /** Finish before returning (small sends) instead of carrying on in the background. */
  inline?: boolean;
  /** For tests: stands in for the provider. */
  send?: Sender;
}

export interface DispatchResult {
  accepted: number;
  credits: number;
  messageIds: number[];
  /** Resolves when every text has been tried. Await it to wait; ignore it to let the send carry on. */
  done: Promise<DeliveryTotals>;
}

// ---------------------------------------------------------------- credits

async function ensureBalance(db: Db, associationId: number) {
  return db.sMSCreditBalance.upsert({ where: { associationId }, create: { associationId, balance: 0, totalPurchased: 0, totalUsed: 0 }, update: {} });
}

/**
 * Takes credits out of the balance, only if it holds them. The balance check and the deduction are one statement, so two sends at once
 * can't both pass a check and then overspend, and the balance can never go below zero.
 */
export async function reserveCredits(db: Db, associationId: number, credits: number, description: string, refs: { campaignId?: number } = {}): Promise<void> {
  if (credits <= 0) return;
  const balance = await ensureBalance(db, associationId);
  const { count } = await db.sMSCreditBalance.updateMany({
    where: { associationId, balance: { gte: credits } },
    data: { balance: { decrement: credits }, totalUsed: { increment: credits } },
  });
  if (count !== 1) {
    const current = await db.sMSCreditBalance.findUnique({ where: { associationId }, select: { balance: true } });
    assertEnoughCredits(Number(current?.balance ?? 0), credits);
    throw new Error('Could not reserve the credits');
  }
  await db.sMSCreditTransaction.create({ data: { balanceId: balance.id, type: 'USAGE', amount: -credits, description, campaignId: refs.campaignId } });
}

/** Gives credits back (a text that didn't go out), with a line in the credit history. */
export async function refundCredits(db: Db, associationId: number, credits: number, description: string, refs: { campaignId?: number } = {}): Promise<void> {
  if (credits <= 0) return;
  const balance = await ensureBalance(db, associationId);
  await db.sMSCreditBalance.update({ where: { associationId }, data: { balance: { increment: credits }, totalUsed: { decrement: credits } } });
  await db.sMSCreditTransaction.create({ data: { balanceId: balance.id, type: 'REFUND', amount: credits, description, campaignId: refs.campaignId } });
}

/**
 * Gives back the credit for every failed or interrupted text among these messages. Each message is flagged as it is refunded, in the same
 * step, so running this twice (or racing a recovery job) never refunds the same text twice.
 */
export async function refundFailed(associationId: number, messageIds: number[], description: string, campaignId?: number): Promise<number> {
  if (messageIds.length === 0) return 0;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.sMSMessage.findMany({ where: { id: { in: messageIds }, status: { in: ['FAILED', 'REJECTED'] }, refunded: false }, select: { id: true, segments: true } });
    if (rows.length === 0) return 0;
    const { count } = await tx.sMSMessage.updateMany({ where: { id: { in: rows.map((r) => r.id) }, refunded: false }, data: { refunded: true } });
    if (count === 0) return 0;
    const credits = rows.reduce((sum, r) => sum + r.segments, 0);
    await refundCredits(tx, associationId, credits, description, { campaignId });
    return credits;
  });
}

/**
 * Adds the credits for a purchase Paystack has confirmed — once. The purchase is claimed (pending to success) in the same step that adds
 * the credits and writes the history line, so two verifications at the same moment (the return page and a refresh, or a webhook) can't
 * both add them. Returns false when it had already been applied.
 */
export async function creditVerifiedPurchase(
  purchase: { id: number; associationId: number; userId: number; credits: number; reference: string; amount: { toNumber(): number } },
  paidAt: string | Date,
  paystackResponse: unknown,
): Promise<boolean> {
  const credited = await prisma.$transaction(async (tx) => {
    const { count } = await tx.sMSCreditsPurchase.updateMany({
      where: { id: purchase.id, status: { not: 'success' } },
      data: { status: 'success', paidAt: new Date(paidAt), paystackResponse: paystackResponse as Prisma.InputJsonValue },
    });
    if (count !== 1) return false;

    const balance = await tx.sMSCreditBalance.upsert({
      where: { associationId: purchase.associationId },
      create: { associationId: purchase.associationId, balance: purchase.credits, totalPurchased: purchase.credits, totalUsed: 0, lastTopUpAt: new Date() },
      update: { balance: { increment: purchase.credits }, totalPurchased: { increment: purchase.credits }, lastTopUpAt: new Date() },
    });
    await tx.sMSCreditTransaction.create({
      data: { balanceId: balance.id, type: 'PURCHASE', amount: purchase.credits, description: `Bought ${purchase.credits} SMS credits`, reference: purchase.reference },
    });
    await tx.auditLog.create({
      data: {
        associationId: purchase.associationId,
        userId: purchase.userId,
        action: 'SMS_CREDITS_ADDED',
        tableName: 'sms_credit_balances',
        newValues: { reference: purchase.reference, credits: purchase.credits, amount: purchase.amount.toNumber(), status: 'success' },
      },
    });
    return true;
  });

  // Ajo receipts that were queued while the credits ran out can go now. Best effort, after the purchase has committed: whether this works
  // or not never changes the answer above. (Loaded on demand so the text-message engine does not depend on Ajo at start-up.)
  if (credited) {
    void import('../ajo/ajo-receipt.service')
      .then((m) => m.flushQueuedReceipts({ associationId: purchase.associationId }))
      .catch((error) => console.error('[sms] could not send queued Ajo receipts after a top-up (non-critical):', error instanceof Error ? error.message : 'unknown error'));
  }
  return credited;
}

// ---------------------------------------------------------------- sending

/**
 * Reserves the credits and records every text as pending, together: either both happen or neither does. Then sends them. For a big
 * audience that happens in the background; the returned `done` resolves when it has finished.
 */
export async function dispatchMessages(input: DispatchInput): Promise<DispatchResult> {
  const { associationId, recipients, text, segments } = input;
  const credits = recipients.length * segments;

  const messageIds = await prisma.$transaction(async (tx) => {
    await reserveCredits(tx, associationId, credits, input.description, { campaignId: input.campaignId });
    const created = await tx.sMSMessage.createManyAndReturn({
      data: recipients.map((r) => ({
        associationId,
        campaignId: input.campaignId,
        announcementId: input.announcementId,
        recipientPhone: r.phone,
        recipientName: r.name,
        memberId: r.memberId,
        message: text,
        messageType: input.messageType,
        status: 'PENDING' as const,
        segments,
      })),
      select: { id: true },
    });
    return created.map((c) => c.id);
  });

  const done = deliver({ ...input, messageIds }).catch((error) => {
    // Nothing here can reach the officer any more, so it is logged; the recovery job gives back whatever was left pending.
    console.error(`[sms] delivery failed for association ${associationId}:`, error);
    return { sent: 0, failed: 0, refunded: 0 } as DeliveryTotals;
  });

  if (input.inline) await done;
  return { accepted: messageIds.length, credits, messageIds, done };
}

async function campaignCancelled(campaignId?: number): Promise<boolean> {
  if (!campaignId) return false;
  const campaign = await prisma.sMSCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  return campaign?.status === 'CANCELLED';
}

async function deliver(input: DispatchInput & { messageIds: number[] }): Promise<DeliveryTotals> {
  const { associationId, messageIds, campaignId, announcementId } = input;
  const send: Sender = input.send ?? providerSend;

  const rows = await prisma.sMSMessage.findMany({ where: { id: { in: messageIds }, status: 'PENDING' }, select: { id: true, recipientPhone: true, message: true }, orderBy: { id: 'asc' } });

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);

    // A campaign cancelled part-way stops here: what has not gone out is marked and its credits go back.
    if (await campaignCancelled(campaignId)) {
      await prisma.sMSMessage.updateMany({ where: { id: { in: rows.slice(i).map((r) => r.id) }, status: 'PENDING' }, data: { status: 'FAILED', errorMessage: 'Cancelled before it was sent' } });
      failed += rows.length - i;
      break;
    }

    const results = await Promise.all(
      chunk.map(async (row) => {
        let result: SMSSendResult;
        try {
          result = await send({ to: row.recipientPhone, message: row.message });
        } catch (error) {
          result = { success: false, message: 'Failed', error: error instanceof Error ? error.message : 'The provider could not be reached' };
        }
        // Guarded on pending: a recovery job that already gave up on this text keeps the last word, so it is never refunded and sent.
        await prisma.sMSMessage.updateMany({
          where: { id: row.id, status: 'PENDING' },
          data: result.success
            ? { status: 'SENT', termiiMessageId: result.messageId, sentAt: new Date() }
            : { status: 'FAILED', errorMessage: result.error ?? result.message ?? 'Failed' },
        });
        return result.success;
      }),
    );

    const chunkSent = results.filter(Boolean).length;
    sent += chunkSent;
    failed += results.length - chunkSent;

    if (campaignId) {
      await prisma.sMSCampaign.update({ where: { id: campaignId }, data: { sentCount: { increment: chunkSent }, failedCount: { increment: results.length - chunkSent } } });
    }
  }

  const refunded = await refundFailed(associationId, messageIds, `Refund for texts that did not go out — ${input.description}`, campaignId);

  if (campaignId) {
    await prisma.sMSCampaign.updateMany({ where: { id: campaignId, status: 'IN_PROGRESS' }, data: { status: 'COMPLETED', completedAt: new Date() } });
  }
  if (announcementId) {
    await prisma.announcement.update({
      where: { id: announcementId },
      data: { smsSent: sent, smsFailed: failed, creditsUsed: sent * input.segments, status: 'COMPLETED', completedAt: new Date() },
    });
  }

  return { sent, failed, refunded };
}

// ---------------------------------------------------------------- delivery reports

/** What the provider's status word means for us. Anything that isn't a final answer (queued, sent) is ignored: "Sent" stays "Sent". */
export function mapProviderStatus(raw: string | undefined | null): 'DELIVERED' | 'FAILED' | null {
  const status = (raw ?? '').trim().toLowerCase();
  if (['delivered', 'delivrd', 'success', 'successful'].includes(status)) return 'DELIVERED';
  // Termii's words: "Message Failed", "DND Active on Phone Number", "Rejected", "Expired"
  if (['failed', 'message failed', 'undelivered', 'undeliv', 'rejected', 'rejectd', 'expired', 'dnd', 'dnd active on phone number', 'blocked'].includes(status)) return 'FAILED';
  return null;
}

/**
 * Applies a delivery report from the provider to the text it is about. A text is only "Delivered" when the carrier says so; one the
 * carrier couldn't deliver is marked failed and its credit is given back. Reports can arrive twice or out of order, so each change
 * is claimed from the state it expects and applied once.
 */
export async function applyDeliveryReport(providerMessageId: string, rawStatus: string): Promise<{ applied: boolean }> {
  const outcome = mapProviderStatus(rawStatus);
  if (!outcome || !providerMessageId) return { applied: false };

  const message = await prisma.sMSMessage.findFirst({ where: { termiiMessageId: providerMessageId }, select: { id: true, associationId: true, campaignId: true } });
  if (!message) return { applied: false };

  if (outcome === 'DELIVERED') {
    const { count } = await prisma.sMSMessage.updateMany({ where: { id: message.id, status: 'SENT' }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    if (count === 1 && message.campaignId) await prisma.sMSCampaign.update({ where: { id: message.campaignId }, data: { deliveredCount: { increment: 1 } } });
    return { applied: count === 1 };
  }

  const { count } = await prisma.sMSMessage.updateMany({ where: { id: message.id, status: 'SENT' }, data: { status: 'FAILED', errorMessage: 'The carrier could not deliver it' } });
  if (count !== 1) return { applied: false };
  await refundFailed(message.associationId, [message.id], 'Refund for a text the carrier could not deliver', message.campaignId ?? undefined);
  if (message.campaignId) await prisma.sMSCampaign.update({ where: { id: message.campaignId }, data: { sentCount: { decrement: 1 }, failedCount: { increment: 1 } } });
  return { applied: true };
}

// ---------------------------------------------------------------- after a restart

/**
 * A server that stops mid-send leaves texts pending for ever. This finds the ones that have been pending too long, marks them failed
 * ("interrupted"), gives their credits back, and marks the campaign or announcement they belonged to as interrupted.
 */
export async function recoverInterruptedSends(olderThanMinutes = STALE_MINUTES): Promise<{ messages: number; credits: number }> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const stale = await prisma.sMSMessage.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true, associationId: true, campaignId: true, announcementId: true },
  });
  if (stale.length === 0) return { messages: 0, credits: 0 };

  await prisma.sMSMessage.updateMany({ where: { id: { in: stale.map((s) => s.id) }, status: 'PENDING' }, data: { status: 'FAILED', errorMessage: 'Interrupted by a server restart' } });

  let credits = 0;
  const byAssociation = new Map<number, number[]>();
  for (const s of stale) byAssociation.set(s.associationId, [...(byAssociation.get(s.associationId) ?? []), s.id]);
  for (const [associationId, ids] of byAssociation) credits += await refundFailed(associationId, ids, 'Refund for texts interrupted by a server restart');

  for (const campaignId of new Set(stale.map((s) => s.campaignId).filter((x): x is number => !!x))) {
    const [sent, failed] = await Promise.all([
      prisma.sMSMessage.count({ where: { campaignId, status: { in: ['SENT', 'DELIVERED'] } } }),
      prisma.sMSMessage.count({ where: { campaignId, status: { in: ['FAILED', 'REJECTED'] } } }),
    ]);
    await prisma.sMSCampaign.updateMany({ where: { id: campaignId, status: 'IN_PROGRESS' }, data: { status: 'INTERRUPTED', completedAt: new Date(), sentCount: sent, failedCount: failed } });
  }

  for (const announcementId of new Set(stale.map((s) => s.announcementId).filter((x): x is number => !!x))) {
    const [sent, failed] = await Promise.all([
      prisma.sMSMessage.count({ where: { announcementId, status: { in: ['SENT', 'DELIVERED'] } } }),
      prisma.sMSMessage.count({ where: { announcementId, status: { in: ['FAILED', 'REJECTED'] } } }),
    ]);
    const segments = (await prisma.sMSMessage.findFirst({ where: { announcementId }, select: { segments: true } }))?.segments ?? 1;
    await prisma.announcement.updateMany({ where: { id: announcementId, status: 'SENDING' }, data: { status: 'INTERRUPTED', completedAt: new Date(), smsSent: sent, smsFailed: failed, creditsUsed: sent * segments } });
  }

  return { messages: stale.length, credits };
}
