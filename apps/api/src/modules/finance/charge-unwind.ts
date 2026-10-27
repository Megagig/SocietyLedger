import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { memberLedgerService } from '../member-finance/member-ledger.service';

/**
 * After charges (and the payments and donation records that went with them) have been deleted: take them back out of the books and off
 * the members' ledgers. Without this, deleting a charge left its entries behind, so the books and the ledger kept counting money that no
 * longer existed.
 *
 *  - books: every posted entry that came from the deleted charges and payments is reversed with a mirror entry dated today, so a closed
 *    period is never rewritten and the history stays honest;
 *  - ledger: each affected member's ledger is reconciled, which drops the entries whose charge or payment is gone.
 *
 * Call it after the rows are deleted. Best-effort: a problem is logged and never undoes the delete (the repair that runs on every start
 * finishes the job).
 */
export async function unwindDeletedCharges(input: {
  associationId: number;
  userId: number;
  memberIds: number[];
  transactionIds: number[];
  paymentIds: number[];
  reason: string;
  reference: string;
}): Promise<void> {
  try {
    await accountingIntegrationService.reverseEntriesForSources(
      input.associationId,
      input.userId,
      { transactionIds: input.transactionIds, paymentIds: input.paymentIds },
      input.reason,
      input.reference,
    );
  } catch (error) {
    console.error('Reversing the books for deleted charges failed (non-critical):', error);
  }

  for (const memberId of new Set(input.memberIds)) {
    try {
      await memberLedgerService.reconcileMemberLedger(input.associationId, memberId, input.userId);
    } catch (error) {
      console.error(`Ledger clean-up for member ${memberId} failed after a delete (non-critical):`, error);
    }
  }
}
