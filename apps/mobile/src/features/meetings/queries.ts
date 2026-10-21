import { useQuery } from '@tanstack/react-query';

import { meetingsApi } from '@/api/endpoints/meetings';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import { useSessionStore } from '@/stores/session';

export const meetingsKeys = {
  all: (tenant: string) => [tenant, 'meetings'] as const,
  upcoming: (tenant: string, limit: number) => [...meetingsKeys.all(tenant), 'upcoming', limit] as const,
  recent: (tenant: string, limit: number) => [...meetingsKeys.all(tenant), 'recent', limit] as const,
  detail: (tenant: string, id: number) => [...meetingsKeys.all(tenant), 'detail', id] as const,
  attendance: (tenant: string, memberId: number) => [...meetingsKeys.all(tenant), 'attendance', memberId] as const,
  attendanceRecords: (tenant: string, memberId: number) => [...meetingsKeys.all(tenant), 'attendance-records', memberId] as const,
};

/** `/meetings/upcoming` is gated server-side on `MEETING_VIEW` — this hook checks the same
 * permission client-side (architecture.md §7.4's rule: permission-gated controls hidden for
 * users without it) rather than firing a request bound to 403. */
export function useUpcomingMeetings(limit = 3) {
  const tenant = useTenantKey();
  const canView = useModuleAccess('MEETING_VIEW', 'meetings');

  return useQuery({
    queryKey: meetingsKeys.upcoming(tenant, limit),
    queryFn: () => meetingsApi.getUpcoming(limit),
    enabled: canView,
  });
}

export function useRecentMeetings(limit = 10) {
  const tenant = useTenantKey();
  const canView = useModuleAccess('MEETING_VIEW', 'meetings');

  return useQuery({
    queryKey: meetingsKeys.recent(tenant, limit),
    queryFn: () => meetingsApi.getRecent(limit),
    enabled: canView,
  });
}

export function useMeetingDetail(id: number | undefined) {
  const tenant = useTenantKey();
  const canView = useModuleAccess('MEETING_VIEW', 'meetings');

  return useQuery({
    queryKey: meetingsKeys.detail(tenant, id ?? 0),
    queryFn: () => meetingsApi.getById(id!),
    enabled: canView && id !== undefined,
  });
}

/** The caller's own attendance totals (web "My Meetings" stat cards). `null` = no attendance records yet. */
export function useMyAttendance() {
  const tenant = useTenantKey();
  const canView = useModuleAccess('MEETING_VIEW', 'meetings');
  const memberId = useSessionStore((s) => s.user?.member?.id);

  return useQuery({
    queryKey: meetingsKeys.attendance(tenant, memberId ?? 0),
    queryFn: () => meetingsApi.getAttendanceHistory(memberId!),
    enabled: canView && memberId !== undefined,
    select: (data) => data[0] ?? null,
  });
}

/** The caller's own per-meeting attendance rows — the "My Attendance" history list (C4). */
export function useMyAttendanceRecords() {
  const tenant = useTenantKey();
  const canView = useModuleAccess('MEETING_VIEW', 'meetings');
  const memberId = useSessionStore((s) => s.user?.member?.id);

  return useQuery({
    queryKey: meetingsKeys.attendanceRecords(tenant, memberId ?? 0),
    queryFn: meetingsApi.getMyAttendanceRecords,
    enabled: canView && memberId !== undefined,
    select: (data) => data.records,
  });
}
