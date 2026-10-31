/**
 * Receipts for contributions (T4.4): exactly one per contribution per moment, to the channel that reaches the person, never silently lost.
 *
 * "Exactly one" is a database fact, not a hope: `ajo_receipts` has a unique key on (contribution, moment), and a receipt row is created in
 * the same transaction as the change it reports, so a repeated request finds the row already there and sends nothing more.
 *
 * Channels follow the person. Someone with a login gets an in-app notice, a push and an email according to their own notification
 * preferences, which cost nothing. Someone with no login (a market contributor recorded by a collector) can only be reached by SMS, which
 * costs the group a credit, so they are texted when a payment is recorded and when something goes wrong, but not for a routine
 * confirmation (see `smsForMoment`).
 *
 * When SMS credits run out the receipt is queued, not dropped, and the group's officers are told once. Queued receipts are sent when
 * credits arrive, when an officer asks, or when another text succeeds.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { dispatchNotification } from '../../services/notification-preferences.service';
import { RuleError } from '../finance/rule-error';
import { dispatchMessages, type DispatchInput } from '../sms/sms-engine';
import { normalizePhone, smsSegments } from '../sms/sms-rules';
import { receiptMessage, smsForMoment, type ReceiptFacts, type ReceiptMoment } from './ajo-collections';
import { notifyPermissionHolders } from './ajo-support';

type Tx = Prisma.TransactionClient;

export const MAX_ATTEMPTS = 5;
const FLUSH_LIMIT = 50;

/**
 * Write the receipt row inside the transaction that made the change. `skipDuplicates` turns a second attempt into a no-op without
 * aborting the surrounding transaction. Returns the id, and whether this call created it.
 */
export async function createReceiptInTx(tx: Tx, input: { associationId: number; contributionId: number; facts: ReceiptFacts }): Promise<{ id: number; created: boolean }> {
  const { message } = receiptMessage(input.facts);
  const made = await tx.ajoReceipt.createMany({ data: [{ associationId: input.associationId, contributionId: input.contributionId, moment: input.facts.moment, message }], skipDuplicates: true });
  const row = await tx.ajoReceipt.findUniqueOrThrow({ where: { contributionId_moment: { contributionId: input.contributionId, moment: input.facts.moment } }, select: { id: true } });
  return { id: row.id, created: made.count === 1 };
}

export interface DeliverOptions {
  /** For tests: stands in for the SMS provider. */
  send?: DispatchInput['send'];
}

/**
 * Tell the contributor. Safe to call any number of times: a receipt already sent is left alone, and two calls at the same moment cannot both
 * send (the attempt counter is claimed first). Never throws: a receipt that cannot be delivered is recorded as queued or failed.
 */
export async function deliverReceipt(receiptId: number, options: DeliverOptions = {}): Promise<{ state: string; channels: Record<string, boolean> }> {
  try {
    const receipt = await prisma.ajoReceipt.findUnique({
      where: { id: receiptId },
      include: { contribution: { include: { membership: { include: { member: { select: { id: true, userId: true, firstName: true, lastName: true, phone: true } } } } } } },
    });
    if (!receipt) return { state: 'MISSING', channels: {} };
    if (receipt.state === 'SENT' || receipt.state === 'SKIPPED') return { state: receipt.state, channels: (receipt.channels as Record<string, boolean> | null) ?? {} };

    // Whoever moves the attempt counter on from the value they read is the only one who sends.
    const claimed = await prisma.ajoReceipt.updateMany({ where: { id: receipt.id, state: { in: ['QUEUED', 'FAILED'] }, attempts: receipt.attempts }, data: { attempts: receipt.attempts + 1 } });
    if (claimed.count !== 1) return { state: receipt.state, channels: {} };

    const moment = receipt.moment as ReceiptMoment;
    const member = receipt.contribution.membership.member;
    const title = receiptTitle(moment);

    if (member.userId) {
      const sent = await dispatchNotification({
        associationId: receipt.associationId,
        userId: member.userId,
        kind: 'payment_received',
        title,
        message: receipt.message,
        entityId: receipt.contribution.id,
        pushType: 'ajo.receipt',
        sendEmail: true,
        emailSubject: title,
      });
      const channels = { inApp: sent.inAppCreated, email: sent.emailSent, sms: false };
      await markState(receipt.id, 'SENT', channels);
      return { state: 'SENT', channels };
    }

    // No login: SMS is the only way to reach them.
    if (!smsForMoment(moment)) {
      await markState(receipt.id, 'SKIPPED', { inApp: false, email: false, sms: false });
      return { state: 'SKIPPED', channels: {} };
    }
    const phone = normalizePhone(member.phone);
    if (!phone) {
      await prisma.ajoReceipt.update({ where: { id: receipt.id }, data: { state: 'FAILED', lastError: 'NO_PHONE' } });
      return { state: 'FAILED', channels: {} };
    }

    try {
      const dispatched = await dispatchMessages({
        associationId: receipt.associationId,
        description: 'Ajo receipt',
        recipients: [{ phone, name: `${member.firstName} ${member.lastName}`.trim(), memberId: member.id }],
        text: receipt.message,
        segments: smsSegments(receipt.message),
        messageType: 'SINGLE',
        inline: true,
        send: options.send,
      });
      const totals = await dispatched.done;
      if (totals.sent < 1) return await queueAgain(receipt.id, receipt.attempts + 1, 'SMS_NOT_DELIVERED');
      await markState(receipt.id, 'SENT', { inApp: false, email: false, sms: true });
      return { state: 'SENT', channels: { sms: true } };
    } catch (error) {
      if (error instanceof RuleError && error.code === 'INSUFFICIENT_CREDITS') {
        await prisma.ajoReceipt.update({ where: { id: receipt.id }, data: { state: 'QUEUED', lastError: 'NO_SMS_CREDITS' } });
        await alertOnce(receipt.associationId, receipt.id);
        return { state: 'QUEUED', channels: {} };
      }
      return await queueAgain(receipt.id, receipt.attempts + 1, error instanceof Error ? error.message.slice(0, 200) : 'SEND_ERROR');
    }
  } catch (error) {
    // A receipt must never break the payment it describes.
    console.error('[ajo] receipt delivery failed (non-critical):', error instanceof Error ? error.message : 'unknown error');
    return { state: 'ERROR', channels: {} };
  }
}

