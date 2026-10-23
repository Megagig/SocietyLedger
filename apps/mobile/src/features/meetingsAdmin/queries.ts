import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { meetingsManageApi } from '@/api/endpoints/meetingsManage';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import type { MeetingStatus } from '@/types/api/enums';

export const meetingAdminKeys = {
  all: (tenant: string) => [tenant, 'meetings', 'admin'] as const,
  stats: (tenant: string) => [...meetingAdminKeys.all(tenant), 'stats'] as const,
  list: (tenant: string, status: MeetingStatus | '') => [...meetingAdminKeys.all(tenant), 'list', status] as const,
  detail: (tenant: string, id: number) => [...meetingAdminKeys.all(tenant), 'detail', id] as const,
  attendance: (tenant: string, id: number) => [...meetingAdminKeys.all(tenant), 'attendance', id] as const,
  minutes: (tenant: string, id: number) => [...meetingAdminKeys.all(tenant), 'minutes', id] as const,
  history: (tenant: string) => [...meetingAdminKeys.all(tenant), 'history'] as const,
};

export const MEETINGS_MODULE = 'meetings';

/** Seeing meetings (everyone holds `members.view_own`; the module must be on). */
export const MEETINGS_VIEW_ACCESS: PermissionAlias = 'MEETING_VIEW';
/** Creating a meeting (`members.create`). */
export const MEETINGS_CREATE_ACCESS: PermissionAlias = 'MEETING_CREATE';
/** Editing a meeting and its agenda, and marking it completed (`members.edit`). */
export const MEETINGS_EDIT_ACCESS: PermissionAlias = 'MEETING_EDIT';
/** Cancelling or deleting a meeting (`members.disable`). */
export const MEETINGS_DELETE_ACCESS: PermissionAlias = 'MEETING_DELETE';
/** Taking attendance and seeing everyone's (`meetings.manage_attendance`). */
export const MEETINGS_ATTENDANCE_ACCESS: PermissionAlias = 'MEETING_ATTENDANCE';
/** Writing and approving minutes (`meetings.manage_minutes`). */
export const MEETINGS_MINUTES_ACCESS: PermissionAlias = 'MEETING_MINUTES';
/** Any of the officer meeting permissions: what makes Meetings appear in Manage. */
export const MEETINGS_ADMIN_ACCESS: PermissionAlias[] = ['MEETING_CREATE', 'MEETING_EDIT', 'MEETING_ATTENDANCE', 'MEETING_MINUTES'];

export const MEETINGS_PAGE_SIZE = 20;

export function useMeetingStats() {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(MEETINGS_VIEW_ACCESS, MEETINGS_MODULE);
  return useQuery({ queryKey: meetingAdminKeys.stats(tenant), queryFn: () => meetingsManageApi.getStats(), enabled });
}

/** One status of the meetings list (or all), newest first, a page at a time. */
export function useMeetingList(status: MeetingStatus | '') {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(MEETINGS_VIEW_ACCESS, MEETINGS_MODULE);
  return useInfiniteQuery({
    queryKey: meetingAdminKeys.list(tenant, status),
    queryFn: ({ pageParam }) => meetingsManageApi.list({ status: status || undefined, page: pageParam, limit: MEETINGS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useMeetingAdmin(id: number) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(MEETINGS_VIEW_ACCESS, MEETINGS_MODULE) && Number.isFinite(id);
  return useQuery({ queryKey: meetingAdminKeys.detail(tenant, id), queryFn: () => meetingsManageApi.get(id), enabled });
}

export function useMeetingAttendance(id: number) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(MEETINGS_ATTENDANCE_ACCESS, MEETINGS_MODULE) && Number.isFinite(id);
  return useQuery({ queryKey: meetingAdminKeys.attendance(tenant, id), queryFn: () => meetingsManageApi.getAttendance(id), enabled, staleTime: 0 });
}

export function useMeetingMinutes(id: number) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(MEETINGS_VIEW_ACCESS, MEETINGS_MODULE) && Number.isFinite(id);
  return useQuery({ queryKey: meetingAdminKeys.minutes(tenant, id), queryFn: () => meetingsManageApi.getMinutes(id), enabled });
}

/** Attendance totals and rates for every member — officers who take attendance only (the API shows anyone else just their own). */
export function useAttendanceHistoryAll() {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(MEETINGS_ATTENDANCE_ACCESS, MEETINGS_MODULE);
  return useQuery({ queryKey: meetingAdminKeys.history(tenant), queryFn: () => meetingsManageApi.getAttendanceHistory(), enabled });
}
