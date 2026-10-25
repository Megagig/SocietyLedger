import { useMutation, useQueryClient } from '@tanstack/react-query';

import { settingsApi } from '@/api/endpoints/settings';
import { useTenantKey } from '@/hooks/useTenantKey';
import type {
  AssociationProfilePayload,
  FinancialSettingsDTO,
  MembersAccessSettingsDTO,
  NotificationsSettingsDTO,
  PaymentsSettingsDTO,
} from '@/types/api/settings';
import { settingsKeys } from './queries';

/** A saved setting changes what the server does next, so the whole settings group is read again. */
function useInvalidateSettings() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    void queryClient.invalidateQueries({ queryKey: settingsKeys.all(tenant) });
  };
}

export function useSaveProfile() {
  const invalidate = useInvalidateSettings();
  return useMutation({ mutationFn: (payload: AssociationProfilePayload) => settingsApi.updateProfile(payload), onSuccess: invalidate });
}

export function useUploadLogo() {
  const invalidate = useInvalidateSettings();
  return useMutation({ mutationFn: (file: { uri: string; name: string; type: string }) => settingsApi.uploadLogo(file), onSuccess: invalidate });
}

export function useDeleteLogo() {
  const invalidate = useInvalidateSettings();
  return useMutation({ mutationFn: () => settingsApi.deleteLogo(), onSuccess: invalidate });
}

export function useSaveFinancial() {
  const invalidate = useInvalidateSettings();
  return useMutation({ mutationFn: (payload: Partial<FinancialSettingsDTO>) => settingsApi.updateFinancial(payload), onSuccess: invalidate });
}

export function useSavePayments() {
  const invalidate = useInvalidateSettings();
  return useMutation({ mutationFn: (payload: Partial<PaymentsSettingsDTO>) => settingsApi.updatePayments(payload), onSuccess: invalidate });
}

export function useSaveNotifications() {
  const invalidate = useInvalidateSettings();
  return useMutation({ mutationFn: (payload: Partial<NotificationsSettingsDTO>) => settingsApi.updateNotifications(payload), onSuccess: invalidate });
}

export function useSaveMembersAccess() {
  const invalidate = useInvalidateSettings();
  return useMutation({ mutationFn: (payload: Partial<MembersAccessSettingsDTO>) => settingsApi.updateMembersAccess(payload), onSuccess: invalidate });
}
