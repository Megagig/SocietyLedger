import { useQuery } from '@tanstack/react-query';

import { settingsApi } from '@/api/endpoints/settings';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import { SETTINGS_VIEW_ACCESS, SUBSCRIPTION_ACCESS } from './labels';

export const settingsKeys = {
  all: (tenant: string) => [tenant, 'settings'] as const,
  profile: (tenant: string) => [...settingsKeys.all(tenant), 'profile'] as const,
  financial: (tenant: string) => [...settingsKeys.all(tenant), 'financial'] as const,
  payments: (tenant: string) => [...settingsKeys.all(tenant), 'payments'] as const,
  integrations: (tenant: string) => [...settingsKeys.all(tenant), 'integrations'] as const,
  notifications: (tenant: string) => [...settingsKeys.all(tenant), 'notifications'] as const,
  membersAccess: (tenant: string) => [...settingsKeys.all(tenant), 'members-access'] as const,
  subscription: (tenant: string) => [...settingsKeys.all(tenant), 'subscription'] as const,
  modules: (tenant: string) => [...settingsKeys.all(tenant), 'modules'] as const,
};

export function useAssociationProfile() {
  const tenant = useTenantKey();
  const enabled = useCan(SETTINGS_VIEW_ACCESS);
  return useQuery({ queryKey: settingsKeys.profile(tenant), queryFn: () => settingsApi.getProfile(), enabled });
}

export function useFinancialSettings() {
  const tenant = useTenantKey();
  const enabled = useCan(SETTINGS_VIEW_ACCESS);
  return useQuery({ queryKey: settingsKeys.financial(tenant), queryFn: () => settingsApi.getFinancial(), enabled });
}

export function usePaymentsSettings() {
  const tenant = useTenantKey();
  const enabled = useCan(SETTINGS_VIEW_ACCESS);
  return useQuery({ queryKey: settingsKeys.payments(tenant), queryFn: () => settingsApi.getPayments(), enabled });
}

export function useIntegrationsSettings() {
  const tenant = useTenantKey();
  const enabled = useCan(SETTINGS_VIEW_ACCESS);
  return useQuery({ queryKey: settingsKeys.integrations(tenant), queryFn: () => settingsApi.getIntegrations(), enabled });
}

export function useNotificationsSettings() {
  const tenant = useTenantKey();
  const enabled = useCan(SETTINGS_VIEW_ACCESS);
  return useQuery({ queryKey: settingsKeys.notifications(tenant), queryFn: () => settingsApi.getNotifications(), enabled });
}

export function useMembersAccessSettings() {
  const tenant = useTenantKey();
  const enabled = useCan(SETTINGS_VIEW_ACCESS);
  return useQuery({ queryKey: settingsKeys.membersAccess(tenant), queryFn: () => settingsApi.getMembersAccess(), enabled });
}

export function useSubscription() {
  const tenant = useTenantKey();
  const enabled = useCan(SUBSCRIPTION_ACCESS);
  return useQuery({ queryKey: settingsKeys.subscription(tenant), queryFn: () => settingsApi.getSubscription(), enabled, retry: false });
}

export function useMyModules() {
  const tenant = useTenantKey();
  const enabled = useCan(SUBSCRIPTION_ACCESS);
  return useQuery({ queryKey: settingsKeys.modules(tenant), queryFn: () => settingsApi.getMyModules(), enabled });
}
