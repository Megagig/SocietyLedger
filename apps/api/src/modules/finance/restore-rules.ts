import { prisma } from '../../lib/prisma';
import { memberLedgerService } from '../member-finance/member-ledger.service';
import { syncLedgerDebit } from './ledger-sync';
import { cacheInvalidationService } from '../../services/cache-invalidation.service';

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
  for (const payment of created) {
    try {
      await memberLedgerService.createFromPayment(payment.id, userId);
    } catch (error) {
      console.error(`Ledger sync failed for restored payment ${payment.id} (non-critical):`, error);
    }
  }
  await cacheInvalidationService.onPaymentChange(associationId).catch((e) => console.error('Cache invalidation failed (non-critical):', e));
}
