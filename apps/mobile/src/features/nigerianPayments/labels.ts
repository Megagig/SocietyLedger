import type { BankTransferStatus } from '@/types/api/enums';
import type { ProofListItemDTO, ProofStatus } from '@/types/api/paymentProofsManage';

/** The queue's wording: a proof is "Waiting" for an officer, then "Verified" or "Rejected". */
export const PROOF_STATUS_LABELS: Record<ProofStatus, string> = {
  PENDING: 'Waiting',
  APPROVED: 'Verified',
  REJECTED: 'Rejected',
};

export const PROOF_STATUS_OPTIONS: ProofStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  card: 'Card',
  mobile_money: 'Mobile money',
  cheque: 'Cheque',
  other: 'Other',
};

export function methodLabel(method: string | null | undefined): string {
  if (!method) return 'Not stated';
  return METHOD_LABELS[method] ?? method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' ');
}

export function proofMemberName(proof: Pick<ProofListItemDTO, 'member'>): string {
  return `${proof.member.firstName} ${proof.member.lastName}`.trim();
}

export function isImageMime(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType?.startsWith('image/'));
}

export function isPdfMime(mimeType: string | null | undefined): boolean {
  return mimeType === 'application/pdf';
}

/** How the proof is backed: a receipt file, or the member's written declaration (cash, card, POS and the like). */
export function proofBacking(proof: Pick<ProofListItemDTO, 'hasFile' | 'declarationNote'>): 'file' | 'declaration' | 'none' {
  if (proof.hasFile) return 'file';
  return proof.declarationNote ? 'declaration' : 'none';
}

/** The transfers list's wording: "Waiting" until an officer confirms it, "Matched" once reconciliation has tied it to a charge. */
export const TRANSFER_STATUS_LABELS: Record<BankTransferStatus, string> = {
  PENDING: 'Waiting',
  VERIFIED: 'Verified',
  MATCHED: 'Matched',
  REJECTED: 'Rejected',
};

export const TRANSFER_STATUS_OPTIONS: BankTransferStatus[] = ['PENDING', 'VERIFIED', 'MATCHED', 'REJECTED'];

/** What Verify actually does — said plainly wherever an officer is about to press it. */
export const VERIFY_TRANSFER_EXPLAINER =
  'This confirms the money reached your account. It does not credit the member — do that by verifying their payment proof or matching the transfer in reconciliation.';

/** "0123456789" → "0123 456 789": easier to read out and to check against a statement. */
export function formatAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, '');
  if (digits.length !== 10) return accountNumber;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export function transferMemberName(transfer: { member: { firstName: string; lastName: string } | null }): string | null {
  return transfer.member ? `${transfer.member.firstName} ${transfer.member.lastName}`.trim() : null;
}
