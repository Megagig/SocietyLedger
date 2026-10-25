import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { guarantorsApi, loansApi } from '@/api/endpoints/loans';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import { COOPERATIVE_GUARANTOR_ACCESS, COOPERATIVE_LOANS_APPLY_ACCESS, COOPERATIVE_LOANS_VIEW_ACCESS } from '@/lib/permissions';
import type { CreateLoanApplicationPayload, RespondToGuarantorRequestPayload, SubmitLoanRepaymentPayload } from '@/types/api/loans';
import { cooperativesKeys } from './queries';

export const loanKeys = {
  all: (tenant: string) => [...cooperativesKeys.all(tenant), 'loans'] as const,
  list: (tenant: string) => [...loanKeys.all(tenant), 'list'] as const,
  detail: (tenant: string, id: number) => [...loanKeys.all(tenant), 'detail', id] as const,
  applications: (tenant: string) => [...loanKeys.all(tenant), 'applications'] as const,
  products: (tenant: string) => [...loanKeys.all(tenant), 'products'] as const,
  repayments: (tenant: string, loanId: number) => [...loanKeys.all(tenant), 'repayments', loanId] as const,
  guarantorRequests: (tenant: string) => [...loanKeys.all(tenant), 'guarantor-requests'] as const,
  repaymentRequests: (tenant: string, loanId?: number) => [...loanKeys.all(tenant), 'repayment-requests', loanId ?? 'all'] as const,
};

/** Every "my loans" query needs the permission, the module, and a member profile (the endpoints are keyed on it). */
function useLoansEnabled(): boolean {
  const access = useModuleAccess(COOPERATIVE_LOANS_VIEW_ACCESS, 'cooperatives');
  const memberId = useMemberId();
  return access && memberId !== undefined;
}

export function useMyLoans() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: loanKeys.list(tenant), queryFn: () => loansApi.listLoans(), enabled: useLoansEnabled() });
}

export function useLoan(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: loanKeys.detail(tenant, id), queryFn: () => loansApi.getLoan(id), enabled: useLoansEnabled() && Number.isFinite(id) });
}

export function useMyLoanApplications() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: loanKeys.applications(tenant), queryFn: () => loansApi.listApplications(), enabled: useLoansEnabled() });
}

/** Active products; the apply flow needs the view permission too (the API lets `cooperatives.view_own` list products). */
export function useLoanProducts() {
  const tenant = useTenantKey();
  const applyAccess = useModuleAccess(COOPERATIVE_LOANS_APPLY_ACCESS, 'cooperatives');
  const memberId = useMemberId();
  return useQuery({
    queryKey: loanKeys.products(tenant),
    queryFn: () => loansApi.listProducts(),
    enabled: applyAccess && memberId !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLoanRepayments(loanId: number) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: loanKeys.repayments(tenant, loanId),
    queryFn: () => loansApi.listRepayments({ loanId }),
    enabled: useLoansEnabled() && Number.isFinite(loanId),
  });
}

export function useLoanRepaymentRequests(loanId?: number) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: loanKeys.repaymentRequests(tenant, loanId),
    queryFn: () => loansApi.listRepaymentRequests({ loanId }),
    enabled: useLoansEnabled(),
  });
}

/** Debounced term in, up to 20 names out. Disabled until the apply screen reaches the guarantor step. */
export function useGuarantorCandidates(search: string, enabled: boolean) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: [...loanKeys.all(tenant), 'guarantor-candidates', search] as const,
    queryFn: () => loansApi.searchGuarantorCandidates(search),
    enabled,
    staleTime: 60 * 1000,
  });
}

/** Creates an application. Refreshes applications only — no loan exists until an officer disburses. */
export function useCreateLoanApplication() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: (payload: CreateLoanApplicationPayload) => loansApi.createApplication(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanKeys.applications(tenant) });
    },
  });
}

/** Creates a PENDING repayment request — the loan balance doesn't move until an officer approves it. */
export function useSubmitLoanRepayment() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: (payload: SubmitLoanRepaymentPayload) => loansApi.submitRepaymentRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...loanKeys.all(tenant), 'repayment-requests'] });
    },
  });
}

/** Guarantor requests waiting for the caller's answer. */
export function useGuarantorRequests() {
  const tenant = useTenantKey();
  const access = useModuleAccess(COOPERATIVE_GUARANTOR_ACCESS, 'cooperatives');
  const memberId = useMemberId();
  return useQuery({
    queryKey: loanKeys.guarantorRequests(tenant),
    queryFn: () => guarantorsApi.listPending(),
    enabled: access && memberId !== undefined,
  });
}

/** Accept or decline. Refreshes the pending list, the member's guarantees (profile) and their own applications. */
export function useRespondToGuarantorRequest() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RespondToGuarantorRequestPayload }) => guarantorsApi.respond(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanKeys.guarantorRequests(tenant) });
      queryClient.invalidateQueries({ queryKey: cooperativesKeys.profile(tenant) });
      queryClient.invalidateQueries({ queryKey: loanKeys.applications(tenant) });
    },
  });
}
