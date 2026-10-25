import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { membersManageApi } from '@/api/endpoints/membersManage';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import type { ApprovalStatus, MemberListParams } from '@/types/api/membersManage';

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

/** Disabling (and re-enabling, via edit) a member. */
export const MEMBERS_DISABLE_ACCESS: PermissionAlias = 'MEMBER_DISABLE';
/** Inviting members to activate a login — the API checks `members.create`. */
export const MEMBERS_INVITE_ACCESS: PermissionAlias = 'USER_CREATE';
/** Approving self-registrations — the API checks `members.edit_all`. */
export const MEMBERS_APPROVE_ACCESS: PermissionAlias = 'MEMBER_EDIT_ALL';

export const approvalKeys = {
  all: (tenant: string) => [tenant, 'member-approvals'] as const,
  list: (tenant: string, status: ApprovalStatus, search: string) => [...approvalKeys.all(tenant), 'list', status, search] as const,
  pendingCount: (tenant: string) => [...approvalKeys.all(tenant), 'pending-count'] as const,
};

export const inviteKeys = {
  all: (tenant: string) => [tenant, 'member-invites'] as const,
  invitable: (tenant: string, search: string) => [...inviteKeys.all(tenant), 'invitable', search] as const,
  pending: (tenant: string) => [...inviteKeys.all(tenant), 'pending'] as const,
};

export const MEMBERS_ACCESS_SETTINGS_KEY = (tenant: string) => [tenant, 'settings', 'members_access'] as const;

/** Whether new members get an automatic ID. Officers without `settings.view` can't read it, so they're assumed to be on automatic IDs — the form then shows the server's message if that guess is wrong. */
export function useMemberIdAutoGenerate(): boolean {
  const tenant = useTenantKey();
  const enabled = useCan('SETTINGS_VIEW');
  const query = useQuery({ queryKey: MEMBERS_ACCESS_SETTINGS_KEY(tenant), queryFn: membersManageApi.getMembersAccessSettings, enabled });
  return query.data?.memberIdAutoGenerate !== false;
}

/** Members who can be invited (email on file, no login yet), name order. */
export function useInvitableMembers(search: string) {
  const tenant = useTenantKey();
  const enabled = useCan(MEMBERS_INVITE_ACCESS);
  return useInfiniteQuery({
    queryKey: inviteKeys.invitable(tenant, search),
    queryFn: ({ pageParam }) => membersManageApi.listInvitable({ page: pageParam, limit: MEMBERS_PAGE_SIZE, search: search || undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function usePendingInvites() {
  const tenant = useTenantKey();
  const enabled = useCan(MEMBERS_INVITE_ACCESS);
  return useQuery({ queryKey: inviteKeys.pending(tenant), queryFn: membersManageApi.listPendingInvites, enabled });
}

/** Self-registrations by decision status; pending first by default. */
export function useApprovals(status: ApprovalStatus, search: string) {
  const tenant = useTenantKey();
  const enabled = useCan(MEMBERS_APPROVE_ACCESS);
  return useInfiniteQuery({
    queryKey: approvalKeys.list(tenant, status, search),
    queryFn: ({ pageParam }) => membersManageApi.listApprovals({ status, page: pageParam, limit: MEMBERS_PAGE_SIZE, search: search || undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
  });
}

/** How many registrations are waiting — the badge on the Manage hub. */
export function usePendingApprovalCount() {
  const tenant = useTenantKey();
  const enabled = useCan(MEMBERS_APPROVE_ACCESS);
  return useQuery({
    queryKey: approvalKeys.pendingCount(tenant),
    queryFn: () => membersManageApi.listApprovals({ status: 'pending', page: 1, limit: 1 }),
    select: (data) => data.total,
    enabled,
    refetchInterval: 60_000,
  });
}
