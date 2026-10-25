import { useMutation, useQueryClient } from '@tanstack/react-query';

import { meetingsManageApi } from '@/api/endpoints/meetingsManage';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { AgendaItemPayload, MarkAttendancePayload, MeetingFormPayload, MinutesPayload } from '@/types/api/meetingsManage';
import { meetingAdminKeys } from './queries';

/** A change to a meeting moves the lists, the stats, the member-facing meeting screens and the home screen's upcoming meetings. */
function useInvalidateMeetings() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [tenant, 'meetings'] });
    void queryClient.invalidateQueries({ queryKey: [tenant, 'dashboard'] });
  };
}

export function useCreateMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({ mutationFn: (payload: MeetingFormPayload) => meetingsManageApi.create(payload), onSuccess: invalidate });
}

export function useUpdateMeeting(id: number) {
  const invalidate = useInvalidateMeetings();
  return useMutation({ mutationFn: (payload: Partial<MeetingFormPayload>) => meetingsManageApi.update(id, payload), onSuccess: invalidate });
}

export function useCancelMeeting(id: number) {
  const invalidate = useInvalidateMeetings();
  return useMutation({ mutationFn: (reason: string) => meetingsManageApi.cancel(id, reason), onSettled: invalidate });
}

export function useCompleteMeeting(id: number) {
  const invalidate = useInvalidateMeetings();
  return useMutation({ mutationFn: () => meetingsManageApi.complete(id), onSettled: invalidate });
}

export function useDeleteMeeting(id: number) {
  const invalidate = useInvalidateMeetings();
  return useMutation({ mutationFn: () => meetingsManageApi.remove(id), onSuccess: invalidate });
}

export function useAddAgendaItem(id: number) {
  const invalidate = useInvalidateMeetings();
  return useMutation({ mutationFn: (payload: AgendaItemPayload) => meetingsManageApi.addAgendaItem(id, payload), onSuccess: invalidate });
}

export function useUpdateAgendaItem(id: number) {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: ({ agendaId, payload }: { agendaId: number; payload: Partial<AgendaItemPayload> }) => meetingsManageApi.updateAgendaItem(id, agendaId, payload),
    onSuccess: invalidate,
  });
}

export function useRemoveAgendaItem(id: number) {
  const invalidate = useInvalidateMeetings();
  return useMutation({ mutationFn: (agendaId: number) => meetingsManageApi.removeAgendaItem(id, agendaId), onSuccess: invalidate });
}

export function useReorderAgenda(id: number) {
  const invalidate = useInvalidateMeetings();
  return useMutation({ mutationFn: (items: { id: number; orderNumber: number }[]) => meetingsManageApi.reorderAgenda(id, items), onSettled: invalidate });
}

export function useInitializeAttendance(id: number) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: () => meetingsManageApi.initializeAttendance(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: meetingAdminKeys.attendance(tenant, id) }),
  });
}

/**
 * Mark one member. The cache is updated at once and rolled back if the save fails — the screen never waits for the network to
 * show the tap, which is what makes taking attendance in a room of people usable.
 */
export function useMarkAttendance(id: number) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  const key = meetingAdminKeys.attendance(tenant, id);
  return useMutation({
    mutationFn: (payload: MarkAttendancePayload) => meetingsManageApi.markAttendance(id, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (current: import('@/types/api/meetingsManage').MeetingAttendanceDTO | undefined) =>
        current
          ? {
              ...current,
              attendance: current.attendance.map((row) => (row.memberId === payload.memberId ? { ...row, status: payload.status, apologyReason: payload.apologyReason ?? row.apologyReason } : row)),
            }
          : current,
      );
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useMarkAttendanceBulk(id: number) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  const key = meetingAdminKeys.attendance(tenant, id);
  return useMutation({
    mutationFn: (attendances: MarkAttendancePayload[]) => meetingsManageApi.markAttendanceBulk(id, attendances),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useSaveMinutes(id: number) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: ({ payload, exists }: { payload: MinutesPayload; exists: boolean }) => (exists ? meetingsManageApi.updateMinutes(id, payload) : meetingsManageApi.createMinutes(id, payload)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [tenant, 'meetings'] }),
  });
}

export function useApproveMinutes(id: number) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: () => meetingsManageApi.approveMinutes(id),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: [tenant, 'meetings'] }),
  });
}
