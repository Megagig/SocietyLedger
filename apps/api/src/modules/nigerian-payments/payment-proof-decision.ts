import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { memberLedgerService } from '../member-finance/member-ledger.service';
import type { PaymentProofVerification } from './nigerian-payments.types';

export type ProofDecisionErrorCode = 'NOT_FOUND' | 'ALREADY_DECIDED' | 'NOTHING_TO_APPLY' | 'OWN_PROOF';

/** Why a verify / reject was refused — the controller turns each code into the right HTTP status. */
export class ProofDecisionError extends Error {
  constructor(
    public readonly code: ProofDecisionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProofDecisionError';
  }
}

export const PROOF_DECISION_STATUS: Record<ProofDecisionErrorCode, number> = {
  NOT_FOUND: 404,
  ALREADY_DECIDED: 409,
  NOTHING_TO_APPLY: 400,
  OWN_PROOF: 403,
};

/** The charges a proof asks to settle: the member's declared list, or the single charge an officer linked. */
export function targetTransactionIds(proof: { transactionIds: number[]; transactionId: number | null }): number[] {
  if (proof.transactionIds.length > 0) return proof.transactionIds;
  return proof.transactionId ? [proof.transactionId] : [];
}

/**
 * Decides a payment proof, once.
 *
 *  - Only a PENDING proof can be decided. The status change is claimed atomically (`updateMany … status: PENDING`), so a
 *    double tap, two officers at once, or a rejected proof being approved later all fail with ALREADY_DECIDED instead of
 *    recording a payment twice.
 *  - An officer can't decide a proof they submitted themselves.
 *  - Approving needs something to apply: a proof with no charges and no linked transfer would record nothing.
 *  - On approval each declared charge that still has a balance is paid in full (all-or-nothing — a mismatch is a rejection
 *    with a reason). Voided or waived charges, and ones already settled another way, are skipped, never paid twice.
 *
 * Accounting syncs run after the database transaction commits and never undo an approval.
 */
export async function decidePaymentProof(id: number, associationId: number, userId: number, verification: PaymentProofVerification) {
  const accountingSyncs: (() => Promise<void>)[] = [];

  const proof = await prisma.$transaction(async (tx) => {
    const existing = await tx.paymentProof.findFirst({
      where: { id, associationId },
      include: { member: { select: { userId: true } } },
    });
    if (!existing) throw new ProofDecisionError('NOT_FOUND', 'Payment proof not found');
    if (existing.status !== 'PENDING') {
      throw new ProofDecisionError('ALREADY_DECIDED', `This proof was already ${existing.status.toLowerCase()}. It can't be decided again.`);
    }
    if (existing.member.userId === userId) {
      throw new ProofDecisionError('OWN_PROOF', "You can't verify or reject a payment proof you submitted yourself. Ask another officer.");
    }

    const targetIds = targetTransactionIds(existing);
    if (verification.status === 'APPROVED' && targetIds.length === 0 && !existing.bankTransferId) {
      throw new ProofDecisionError('NOTHING_TO_APPLY', "This proof isn't linked to any charge, so approving it would record no payment. Reject it with a reason instead.");
    }

    const claimed = await tx.paymentProof.updateMany({
      where: { id, associationId, status: 'PENDING' },
      data: {
        status: verification.status,
        verifiedBy: userId,
        verifiedAt: new Date(),
        rejectionReason: verification.rejectionReason,
        notes: verification.notes,
      },
    });
    if (claimed.count === 0) {
      throw new ProofDecisionError('ALREADY_DECIDED', "This proof was just decided by someone else. It can't be decided again.");
    }

    if (verification.status === 'APPROVED') {
      const transactions = await tx.transaction.findMany({
        where: { id: { in: targetIds }, associationId, memberId: existing.memberId, isVoided: false },
        include: { payments: { select: { amountPaid: true } } },
      });

      for (const txn of transactions) {
        if (txn.status === 'waived') continue;
        const alreadyPaid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
        const balance = new Decimal(txn.amount).minus(alreadyPaid);
        if (balance.lessThanOrEqualTo(0)) continue;

        const paymentCount = await tx.payment.count({ where: { associationId } });
        const payment = await tx.payment.create({
          data: {
            associationId,
            transactionId: txn.id,
            amountPaid: balance,
            paymentDate: new Date(),
            paymentMethod: existing.paymentMethod || 'bank_transfer',
            receiptNumber: `RCP${String(paymentCount + 1).padStart(6, '0')}`,
            confirmedBy: userId,
            confirmedAt: new Date(),
          },
          include: {
            transaction: {
              include: {
                member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
                category: { select: { id: true, name: true, type: true } },
              },
            },
          },
        });

        await tx.transaction.update({
          where: { id: txn.id },
          data: { status: 'paid', paymentDate: new Date(), paymentMethod: existing.paymentMethod || 'bank_transfer' },
        });
        await tx.levyCampaignAssignment.updateMany({ where: { transactionId: txn.id }, data: { status: 'paid' } });

        accountingSyncs.push(() => accountingIntegrationService.onPaymentRecorded(payment, userId));
        accountingSyncs.push(() => memberLedgerService.createFromPayment(payment.id, userId).then(() => {}));
      }

      if (existing.bankTransferId) {
        await tx.bankTransfer.update({
          where: { id: existing.bankTransferId },
          data: { status: 'VERIFIED', verifiedBy: userId, verifiedAt: new Date() },
        });
      }
    }

    return tx.paymentProof.findUniqueOrThrow({
      where: { id },
      include: { transaction: true, bankTransfer: true, member: { select: { id: true, userId: true, memberId: true, firstName: true, lastName: true } } },
    });
  });

  for (const sync of accountingSyncs) {
    try {
      await sync();
    } catch (syncError) {
      console.error('Accounting sync failed (non-critical):', syncError);
    }
  }

  return proof;
}
