/** Officer side of `/payments/nigerian/proofs` — verified against nigerian-payments.controller/service + payment-proof-decision.ts (2026-10-24). */
import type { IsoDateString, MoneyValue } from './common';
import type { PaymentProofDTO } from './nigerianPayments';

export type ProofStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type ProofMember = { id: number; memberId: string; firstName: string; lastName: string; photoUrl?: string | null; thumbUrl?: string | null };

/**
 * GET /payments/nigerian/proofs (needs payments.view). The storage key is never sent — `hasFile` says whether a receipt is
 * attached, and the file itself comes from the file-url endpoint.
 */
export type ProofListItemDTO = Omit<PaymentProofDTO, 'filepath' | 'status'> & {
  status: ProofStatus;
  hasFile: boolean;
  member: ProofMember;
  transaction: { id: number; referenceNumber: string | null; amount: MoneyValue; status: string } | null;
  bankTransfer: { id: number; reference: string | null; amount: MoneyValue } | null;
};

export type ProofListDTO = {
  proofs: ProofListItemDTO[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
};

/** One charge a proof asks to settle, with what has been paid so far. `balance` is what approving will record for it (0 when voided, waived or settled). */
export type DeclaredItemDTO = {
  id: number;
  referenceNumber: string | null;
  category: { id: number; name: string; type: string };
  dueDate: IsoDateString | null;
  status: string;
  isVoided: boolean;
  amount: MoneyValue;
  paid: MoneyValue;
  balance: MoneyValue;
};

/** GET /payments/nigerian/proofs/:id */
export type ProofDetailDTO = Omit<ProofListItemDTO, 'member'> & {
  member: ProofMember & { email: string | null; phone: string | null; userId: number | null };
  declaredItems: DeclaredItemDTO[];
  /** What approving records in total: the declared charges' remaining balances, summed. */
  declaredBalance: MoneyValue;
};

/** GET /payments/nigerian/proofs/:id/file-url — a short-lived signed link. */
export type ProofFileLinkDTO = {
  url: string;
  filename: string | null;
  mimeType: string | null;
  expiresInSeconds: number;
};

export type ProofDecisionPayload = { status: 'APPROVED' } | { status: 'REJECTED'; rejectionReason: string };

export type ProofListParams = { status: ProofStatus; page: number; limit: number };
