import { prisma } from '../../lib/prisma';
import { syncLedgerDebit } from './ledger-sync';
import { cacheInvalidationService } from '../../services/cache-invalidation.service';
import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { syncPaymentEffects } from '../../services/payment-sync.service';

/** What a deleted charge looked like when it was removed (the audit log keeps the charge with its payments and donation record). */
export interface DeletedCharge {
  payments?: Array<{
    amountPaid: unknown;
    paymentDate: string | Date;
    paymentMethod?: string | null;
    receiptNumber?: string | null;
    confirmedBy?: number | null;
    confirmedAt?: string | Date | null;
  }>;
  donationRecord?: {
    allocationId?: number | null;
    receiptNumber: string;
    donorMessage?: string | null;
    isAnonymous?: boolean;
  } | null;
}

/** The fields to re-create a deleted payment against its restored charge. */
export function paymentRestoreData(associationId: number, transactionId: number, payment: NonNullable<DeletedCharge['payments']>[number]) {
  return {
    associationId,
    transactionId,
    amountPaid: payment.amountPaid as never,
    paymentDate: new Date(payment.paymentDate),
    paymentMethod: payment.paymentMethod ?? null,
    receiptNumber: payment.receiptNumber ?? null,
    confirmedBy: payment.confirmedBy ?? null,
    confirmedAt: payment.confirmedAt ? new Date(payment.confirmedAt) : null,
  };
}

/**
 * Undo of a delete brings the charge back; this brings back what went with it, so a charge that was paid is not restored as
 * "paid" with no payments behind it. Payments and the donation record are re-created, then the member's ledger is brought up to
 * date (best-effort, like everywhere else — an officer can rebuild a ledger).
 */
export async function restoreChargeExtras(associationId: number, restoredTransactionId: number, deleted: DeletedCharge, userId: number): Promise<void> {
  const payments = deleted.payments ?? [];
  const created = [];
  for (const payment of payments) {
    created.push(await prisma.payment.create({ data: paymentRestoreData(associationId, restoredTransactionId, payment) }));
  }
  if (deleted.donationRecord) {
    await prisma.donationRecord.create({
      data: {
        transactionId: restoredTransactionId,
        allocationId: deleted.donationRecord.allocationId ?? null,
        receiptNumber: deleted.donationRecord.receiptNumber,
        donorMessage: deleted.donationRecord.donorMessage ?? null,
        isAnonymous: deleted.donationRecord.isAnonymous ?? false,
      },
    });
  }

  await syncLedgerDebit(restoredTransactionId, userId);
  // Deleting a charge now takes it out of the books, so restoring it puts the charge back in (the payments follow below).
  try {
    const restored = await prisma.transaction.findUnique({
      where: { id: restoredTransactionId },
      include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } }, category: { select: { id: true, name: true, type: true } } },
    });
    if (restored) await accountingIntegrationService.onTransactionCreated(restored, userId);
  } catch (error) {
    console.error(`Accounting sync failed for restored charge ${restoredTransactionId} (non-critical):`, error);
  }
  for (const payment of created) {
    await syncPaymentEffects({ paymentId: payment.id }, userId); // ledger credit and books, safe to repeat
  }
  await cacheInvalidationService.onPaymentChange(associationId).catch((e) => console.error('Cache invalidation failed (non-critical):', e));
}
