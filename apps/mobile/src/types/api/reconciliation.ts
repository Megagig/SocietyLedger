import type { IsoDateString, MoneyValue } from './common';

/**
 * Bank statement import and reconciliation for officers. Mirrors `apps/api/src/modules/nigerian-payments`. The amount of a match is
 * always the bank line's own amount; nothing is recorded as a payment until a match is confirmed.
 */

export type Pagination = { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };

// ---------------------------------------------------------------- importing a statement

export type ColumnKey = 'date' | 'valueDate' | 'description' | 'reference' | 'debit' | 'credit' | 'amount' | 'balance';
/** Which column (by position, from 0) holds each piece. */
export type ColumnMapping = Partial<Record<ColumnKey, number>>;

/** A statement file picked on the phone, ready to upload. */
export type StatementFile = { uri: string; name: string; type: string };

export type StatementUploadPayload = {
  bankAccountId: number;
  file: StatementFile;
  /** Column choices from the officer when the recognised ones were wrong. */
  mapping?: ColumnMapping;
  headerRow?: number;
};

export type StatementPreviewDTO = {
  filename: string;
  bankAccount: { id: number; bankName: string; accountNumber: string };
  layout: { headerRow: number; headers: string[]; mapping: ColumnMapping; source: 'saved' | 'detected' | 'manual' };
  /** What stops an import (a missing column), in plain words. */
  problems: string[];
  counts: { lines: number; credits: number; debits: number; alreadyImported: number; newLines: number; newCredits: number; newCreditTotal: string | null; unreadable: number };
  period: { startDate: IsoDateString | null; endDate: IsoDateString | null };
  sample: Array<{ row: number; transactionDate: IsoDateString; reference: string | null; description: string; debitAmount: string | null; creditAmount: string | null; balance: string | null }>;
  unreadableRows: Array<{ row: number; reason: string }>;
  canImport: boolean;
};

export type StatementImportResultDTO = {
  import: { id: number };
  entriesCreated: number;
  creditLines: number;
  alreadyImported: number;
};

export type StatementImportDTO = {
  id: number;
  filename: string;
  importDate: IsoDateString;
  startDate: IsoDateString | null;
  endDate: IsoDateString | null;
  totalEntries: number;
  matchedEntries: number;
  unmatchedEntries: number;
  skippedEntries: number;
  status: string;
  bankAccount: { id: number; bankName: string; accountNumber: string };
};
export type StatementImportListDTO = { imports: StatementImportDTO[]; pagination: Pagination };

export type StatementEntryDTO = {
  id: number;
  transactionDate: IsoDateString;
  reference: string | null;
  description: string;
  debitAmount: MoneyValue | null;
  creditAmount: MoneyValue | null;
  balance: MoneyValue | null;
  matchStatus: 'UNMATCHED' | 'AUTO_MATCHED' | 'MANUAL_MATCHED' | 'REJECTED';
  import: { id: number; filename: string; bankAccount: { bankName: string; accountNumber: string } };
};
export type StatementEntryListDTO = { entries: StatementEntryDTO[]; pagination: Pagination };

// ---------------------------------------------------------------- matching

export type MatchType = 'AUTO_REFERENCE' | 'AUTO_AMOUNT' | 'MANUAL';

export type SuggestionDTO = {
  source: 'entry' | 'transfer';
  statementEntryId: number | null;
  bankTransferId: number | null;
  line: { amount: string; date: IsoDateString; reference: string | null; description: string };
  transactionId: number;
  charge: {
    referenceNumber: string | null;
    categoryName: string;
    memberId: number;
    memberNumber: string;
    memberName: string;
    amount: string;
    available: string;
    dueDate: IsoDateString | null;
  };
  confidence: number;
  matchType: MatchType;
  reasons: string[];
  recommended: boolean;
};

export type SuggestionsDTO = {
  suggestions: SuggestionDTO[];
  counts: { unmatchedLines: number; suggested: number; recommended: number; withoutSuggestion: number };
};

export type MatchRequest = { transactionId: number; statementEntryId?: number; bankTransferId?: number; confidence?: number; matchType: MatchType };

export type ApplyMatchesDTO = {
  results: Array<{ success: boolean; reconciliationId?: number; error?: string; transactionId: number; statementEntryId?: number; bankTransferId?: number }>;
  successful: number;
  failed: number;
};

export type ReconciliationStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED';

export type ReconciliationDTO = {
  id: number;
  status: ReconciliationStatus;
  matchType: MatchType;
  matchedAmount: MoneyValue;
  createdAt: IsoDateString;
  reconciledAt: IsoDateString | null;
  /** Who proposed the match: they can't also confirm it. */
  createdBy: number | null;
  notes: string | null;
  transaction: {
    id: number;
    referenceNumber: string | null;
    amount: MoneyValue;
    member: { id: number; memberId: string; firstName: string; lastName: string };
    category: { id: number; name: string; type: string };
  };
  statementEntry: { id: number; transactionDate: IsoDateString; reference: string | null; description: string; creditAmount: MoneyValue | null } | null;
  bankTransfers: Array<{ id: number; reference: string; amount: MoneyValue; senderBankName: string }>;
};
export type ReconciliationListDTO = { reconciliations: ReconciliationDTO[]; pagination: Pagination };

export type MatchDecisionDTO = { id: number; status: ReconciliationStatus };
