import { memberLedgerService } from '../member-finance/member-ledger.service';

/**
 * Puts a newly created charge on the member's ledger as what they owe. Every path that creates a charge must do this, or a later
 * payment shows up alone as a credit and the member's balance goes negative. Best-effort: a ledger problem never blocks creating the charge
 * (an officer can rebuild a member's ledger from their charges and payments).
 */
export async function syncLedgerDebit(transactionId: number, userId: number): Promise<void> {
  try {
    await memberLedgerService.createFromTransaction(transactionId, userId);
  } catch (error) {
    console.error(`Ledger sync failed for transaction ${transactionId} (non-critical):`, error);
  }
}
