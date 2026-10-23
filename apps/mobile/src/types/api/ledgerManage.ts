import type { IsoDateString, MoneyValue } from './common';
import type { MemberLedgerEntryDTO, StatementResponseDTO } from './memberLedger';

/** Officer side of member ledgers (`/api/member-ledger/ledger/*`). A positive balance is what the member owes; negative is credit. */
export type LedgerMemberDTO = {
  id: number;
  memberId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
  balance: number;
};

export type LedgerMembersDTO = {
  members: LedgerMemberDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type LedgerMemberSummaryDTO = {
  member: { id: number; memberId: string | null; firstName: string; lastName: string; email: string | null };
  currentBalance: MoneyValue;
  totalDebits: MoneyValue;
  totalCredits: MoneyValue;
  byCategory: Record<string, { debits: MoneyValue; credits: MoneyValue }>;
  recentEntries: MemberLedgerEntryDTO[];
};

export type LedgerMemberEntriesDTO = {
  member: { id: number; memberId: string | null; firstName: string; lastName: string };
  entries: MemberLedgerEntryDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type LedgerStatementDTO = StatementResponseDTO;

export type LedgerSyncResultDTO = { entriesCreated: number };

export type LedgerDateRange = { startDate?: IsoDateString; endDate?: IsoDateString };
