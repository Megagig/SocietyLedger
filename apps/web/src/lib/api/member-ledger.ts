import { apiGet, apiPost } from '@/utils/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================
// MEMBER LEDGER API CLIENT
// ============================================

// Types
export interface LedgerEntry {
  id: number;
  memberId: number;
  entryType: 'DEBIT' | 'CREDIT' | 'ADJUSTMENT';
  category: string;
  amount: number;
  runningBalance: number;
  effectiveDate: string;
  description: string;
  sourceTable: string | null;
  sourceRecordId: number | null;
  createdAt: string;
  createdBy: number | null;
  member?: {
    id: number;
    firstName: string;
    lastName: string;
    memberId: string;
  };
}

export interface LedgerSummary {
  memberId: number;
  memberName: string;
  memberNumber: string;
  totalDebits: number;
  totalCredits: number;
  totalAdjustments: number;
  currentBalance: number;
  entryCount: number;
  lastEntryDate: string | null;
  categoryBreakdown: Record<string, { debits: number; credits: number; net: number }>;
}

export interface LedgerStatement {
  member: {
    id: number;
    firstName: string;
    lastName: string;
    memberId: string;
    email: string | null;
    phone?: string | null;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  openingBalance: number;
  closingBalance: number;
  totals: {
    totalDebits: number;
    totalCredits: number;
  };
  entries: Array<{
    id: number;
    date: string;
    description: string;
    category: string;
    debit: number;
    credit: number;
    balance: number;
    reference: string | null;
  }>;
}

export interface MemberBalance {
  memberId: number;
  memberName: string;
  memberNumber: string;
  balance: number;
  lastActivity: string | null;
}

// ============================================
// MEMBER SELF-SERVICE ENDPOINTS
// ============================================

/**
 * The API answers `{ data: { entries, pagination: { totalPages } } }`; the pages expect `{ data: entries[], pagination: { pages } }`.
 * Accepts either, so it keeps working if the endpoint is ever flattened.
 */
function normalizeEntriesResponse(body: any): { data: LedgerEntry[]; pagination: any } {
  const payload = body?.data;
  const entries: LedgerEntry[] = Array.isArray(payload) ? payload : payload?.entries ?? [];
  const pagination = body?.pagination ?? payload?.pagination;
  return { data: entries, pagination: pagination ? { ...pagination, pages: pagination.pages ?? pagination.totalPages ?? 1 } : undefined };
}

export async function getMyLedgerSummary(): Promise<{ data: LedgerSummary }> {
  const response = await apiGet(`${API_URL}/api/member-ledger/my-ledger/summary`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch ledger summary');
  }
  return response.json();
}

export async function getMyLedgerEntries(params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  category?: string;
  entryType?: string;
}): Promise<{ data: LedgerEntry[]; pagination: any }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.entryType) searchParams.set('entryType', params.entryType);

  const response = await apiGet(`${API_URL}/api/member-ledger/my-ledger/entries?${searchParams}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch ledger entries');
  }
  return normalizeEntriesResponse(await response.json());
}

export async function getMyStatement(params: {
  startDate: string;
  endDate: string;
}): Promise<{ data: LedgerStatement }> {
  const searchParams = new URLSearchParams();
  searchParams.set('startDate', params.startDate);
  searchParams.set('endDate', params.endDate);

  const response = await apiGet(`${API_URL}/api/member-ledger/my-ledger/statement?${searchParams}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch statement');
  }
  return response.json();
}

export async function getMyBalance(): Promise<{ data: { balance: number } }> {
  const response = await apiGet(`${API_URL}/api/member-ledger/my-ledger/balance`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch balance');
  }
  return response.json();
}

export async function exportMyStatement(params: {
  startDate: string;
  endDate: string;
}): Promise<any> {
  const searchParams = new URLSearchParams();
  searchParams.set('startDate', params.startDate);
  searchParams.set('endDate', params.endDate);
  
  const response = await apiPost(`${API_URL}/api/member-ledger/my-ledger/export?${searchParams}`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to export statement');
  }
  return response.json();
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

export async function getAllMemberBalances(params?: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<{ data: { members: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } } }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const response = await apiGet(`${API_URL}/api/member-ledger/ledger/members?${searchParams}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch member balances');
  }
  return response.json();
}

export async function getMemberLedgerSummary(memberId: number): Promise<{ data: LedgerSummary }> {
  const response = await apiGet(`${API_URL}/api/member-ledger/ledger/${memberId}/summary`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch member ledger summary');
  }
  return response.json();
}

export async function getMemberLedgerEntries(memberId: number, params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  category?: string;
  entryType?: string;
}): Promise<{ data: LedgerEntry[]; pagination: any }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.entryType) searchParams.set('entryType', params.entryType);

  const response = await apiGet(`${API_URL}/api/member-ledger/ledger/${memberId}/entries?${searchParams}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch member ledger entries');
  }
  // Left raw on purpose: the admin member-ledger page reads `data.entries` itself.
  return response.json();
}

export async function getMemberStatement(memberId: number, params: {
  startDate: string;
  endDate: string;
}): Promise<{ data: LedgerStatement }> {
  const searchParams = new URLSearchParams();
  searchParams.set('startDate', params.startDate);
  searchParams.set('endDate', params.endDate);

  const response = await apiGet(`${API_URL}/api/member-ledger/ledger/${memberId}/statement?${searchParams}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch member statement');
  }
  return response.json();
}

export async function syncMemberLedger(memberId: number): Promise<{ data: { synced: number } }> {
  const response = await apiPost(`${API_URL}/api/member-ledger/ledger/${memberId}/sync`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to sync member ledger');
  }
  return response.json();
}

export async function bulkSyncLedgers(): Promise<{ data: { synced: number; members: number } }> {
  const response = await apiPost(`${API_URL}/api/member-ledger/ledger/bulk-sync`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to bulk sync ledgers');
  }
  return response.json();
}

/**
 * Force re-sync all ledgers - clears and rebuilds all ledger entries
 * Use this to fix incorrect ledger entries (e.g., donation pledges showing as credit)
 */
export async function forceResyncAllLedgers(): Promise<{ 
  data: { 
    cleared: number; 
    total: number; 
    synced: number; 
    failed: number;
    errors: Array<{ memberId: number; error: string }>;
  } 
}> {
  const response = await apiPost(`${API_URL}/api/member-ledger/ledger/force-resync`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to force re-sync ledgers');
  }
  return response.json();
}

export async function exportMemberStatement(memberId: number, params: {
  startDate: string;
  endDate: string;
}): Promise<any> {
  const searchParams = new URLSearchParams();
  searchParams.set('startDate', params.startDate);
  searchParams.set('endDate', params.endDate);
  
  const response = await apiPost(`${API_URL}/api/member-ledger/ledger/${memberId}/export?${searchParams}`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to export member statement');
  }
  return response.json();
}
