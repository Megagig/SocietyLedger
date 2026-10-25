import type { CashCollectionStatus, CashItemKind, CashLodgmentStatus, CashPositionDTO } from '@/types/api/cash';

export const COLLECTION_STATUS_LABELS: Record<CashCollectionStatus, string> = {
  OPEN: 'Open',
  CLOSED: 'Closed',
};

/** A lodgment is "Waiting" for a different officer to check it against the bank statement. */
export const LODGMENT_STATUS_LABELS: Record<CashLodgmentStatus, string> = {
  PENDING: 'Waiting',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

export const LODGMENT_STATUS_OPTIONS: CashLodgmentStatus[] = ['PENDING', 'VERIFIED', 'REJECTED'];

export const ITEM_KIND_LABELS: Record<CashItemKind, string> = {
  DUES: 'Dues',
  LEVY: 'Levy',
  SAVINGS: 'Savings',
  WELFARE: 'Welfare',
  DONATION: 'Donation',
  LOAN_REPAYMENT: 'Loan repayment',
};

/** What verifying actually does — said plainly wherever an officer is about to press it. */
export const VERIFY_LODGMENT_EXPLAINER =
  'Check that this amount appears on the bank statement. Verifying moves the cash from the officer’s hand into the bank in the books. You can’t undo it.';

/** What lodging does — shown on the lodge screen so an officer knows why the cash still shows until it is checked. */
export const LODGE_EXPLAINER =
  'Pay the cash into one of your association’s bank accounts first, then record it here with a photo of the deposit slip. Another officer will check it against the bank statement.';

/** "3 days ago" wording for how long cash has waited, e.g. "Closed 4 days ago". */
export function daysWaitingLabel(days: number): string {
  if (days <= 0) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** The one-line story of an officer's cash for the overview: what they hold, what is lodged and waiting. */
export function positionSummary(position: Pick<CashPositionDTO, 'inHand' | 'awaitingCheck'>): string {
  if (position.inHand <= 0 && position.awaitingCheck <= 0) return 'No cash in hand';
  return position.awaitingCheck > 0 ? 'Some of it is lodged and waiting to be checked' : 'Ready to lodge once the collection is closed';
}
