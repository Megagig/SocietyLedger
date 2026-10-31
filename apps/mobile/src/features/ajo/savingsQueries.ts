import { useQuery } from '@tanstack/react-query';

import { ajoSavingsApi } from '@/api/endpoints/ajoSavings';
import { useTenantKey } from '@/hooks/useTenantKey';
import { ajoKeys } from './queries';

const key = (tenant: string, membershipId: number, name: string) => [...ajoKeys.all(tenant), 'savings', membershipId, name] as const;
const on = (membershipId: number) => membershipId > 0;

export function useSavings(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: key(tenant, membershipId, 'summary'), queryFn: () => ajoSavingsApi.savings(membershipId), enabled: on(membershipId) });
}
export function useSavingsPayments(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: key(tenant, membershipId, 'payments'), queryFn: () => ajoSavingsApi.payments(membershipId), enabled: on(membershipId) });
}
export function useCashTracker(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: key(tenant, membershipId, 'cash'), queryFn: () => ajoSavingsApi.cash(membershipId), enabled: on(membershipId) });
}
export function useCollectorInfo(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: key(tenant, membershipId, 'collector'), queryFn: () => ajoSavingsApi.collector(membershipId), enabled: on(membershipId) });
}
export function useSavingsRecord(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: key(tenant, membershipId, 'record'), queryFn: () => ajoSavingsApi.record(membershipId), enabled: on(membershipId) });
}
