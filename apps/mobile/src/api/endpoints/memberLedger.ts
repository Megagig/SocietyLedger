import { client } from '../client';
import { unwrap } from '../envelope';
import { toDecimal } from '@/lib/money';
import type {
  MyLedgerSummaryDTO,
  MyLedgerEntriesResponseDTO,
  StatementResponseDTO,
  MemberLedgerEntryDTO,
} from '@/types/api/memberLedger';
import type { LedgerCategory } from '@/types/api/enums';

export type LedgerEntriesParams = {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  category?: LedgerCategory;
};

function decimaliseEntry(entry: MemberLedgerEntryDTO) {
  return {
    ...entry,
    amount: toDecimal(entry.amount),
    runningBalance: toDecimal(entry.runningBalance),
  };
}

/** `/api/member-ledger/my-ledger/*` — no `X-Tenant` needed (api-contract.md §4). */
export const memberLedgerApi = {
  /** GET /member-ledger/my-ledger/summary */
  async getLedgerSummary() {
    const data = await unwrap<MyLedgerSummaryDTO>(client.get('/member-ledger/my-ledger/summary'));
    return {
      ...data,
      currentBalance: toDecimal(data.currentBalance),
      totalDebits: toDecimal(data.totalDebits),
      totalCredits: toDecimal(data.totalCredits),
      recentEntries: data.recentEntries.map(decimaliseEntry),
    };
  },

  /** GET /member-ledger/my-ledger/entries?page&limit&startDate&endDate&category */
  async getLedgerEntries(params: LedgerEntriesParams = {}) {
    const data = await unwrap<MyLedgerEntriesResponseDTO>(
      client.get('/member-ledger/my-ledger/entries', { params })
    );
    return {
      entries: data.entries.map(decimaliseEntry),
      pagination: data.pagination,
    };
  },

  /** GET /member-ledger/my-ledger/statement?startDate&endDate */
  async getStatement(startDate: string, endDate: string) {
    return unwrap<StatementResponseDTO>(
      client.get('/member-ledger/my-ledger/statement', { params: { startDate, endDate } })
    );
  },
};
