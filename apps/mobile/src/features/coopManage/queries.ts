import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { coopManageApi } from '@/api/endpoints/coopManage';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import type { SavingsDepositStatus } from '@/types/api/cooperatives';
import type { LoanApplicationStatus, LoanStatus } from '@/types/api/loans';

export const COOP_MODULE = 'cooperatives';

/** Every cooperative officer query sits under one root so a decision refreshes the whole section. */
export const coopKeys = {
  all: (tenant: string) => [tenant, 'cooperatives', 'admin'] as const,
  dashboard: (tenant: string) => [...coopKeys.all(tenant), 'dashboard'] as const,
  accounts: (tenant: string, filters: object) => [...coopKeys.all(tenant), 'accounts', filters] as const,
  account: (tenant: string, id: number) => [...coopKeys.all(tenant), 'account', id] as const,
  accountTransactions: (tenant: string, id: number) => [...coopKeys.all(tenant), 'account-transactions', id] as const,
  deposits: (tenant: string, status: string) => [...coopKeys.all(tenant), 'deposits', status] as const,
  repayments: (tenant: string, status: string) => [...coopKeys.all(tenant), 'repayment-requests', status] as const,
  products: (tenant: string, filters: object) => [...coopKeys.all(tenant), 'products', filters] as const,
  applications: (tenant: string, filters: object) => [...coopKeys.all(tenant), 'applications', filters] as const,
  application: (tenant: string, id: number) => [...coopKeys.all(tenant), 'application', id] as const,
  loans: (tenant: string, filters: object) => [...coopKeys.all(tenant), 'loans', filters] as const,
  loan: (tenant: string, id: number) => [...coopKeys.all(tenant), 'loan', id] as const,
  loanRepayments: (tenant: string, id: number) => [...coopKeys.all(tenant), 'loan-repayments', id] as const,
};

/** Seeing the cooperative section at all (`ledger.view`, with the module on). */
export const COOP_VIEW_ACCESS: PermissionAlias = 'COOPERATIVE_VIEW';
/** Opening accounts and recording deposits and withdrawals, and the deposit queue (`ledger.create`). */
export const COOP_SAVINGS_ACCESS: PermissionAlias = 'COOPERATIVE_SAVINGS_MANAGE';
/** Loan products, applications, loans, repayments and the repayment queue (`payments.approve`). */
export const COOP_LOANS_ACCESS: PermissionAlias = 'COOPERATIVE_LOANS_MANAGE';
/** Any officer cooperative permission: what makes Cooperatives appear in Manage. */
export const COOP_ADMIN_ACCESS: PermissionAlias[] = ['COOPERATIVE_SAVINGS_MANAGE', 'COOPERATIVE_LOANS_MANAGE'];

const PAGE = 20;

function useSavingsAccess() {
  return useModuleAccess(COOP_SAVINGS_ACCESS, COOP_MODULE);
}
function useLoansAccess() {
  return useModuleAccess(COOP_LOANS_ACCESS, COOP_MODULE);
}

export function useCoopDashboard() {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(COOP_ADMIN_ACCESS, COOP_MODULE);
  return useQuery({ queryKey: coopKeys.dashboard(tenant), queryFn: () => coopManageApi.getDashboard(), enabled });
}

export function useAccounts(filters: { search?: string; status?: string }) {
  const tenant = useTenantKey();
  const enabled = useSavingsAccess();
  return useInfiniteQuery({
    queryKey: coopKeys.accounts(tenant, filters),
    queryFn: ({ pageParam }) => coopManageApi.listAccounts({ ...filters, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useAccount(id: number) {
  const tenant = useTenantKey();
  const enabled = useSavingsAccess() && Number.isFinite(id);
  return useQuery({ queryKey: coopKeys.account(tenant, id), queryFn: () => coopManageApi.getAccount(id), enabled });
}

export function useAccountTransactions(id: number) {
  const tenant = useTenantKey();
  const enabled = useSavingsAccess() && Number.isFinite(id);
  return useInfiniteQuery({
    queryKey: coopKeys.accountTransactions(tenant, id),
    queryFn: ({ pageParam }) => coopManageApi.listAccountTransactions({ savingsAccountId: id, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/** A member's open accounts — what a loan can be credited to. */
export function useMemberOpenAccounts(memberId: number | null) {
  const tenant = useTenantKey();
  const enabled = useLoansAccess() && memberId !== null;
  return useQuery({
    queryKey: coopKeys.accounts(tenant, { memberId, status: 'ACTIVE', all: true }),
    queryFn: () => coopManageApi.listAccounts({ memberId: memberId as number, status: 'ACTIVE', limit: 50 }),
    select: (data) => data.accounts,
    enabled,
  });
}

export function useDepositRequests(status: SavingsDepositStatus) {
  const tenant = useTenantKey();
  const enabled = useSavingsAccess();
  return useInfiniteQuery({
    queryKey: coopKeys.deposits(tenant, status),
    queryFn: ({ pageParam }) => coopManageApi.listDepositRequests({ status, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useRepaymentRequests(status: SavingsDepositStatus) {
  const tenant = useTenantKey();
  const enabled = useLoansAccess();
  return useInfiniteQuery({
    queryKey: coopKeys.repayments(tenant, status),
    queryFn: ({ pageParam }) => coopManageApi.listRepaymentRequests({ status, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useLoanProducts() {
  const tenant = useTenantKey();
  const enabled = useLoansAccess();
  return useInfiniteQuery({
    queryKey: coopKeys.products(tenant, {}),
    queryFn: ({ pageParam }) => coopManageApi.listProducts({ page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useApplications(filters: { status?: LoanApplicationStatus; search?: string }) {
  const tenant = useTenantKey();
  const enabled = useLoansAccess();
  return useInfiniteQuery({
    queryKey: coopKeys.applications(tenant, filters),
    queryFn: ({ pageParam }) => coopManageApi.listApplications({ ...filters, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useApplication(id: number) {
  const tenant = useTenantKey();
  const enabled = useLoansAccess() && Number.isFinite(id);
  return useQuery({ queryKey: coopKeys.application(tenant, id), queryFn: () => coopManageApi.getApplication(id), enabled });
}

export function useLoans(filters: { status?: LoanStatus; search?: string }) {
  const tenant = useTenantKey();
  const enabled = useLoansAccess();
  return useInfiniteQuery({
    queryKey: coopKeys.loans(tenant, filters),
    queryFn: ({ pageParam }) => coopManageApi.listLoans({ ...filters, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useLoan(id: number) {
  const tenant = useTenantKey();
  const enabled = useLoansAccess() && Number.isFinite(id);
  return useQuery({ queryKey: coopKeys.loan(tenant, id), queryFn: () => coopManageApi.getLoan(id), enabled });
}

export function useLoanRepayments(id: number) {
  const tenant = useTenantKey();
  const enabled = useLoansAccess() && Number.isFinite(id);
  return useQuery({ queryKey: coopKeys.loanRepayments(tenant, id), queryFn: () => coopManageApi.listLoanRepayments({ loanId: id, limit: 50 }), enabled });
}
