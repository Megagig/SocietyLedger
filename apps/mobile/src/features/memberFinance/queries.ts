import { useQuery } from '@tanstack/react-query';

import { memberFinanceApi } from '@/api/endpoints/memberFinance';
import { useTenantKey } from '@/hooks/useTenantKey';

export const memberFinanceKeys = {
  all: (tenant: string) => [tenant, 'memberFinance'] as const,
  summary: (tenant: string) => [...memberFinanceKeys.all(tenant), 'summary'] as const,
  payments: (tenant: string) => [...memberFinanceKeys.all(tenant), 'payments'] as const,
  outstanding: (tenant: string) => [...memberFinanceKeys.all(tenant), 'outstanding'] as const,
  dues: (tenant: string) => [...memberFinanceKeys.all(tenant), 'dues'] as const,
  levies: (tenant: string) => [...memberFinanceKeys.all(tenant), 'levies'] as const,
  penalties: (tenant: string) => [...memberFinanceKeys.all(tenant), 'penalties'] as const,
  donations: (tenant: string) => [...memberFinanceKeys.all(tenant), 'donations'] as const,
  paymentInfo: (tenant: string) => [...memberFinanceKeys.all(tenant), 'paymentInfo'] as const,
  verifyPayment: (tenant: string, reference: string) => [...memberFinanceKeys.all(tenant), 'verifyPayment', reference] as const,
};

export function useMemberFinanceSummary() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.summary(tenant),
    queryFn: memberFinanceApi.getFinanceSummary,
  });
}

/** Returns the full newest-first history (the API has no server-side limit); callers slice
 * to whatever preview size they need (H1 shows 3). */
export function useMemberPayments() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.payments(tenant),
    queryFn: memberFinanceApi.getPayments,
  });
}

/** Returns all outstanding/unpaid items for this member — no pagination. */
export function useMemberOutstanding() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.outstanding(tenant),
    queryFn: memberFinanceApi.getOutstanding,
  });
}

/** Returns all dues for this member — client-side status filtering applies on the screen. */
export function useMemberDues() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.dues(tenant),
    queryFn: memberFinanceApi.getDues,
  });
}

/** Returns all levy assignments for this member. */
export function useMemberLevies() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.levies(tenant),
    queryFn: memberFinanceApi.getLevies,
  });
}

/** Returns all penalties for this member. */
export function useMemberPenalties() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.penalties(tenant),
    queryFn: memberFinanceApi.getPenalties,
  });
}

/** Returns donation history + donation categories (cause picker source). */
export function useMemberDonations() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.donations(tenant),
    queryFn: memberFinanceApi.getDonations,
  });
}

/** F2.8/F2.9: Paystack availability + bank accounts for the pay screen. */
export function usePaymentInfo() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.paymentInfo(tenant),
    queryFn: memberFinanceApi.getPaymentInfo,
    staleTime: 5 * 60 * 1000,
  });
}

/** F2.8: Verify a Paystack payment by reference. Only runs when reference is non-empty. */
export function useVerifyPaystackPayment(reference: string) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.verifyPayment(tenant, reference),
    queryFn: () => memberFinanceApi.verifyPaystackPayment(reference),
    enabled: !!reference,
    retry: 2,
  });
}
