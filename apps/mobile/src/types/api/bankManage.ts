/** Officer side of `/payments/nigerian/bank-transfers` and `/bank-accounts` — verified against nigerian-payments controller/service + bank-rules.ts (2026-10-24). */
import type { BankTransferStatus } from './enums';
import type { IsoDateString, MoneyValue } from './common';

type TransferMember = { id: number; memberId: string; firstName: string; lastName: string };

/** A proof linked to a transfer. The storage key is never sent — `hasFile` says whether a receipt is attached. */
export type TransferProofDTO = {
  id: number;
  filename: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  uploadedAt: IsoDateString;
  hasFile: boolean;
};

/** GET /payments/nigerian/bank-transfers (needs payments.view). */
export type BankTransferListItemDTO = {
  id: number;
  associationId: number;
  transactionId: number | null;
  bankAccountId: number | null;
  memberId: number | null;
  senderBankName: string;
  senderAccountNumber: string | null;
  senderAccountName: string | null;
  amount: MoneyValue;
  reference: string;
  transferDate: IsoDateString;
  narration: string | null;
  status: BankTransferStatus;
  verifiedBy: number | null;
  verifiedAt: IsoDateString | null;
  notes: string | null;
  createdAt: IsoDateString;
  transaction: { id: number; referenceNumber: string | null; amount: MoneyValue; status: string } | null;
  member: TransferMember | null;
  bankAccount: { id: number; bankName: string; accountNumber: string } | null;
  paymentProofs: TransferProofDTO[];
};

export type BankTransferListDTO = {
  transfers: BankTransferListItemDTO[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
};

/** GET /payments/nigerian/bank-transfers/:id */
export type BankTransferDetailDTO = Omit<BankTransferListItemDTO, 'member' | 'bankAccount' | 'transaction'> & {
  member: (TransferMember & { email: string | null; phone: string | null }) | null;
  bankAccount: BankAccountDTO | null;
  transaction: {
    id: number;
    referenceNumber: string | null;
    amount: MoneyValue;
    status: string;
    category: { id: number; name: string; type: string };
    member: TransferMember;
  } | null;
};

export type BankTransferListParams = {
  status?: BankTransferStatus;
  search?: string;
  page: number;
  limit: number;
};

/** POST /payments/nigerian/bank-transfers. `amount` is a number on the wire (the API's zod schema is `z.number()`). */
export type RecordTransferPayload = {
  memberId?: number;
  bankAccountId?: number;
  transactionId?: number;
  senderBankName: string;
  senderAccountNumber?: string;
  senderAccountName?: string;
  amount: number;
  reference: string;
  transferDate: IsoDateString;
  narration?: string;
  notes?: string;
};

export type UpdateTransferPayload = Partial<RecordTransferPayload>;

/** Officer view of an association bank account — what members are shown (active ones, default first) when they pay. */
export type BankAccountDTO = {
  id: number;
  associationId: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankCode: string | null;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: IsoDateString;
};

export type BankAccountPayload = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankCode?: string;
  isDefault?: boolean;
  description?: string;
};

export type UpdateBankAccountPayload = Partial<BankAccountPayload> & { isActive?: boolean };

/** What an account update or removal reports back: for a removal, whether it was deleted or deactivated (it has history); and which account became the default, if that changed. */
export type BankAccountChange = { newDefaultId: number | null };
export type BankAccountRemoval = BankAccountChange & { outcome: 'deleted' | 'deactivated' };

/** GET /payments/nigerian/banks — a static list of Nigerian banks with their CBN codes. */
export type NigerianBankDTO = { code: string; name: string };
