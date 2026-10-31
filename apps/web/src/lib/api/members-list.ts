import { apiGet } from '@/utils/api';
import type { Member } from '@/types';

export type MembersListFilters = {
  page: number;
  limit: number;
  search: string;
  statusFilter: string;
  categoryFilter: string;
  loginFilter: string;
};

export interface MembersPage {
  members: Member[];
  pagination: { totalPages: number; totalCount: number };
}

/** What the Members page shows when it first opens. The dashboard prefetches exactly this, so the two must agree. */
export const DEFAULT_MEMBERS_FILTERS: MembersListFilters = { page: 1, limit: 10, search: '', statusFilter: '', categoryFilter: '', loginFilter: '' };

/** The cache key parts for one page of the list (after the association and the 'members' domain). */
export const membersListParts = (filters: MembersListFilters) => ['list', filters] as const;

export async function fetchMembersPage(filters: MembersListFilters): Promise<MembersPage> {
  const params = new URLSearchParams({
    page: filters.page.toString(),
    limit: filters.limit.toString(),
    ...(filters.search && { search: filters.search }),
    ...(filters.statusFilter && { status: filters.statusFilter }),
    ...(filters.categoryFilter && { category: filters.categoryFilter }),
    ...(filters.loginFilter && { loginStatus: filters.loginFilter }),
  });
  const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members?${params}`);
  if (!response.ok) throw new Error('Failed to fetch members');
  const data = await response.json();
  return data.data as MembersPage;
}
