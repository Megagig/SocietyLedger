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
