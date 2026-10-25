/** `/api/member-ledger/*` self-service ("my-ledger") — no `X-Tenant` needed — api-contract.md §4. */
import type { LedgerEntryType, LedgerCategory } from './enums';
import type { MoneyValue, IsoDateString } from './common';

/** Raw `MemberFinancialLedger` row, as returned by my-ledger/summary (recentEntries) and my-ledger/entries. */
export type MemberLedgerEntryDTO = {
  id: number;
  associationId: number;
  memberId: number;
  entryType: LedgerEntryType;
  category: LedgerCategory;
  amount: MoneyValue;
  runningBalance: MoneyValue;
  effectiveDate: IsoDateString;
  description: string;
  sourceTable: string;
  sourceId: number;
  referenceNumber: string | null;
  createdBy: number;
  createdAt: IsoDateString;
};

/** GET /member-ledger/my-ledger/summary — verified 2026-10-19. */
export type MyLedgerSummaryDTO = {
  currentBalance: MoneyValue;
  totalDebits: MoneyValue;
  totalCredits: MoneyValue;
  byCategory: Record<string, { debits: MoneyValue; credits: MoneyValue }>;
  recentEntries: MemberLedgerEntryDTO[];
};

/**
 * GET /member-ledger/my-ledger/entries?startDate&endDate&category&page&limit — verified 2026-10-19.
 * A DIFFERENT pagination shape than memberFinance.ts's OutstandingResponseDTO (which has none) —
 * `{data:{entries,pagination}}` here, not `{data:{items}}`. api-contract.md §10 explicitly warns
 * against sharing one generic paginated type across endpoints; don't merge these two shapes.
 */
export type MyLedgerEntriesPaginationDTO = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type MyLedgerEntriesResponseDTO = {
  entries: MemberLedgerEntryDTO[];
  pagination: MyLedgerEntriesPaginationDTO;
};

/**
 * GET /member-ledger/my-ledger/statement?startDate&endDate — verified 2026-10-19.
 * Gap: a missing member profile on THIS endpoint surfaces as 500 "Failed to generate statement",
 * not 404 (service throws a plain Error) — the api/endpoints layer (F1.7) must special-case it,
 * not treat every 500 here as a generic retry-worthy error.
 */
export type StatementEntryDTO = {
  id: number;
  date: IsoDateString;
  description: string;
  category: string;
  debit: MoneyValue;
  credit: MoneyValue;
  balance: MoneyValue;
  reference: string | null;
};

export type StatementResponseDTO = {
  member: {
    id: number;
    memberId: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  period: { startDate: IsoDateString; endDate: IsoDateString };
  openingBalance: MoneyValue;
  entries: StatementEntryDTO[];
  totals: { totalDebits: MoneyValue; totalCredits: MoneyValue };
  closingBalance: MoneyValue;
};

/** GET /member-ledger/my-ledger/balance?asOfDate — verified 2026-10-19. `memberNumber` is the human-readable business code (Member.memberId), not the numeric row id. */
export type MyLedgerBalanceDTO = {
  memberId: number;
  memberNumber: string;
  balance: MoneyValue;
  asOfDate: IsoDateString;
};
