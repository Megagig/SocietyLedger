import { useMutation, useQueryClient } from '@tanstack/react-query';

import { communicationApi } from '@/api/endpoints/communication';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { AnnouncementPayload, CampaignPayload, QuickSmsPayload, TemplatePayload } from '@/types/api/communication';
import { communicationKeys } from './queries';

/** Anything sent or changed moves the balance, the history, the lists and the numbers on the hub — so one refresh covers all of them. */
function useInvalidateCommunication() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    void queryClient.invalidateQueries({ queryKey: communicationKeys.all(tenant) });
  };
}

export function useSendAnnouncement() {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: (payload: AnnouncementPayload) => communicationApi.sendAnnouncement(payload), onSettled: invalidate });
}

export function useSendQuickSms() {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: (payload: QuickSmsPayload) => communicationApi.sendQuick(payload), onSettled: invalidate });
}

export function useCreateCampaign() {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: (payload: CampaignPayload) => communicationApi.createCampaign(payload), onSuccess: invalidate });
}

export function useStartCampaign(id: number) {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: () => communicationApi.startCampaign(id), onSettled: invalidate });
}

export function useCancelCampaign(id: number) {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: () => communicationApi.cancelCampaign(id), onSettled: invalidate });
}

export function useDeleteCampaign(id: number) {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: () => communicationApi.deleteCampaign(id), onSuccess: invalidate });
}

export function useCreateTemplate() {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: (payload: TemplatePayload) => communicationApi.createTemplate(payload), onSuccess: invalidate });
}

export function useUpdateTemplate(id: number) {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: (payload: Partial<TemplatePayload> & { isActive?: boolean }) => communicationApi.updateTemplate(id, payload), onSuccess: invalidate });
}

export function useDeleteTemplate() {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: (id: number) => communicationApi.deleteTemplate(id), onSuccess: invalidate });
}