const TITLES: Record<ReceiptMoment, string> = {
  RECORDED: 'Payment received',
  CONFIRMED: 'Payment confirmed',
  REJECTED: 'Payment not accepted',
  MISSING: 'Payment still being checked',
  REVERSED: 'Payment reversed',
};
const receiptTitle = (moment: ReceiptMoment) => TITLES[moment];

async function markState(id: number, state: 'SENT' | 'SKIPPED', channels: Record<string, boolean>) {
  await prisma.ajoReceipt.update({ where: { id }, data: { state, channels, sentAt: state === 'SENT' ? new Date() : null, lastError: null } });
}

/** A try that did not work out: keep it queued for another go, or mark it failed once it has been tried enough times. */
async function queueAgain(id: number, attempts: number, error: string) {
  const state = attempts >= MAX_ATTEMPTS ? 'FAILED' : 'QUEUED';
  await prisma.ajoReceipt.update({ where: { id }, data: { state, lastError: error } });
  return { state, channels: {} as Record<string, boolean> };
}

/**
 * Tell the group's officers that receipts are waiting for SMS credits, once. If any queued receipt has already raised the alert, this
 * one stays quiet; when the queue empties and later fills again, the next shortage raises a fresh alert.
 */
async function alertOnce(associationId: number, receiptId: number): Promise<void> {
  const already = await prisma.ajoReceipt.findFirst({ where: { associationId, state: 'QUEUED', alertedAt: { not: null } }, select: { id: true } });
  if (already) return;
  const marked = await prisma.ajoReceipt.updateMany({ where: { id: receiptId, alertedAt: null }, data: { alertedAt: new Date() } });
  if (marked.count !== 1) return;
  await notifyPermissionHolders(associationId, 'ajo.manage', {
    pushType: 'ajo.receipts_waiting',
    title: 'Receipts are waiting for SMS credits',
    message: 'Some contributors could not be texted their receipts because the SMS credits ran out. Buy credits and the receipts will be sent, or press "send queued receipts".',
  });
}

/** Send what is waiting, oldest first, for one association. Stops at the first shortage of credits instead of trying every one. */
export async function flushQueuedReceipts(input: { associationId: number; limit?: number; send?: DispatchInput['send'] }): Promise<{ attempted: number; sent: number; stillQueued: number }> {
  const queued = await prisma.ajoReceipt.findMany({ where: { associationId: input.associationId, state: 'QUEUED' }, orderBy: { id: 'asc' }, take: input.limit ?? FLUSH_LIMIT, select: { id: true } });
  let sent = 0;
  let attempted = 0;
  for (const { id } of queued) {
    attempted++;
    const result = await deliverReceipt(id, { send: input.send });
    if (result.state === 'SENT') sent++;
    else if (result.state === 'QUEUED') break;
  }
  const stillQueued = await prisma.ajoReceipt.count({ where: { associationId: input.associationId, state: 'QUEUED' } });
  return { attempted, sent, stillQueued };
}

/** Receipts for one payment, for the officer's view and the contributor's own history. */
export async function listReceipts(input: { associationId: number; contributionId: number }) {
  const rows = await prisma.ajoReceipt.findMany({ where: { associationId: input.associationId, contributionId: input.contributionId }, orderBy: { id: 'asc' } });
  return rows.map((r) => ({ id: r.id, moment: r.moment, state: r.state, message: r.message, channels: r.channels, sentAt: r.sentAt, queuedForCredits: r.state === 'QUEUED' && r.lastError === 'NO_SMS_CREDITS' }));
}

/** How many receipts in the association are waiting, so the officer's screen can say that someone has not been told. */
export async function queuedReceiptCount(associationId: number): Promise<number> {
  return prisma.ajoReceipt.count({ where: { associationId, state: 'QUEUED' } });
}
