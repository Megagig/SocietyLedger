/** Nigerian payments — real base path `/api/payments/nigerian` (tenant required) — api-contract.md §6. */
import type { PaymentProofStatus } from './enums';
import type { IsoDateString } from './common';

/**
 * Raw `PaymentProof` row — verified against schema.prisma + proofs.controller.ts (2026-10-19).
 * Exactly one of (`filename` set) or (`declarationNote` set) is required by application code,
 * not the DB — both are nullable here because either combination is valid.
 */
export type PaymentProofDTO = {
  id: number;
  associationId: number;
  transactionId: number | null;
  transactionIds: number[];
  bankTransferId: number | null;
  memberId: number;
  filename: string | null;
  filepath: string | null;
  fileSize: number | null;
  mimeType: string | null;
  declarationNote: string | null;
  paymentMethod: string | null;
  status: PaymentProofStatus;
  uploadedAt: IsoDateString;
  verifiedBy: number | null;
  verifiedAt: IsoDateString | null;
  rejectionReason: string | null;
  notes: string | null;
};

/**
 * POST /payments/nigerian/proofs — verified 2026-10-19. Multipart; multer field name is
 * exactly `file` (not `attachment`/`proof`). A bad mimetype's error response is NOT confirmed
 * JSON-wrapped — treat as a possible non-JSON/500 response until verified live (F2.9).
 */
export type SubmitProofRequestDTO = {
  transactionId?: number;
  bankTransferId?: number;
  /** JSON-encoded array string on the wire, e.g. '[12,13]' — encode/decode at the api/endpoints layer. */
  transactionIds?: string;
  paymentMethod?: string;
  declarationNote?: string;
  notes?: string;
};

export type SubmitProofResponseDTO = PaymentProofDTO;

/** GET /payments/nigerian/bank-accounts — officer-only (SETTINGS_VIEW), NOT member-safe. Use memberFinance.ts's MemberBankAccountDTO for the member-facing equivalent. */
export type AssociationBankAccountDTO = {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
  isActive: boolean;
};

export type BankAccountsResponseDTO = {
  bankAccounts: AssociationBankAccountDTO[];
};
