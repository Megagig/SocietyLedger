import { prisma } from '../../lib/prisma';
import { dispatchNotification } from '../../services/notification-preferences.service';

/** Whoever can verify a lodgment — the same key the verify endpoint requires. */
export const LODGMENT_VERIFIER_PERMISSION_KEY = 'cash.verify';
const TREASURER_PERMISSION_KEY = 'cash.view';

const naira = (n: number | string) => Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function usersWithPermission(associationId: number, key: string): Promise<number[]> {
  const rows = await prisma.userRole.findMany({
    where: {
      associationId,
      isActive: true,
      user: { isActive: true },
      role: { isActive: true, permissions: { some: { permission: { key } } } },
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  return rows.map((r) => r.userId);
}

/**
 * Tells the member their cash was received (in-app + push, and email when they have an account with an email). Best-effort: a
 * failure never reaches the officer's receipt. Members without an account are simply not notified.
 */
export async function notifyCashReceipt(
  associationId: number,
  receipt: { receiptNumber: string; memberUserId: number | null; memberName: string; receiptId: number; items: Array<{ label: string; amount: number }>; total: number },
): Promise<void> {
  if (!receipt.memberUserId) return;
  try {
    const association = await prisma.association.findUnique({ where: { id: associationId }, select: { name: true } });
    await dispatchNotification({
      associationId,
      userId: receipt.memberUserId,
      kind: 'payment_received',
      entityId: receipt.receiptId,
      pushType: 'cash.receipt',
      title: 'Cash payment received',
      message: `Your cash payment of ₦${naira(receipt.total)} was received (receipt ${receipt.receiptNumber}).`,
      sendEmail: true,
      emailSubject: 'Payment Receipt',
      emailTemplate: 'payment-receipt',
      emailData: {
        memberName: receipt.memberName,
        receiptNumber: receipt.receiptNumber,
        amount: receipt.total,
        categoryName: receipt.items.map((i) => i.label).join(', '),
        paymentMethod: 'Cash',
        paymentDate: new Date().toLocaleDateString(),
        associationName: association?.name || 'Your Association',
      },
    });
  } catch (error) {
    console.error('Cash receipt notification failed (non-critical):', error);
  }
}

/** Tells the member a cash receipt was cancelled, and why, so their balance changing back is not a surprise. */
export async function notifyCashReceiptVoided(
  associationId: number,
  receipt: { receiptId: number; receiptNumber: string; memberUserId: number | null; reason: string },
): Promise<void> {
  if (!receipt.memberUserId) return;
  try {
    await dispatchNotification({
      associationId,
      userId: receipt.memberUserId,
      kind: 'system',
      entityId: receipt.receiptId,
      pushType: 'cash.receipt_voided',
      title: 'Cash receipt cancelled',
      message: `Cash receipt ${receipt.receiptNumber} was cancelled: ${receipt.reason}. Your balance has been put back.`,
    });
  } catch (error) {
    console.error('Cash receipt void notification failed (non-critical):', error);
  }
}

/** Tells the officers who can verify lodgments that one is waiting. The officer who lodged it isn't told about their own. */
export async function notifyLodgmentRecorded(
  associationId: number,
  lodgment: { id: number; lodgedBy: number; amount: number; bankName: string },
): Promise<void> {
  try {
    for (const userId of await usersWithPermission(associationId, LODGMENT_VERIFIER_PERMISSION_KEY)) {
      if (userId === lodgment.lodgedBy) continue;
      try {
        await dispatchNotification({
          associationId,
          userId,
          kind: 'approval',
          entityId: lodgment.id,
          pushType: 'cash.lodgment_pending',
          title: 'Cash lodgment waiting',
          message: `₦${naira(lodgment.amount)} was lodged into ${lodgment.bankName} and needs checking against the bank statement.`,
        });
      } catch (error) {
        console.error(`Lodgment-recorded notification failed for user ${userId} (non-critical):`, error);
      }
    }
  } catch (error) {
    console.error('Lodgment-recorded notification failed (non-critical):', error);
  }
}

/** Tells the officer who lodged how it was decided; a rejection carries the reason so they know what to fix. */
export async function notifyLodgmentDecided(
  associationId: number,
  lodgment: { id: number; lodgedBy: number; status: string; amount: number; rejectionReason?: string | null },
): Promise<void> {
  try {
    const verified = lodgment.status === 'VERIFIED';
    await dispatchNotification({
      associationId,
      userId: lodgment.lodgedBy,
      kind: verified ? 'payment_received' : 'system',
      entityId: lodgment.id,
      pushType: verified ? 'cash.lodgment_verified' : 'cash.lodgment_rejected',
      title: verified ? 'Lodgment verified' : 'Lodgment not accepted',
      message: verified
        ? `Your lodgment of ₦${naira(lodgment.amount)} was matched to the bank statement.`
        : `Your lodgment of ₦${naira(lodgment.amount)} was not accepted${lodgment.rejectionReason ? `: ${lodgment.rejectionReason}` : '.'} The cash is back in your hand to lodge again.`,
    });
  } catch (error) {
    console.error('Lodgment-decision notification failed (non-critical):', error);
  }
}

/** Reminds the collector, and the officers who watch cash, that a closed collection is past its lodgment deadline. */
export async function notifyLodgmentOverdue(
  associationId: number,
  overdue: { collectorUserId: number; collectorName: string; amount: number; days: number },
): Promise<void> {
  try {
    const watchers = new Set<number>([overdue.collectorUserId, ...(await usersWithPermission(associationId, TREASURER_PERMISSION_KEY))]);
    for (const userId of watchers) {
      try {
        await dispatchNotification({
          associationId,
          userId,
          kind: 'system',
          pushType: 'cash.lodgment_overdue',
          title: 'Cash not lodged yet',
          message:
            userId === overdue.collectorUserId
              ? `You have ₦${naira(overdue.amount)} collected ${overdue.days} days ago that is not lodged yet. Please lodge it.`
              : `${overdue.collectorName} still holds ₦${naira(overdue.amount)} collected ${overdue.days} days ago and not yet lodged.`,
        });
      } catch (error) {
        console.error(`Lodgment-overdue notification failed for user ${userId} (non-critical):`, error);
      }
    }
  } catch (error) {
    console.error('Lodgment-overdue notification failed (non-critical):', error);
  }
}
