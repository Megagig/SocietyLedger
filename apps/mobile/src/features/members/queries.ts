import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { membersManageApi } from '@/api/endpoints/membersManage';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import type { MemberListParams } from '@/types/api/membersManage';

export const membersKeys = {
  all: (tenant: string) => [tenant, 'members'] as const,
  list: (tenant: string, filters: MembersFilters) => [...membersKeys.all(tenant), 'list', filters] as const,
  stats: (tenant: string) => [...membersKeys.all(tenant), 'stats'] as const,
  detail: (tenant: string, id: number) => [...membersKeys.all(tenant), 'detail', id] as const,
  finance: (tenant: string, id: number) => [...membersKeys.all(tenant), 'finance', id] as const,
  attendance: (tenant: string, id: number) => [...membersKeys.all(tenant), 'attendance', id] as const,
  cooperative: (tenant: string, id: number) => [...membersKeys.all(tenant), 'cooperative', id] as const,
  welfare: (tenant: string, id: number) => [...membersKeys.all(tenant), 'welfare', id] as const,
};

/** Seeing the member directory and a member's profile. */
export const MEMBERS_VIEW_ACCESS: PermissionAlias = 'MEMBER_VIEW';
export const MEMBERS_CREATE_ACCESS: PermissionAlias = 'MEMBER_CREATE';
export const MEMBERS_EDIT_ACCESS: PermissionAlias = 'MEMBER_EDIT';
/** A member's finance tab — the API accepts either key. */
export const MEMBER_FINANCE_ACCESS: PermissionAlias[] = ['FINANCE_VIEW', 'MEMBER_VIEW'];
export const MEMBER_ATTENDANCE_ACCESS: PermissionAlias = 'MEETING_VIEW';
export const MEMBER_COOPERATIVE_ACCESS: PermissionAlias = 'COOPERATIVE_SAVINGS_MANAGE';
export const MEMBER_WELFARE_ACCESS: PermissionAlias = 'WELFARE_MANAGE';

export const MEMBERS_PAGE_SIZE = 25;

export type MembersFilters = Omit<MemberListParams, 'page' | 'limit'>;

/** Pages of the directory, name order. Filters are part of the key, so changing one starts a fresh list. */
export function useMembersList(filters: MembersFilters) {
  const tenant = useTenantKey();
  const enabled = useCan(MEMBERS_VIEW_ACCESS);
  return useInfiniteQuery({
    queryKey: membersKeys.list(tenant, filters),
    queryFn: ({ pageParam }) => membersManageApi.listMembers({ ...filters, page: pageParam, limit: MEMBERS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/** Headline counts for the directory (total, active, new this month, can sign in). */
export function useMemberStats() {
  const tenant = useTenantKey();
  const enabled = useCan(MEMBERS_VIEW_ACCESS);
  return useQuery({ queryKey: membersKeys.stats(tenant), queryFn: membersManageApi.getStats, enabled });
}

export function useMember(id: number) {
  const tenant = useTenantKey();
  const enabled = useCan(MEMBERS_VIEW_ACCESS) && Number.isFinite(id);
  return useQuery({ queryKey: membersKeys.detail(tenant, id), queryFn: () => membersManageApi.getMember(id), enabled });
}

export function useMemberFinance(id: number, active: boolean) {
  const tenant = useTenantKey();
  const enabled = useCan(MEMBER_FINANCE_ACCESS) && active && Number.isFinite(id);
  return useQuery({ queryKey: membersKeys.finance(tenant, id), queryFn: () => membersManageApi.getFinanceSummary(id), enabled });
}

export function useMemberAttendance(id: number, active: boolean) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(MEMBER_ATTENDANCE_ACCESS, 'meetings') && active && Number.isFinite(id);
  return useQuery({ queryKey: membersKeys.attendance(tenant, id), queryFn: () => membersManageApi.getAttendanceTotals(id), enabled });
}

export function useMemberCooperative(id: number, active: boolean) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(MEMBER_COOPERATIVE_ACCESS, 'cooperatives') && active && Number.isFinite(id);
  return useQuery({ queryKey: membersKeys.cooperative(tenant, id), queryFn: () => membersManageApi.getCooperativeProfile(id), enabled });
}

export function useMemberWelfare(id: number, active: boolean) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(MEMBER_WELFARE_ACCESS, 'welfare') && active && Number.isFinite(id);
  return useQuery({ queryKey: membersKeys.welfare(tenant, id), queryFn: () => membersManageApi.getWelfareProfile(id), enabled });
}
