import { prisma } from '../lib/prisma';
import { accountingIntegrationService } from './accounting-integration.service';
import { memberLedgerService } from '../modules/member-finance/member-ledger.service';
import { cacheInvalidationService } from './cache-invalidation.service';

/**
 * What must follow a payment row being written, whichever way the money arrived (card, bank transfer, cash, a proof an officer approved):
 *   1. the credit on the member's ledger, so what they owe goes down, and
 *   2. the books: cash or bank up, the receivable cleared.
 *
 * Every route that records a payment calls this one function, so none of them can leave out half of it again (the card and Nomba routes
 * used to skip the ledger, and Nomba skipped the books too). Both steps are safe to repeat: a payment already on the ledger or in the books
 * is left alone. Best-effort: a sync problem is logged and never undoes the payment; the repair that runs on every start picks it up.
 */
export async function syncPaymentEffects(payment: { paymentId?: number; receiptNumber?: string | null; associationId?: number }, userId: number): Promise<void> {
  let paymentId = payment.paymentId;
  try {
    if (!paymentId && payment.receiptNumber) {
      const found = await prisma.payment.findFirst({
        where: { receiptNumber: payment.receiptNumber, ...(payment.associationId ? { associationId: payment.associationId } : {}) },
        select: { id: true },
      });
      paymentId = found?.id;
    }
    if (!paymentId) return;

    const full = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        transaction: {
          include: {
            member: { select: { id: true, memberId: true, firstName: true, lastName: true, userId: true } },
            category: { select: { id: true, name: true, type: true } },
          },
        },
      },
    });
    if (!full) return;

    try {
      // The charge should already be on the ledger; make sure, so the payment never lands alone as a credit.
      await memberLedgerService.createFromTransaction(full.transactionId, userId);
      await memberLedgerService.createFromPayment(full.id, userId);
    } catch (error) {
      console.error(`Ledger sync failed for payment ${full.id} (non-critical):`, error);
    }
    try {
      await accountingIntegrationService.onPaymentRecorded(full, userId);
    } catch (error) {
      console.error(`Accounting sync failed for payment ${full.id} (non-critical):`, error);
    }
    // The dashboard and reports add payments up and are cached. Clear them now the money has landed, for every route that gets here
    // (card webhooks, Nomba, cash, an approved proof), so a figure is never older than the payment behind it.
    try {
      await cacheInvalidationService.onPaymentChange(full.associationId);
    } catch (error) {
      console.error(`Cache invalidation failed for payment ${full.id} (non-critical):`, error);
    }
  } catch (error) {
    console.error('Payment sync failed (non-critical):', error);
  }
}
