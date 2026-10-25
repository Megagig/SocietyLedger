/**
 * Mobile push notification sending (F0.2).
 *
 * One Expo client; chunked sends; a 15-min receipt-check job that disables
 * device tokens Expo reports as `DeviceNotRegistered`. Every public function
 * here is fire-and-forget from the caller's point of view — a push failure
 * must never fail the request/job that triggered the underlying
 * notification, so every error is caught and logged, never re-thrown.
 *
 * Ticket IDs returned by a send are kept in an in-memory queue for the
 * receipt job to check minutes later (Expo retains receipts for ~a day).
 * This queue is deliberately not persisted: on a server restart, a handful
 * of very recent tickets simply go unchecked — the same best-effort
 * tradeoff already used for email/SMS failures elsewhere in this codebase,
 * not a correctness issue (a dead token just gets caught on its next send).
 */
import cron from 'node-cron';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '../lib/prisma';

const expo = new Expo(
  process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : undefined
);

interface PendingTicket {
  ticketId: string;
  expoPushToken: string;
}

let pendingTickets: PendingTicket[] = [];

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
}

async function disableToken(expoPushToken: string): Promise<void> {
  try {
    await prisma.deviceToken.updateMany({
      where: { expoPushToken },
      data: { disabledAt: new Date() },
    });
  } catch (error) {
    console.error('[push.service] failed to disable token:', error);
  }
}

/**
 * Sends one push message to every still-enabled device token registered for
 * the given users. Never throws.
 */
export async function sendPushToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId: { in: userIds }, disabledAt: null },
      select: { expoPushToken: true },
    });
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.expoPushToken))
      .map((t) => ({
        to: t.expoPushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        channelId: payload.channelId ?? 'default',
        sound: 'default',
      }));
    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          const to = chunk[i]?.to;
          const expoPushToken = typeof to === 'string' ? to : undefined;
          if (ticket.status === 'ok') {
            if (expoPushToken) {
              pendingTickets.push({ ticketId: ticket.id, expoPushToken });
            }
          } else {
            console.error('[push.service] send error:', ticket.message, ticket.details);
            if (ticket.details?.error === 'DeviceNotRegistered' && expoPushToken) {
              void disableToken(expoPushToken);
            }
          }
        });
      } catch (error) {
        console.error('[push.service] chunk send failed:', error);
      }
    }
  } catch (error) {
    console.error('[push.service] sendPushToUsers failed:', error);
  }
}

/** Checks receipts for every ticket queued since the last run; disables dead tokens. */
export async function checkPushReceipts(): Promise<void> {
  if (pendingTickets.length === 0) return;
  const batch = pendingTickets;
  pendingTickets = [];

  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(batch.map((t) => t.ticketId));
  for (const chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const receiptId of Object.keys(receipts)) {
        const receipt = receipts[receiptId];
        if (receipt.status === 'error') {
          console.error('[push.service] receipt error:', receipt.message, receipt.details);
          if (receipt.details?.error === 'DeviceNotRegistered') {
            const ticket = batch.find((t) => t.ticketId === receiptId);
            if (ticket) await disableToken(ticket.expoPushToken);
          }
        }
      }
    } catch (error) {
      console.error('[push.service] receipt check failed:', error);
    }
  }
}

// Same pattern as jobs/meeting-jobs.ts: create the scheduled task at module
// load (auto-started), toggle it on/off via start()/stop() at server boot/shutdown.
export const pushReceiptsJob = cron.schedule('*/15 * * * *', () => {
  checkPushReceipts().catch((error) => console.error('[push.service] receipt job error:', error));
});

export function startPushReceiptsJob(): void {
  pushReceiptsJob.start();
}

export function stopPushReceiptsJob(): void {
  pushReceiptsJob.stop();
}

/** Test-only: lets unit tests inspect/reset the in-memory ticket queue. */
export function __getPendingTicketsForTest(): PendingTicket[] {
  return pendingTickets;
}
export function __resetPendingTicketsForTest(): void {
  pendingTickets = [];
}
