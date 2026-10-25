import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { auditApi, rbacApi } from '@/api/endpoints/rbac';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import { AUDIT_ACCESS, ROLES_VIEW_ACCESS } from './labels';

export const rbacKeys = {
  all: (tenant: string) => [tenant, 'rbac'] as const,
  roles: (tenant: string) => [...rbacKeys.all(tenant), 'roles'] as const,
  permissions: (tenant: string) => [...rbacKeys.all(tenant), 'permissions'] as const,
  users: (tenant: string, search: string) => [...rbacKeys.all(tenant), 'users', search] as const,
  audit: (tenant: string, filters: object) => [...rbacKeys.all(tenant), 'audit', filters] as const,
  auditFilters: (tenant: string) => [...rbacKeys.all(tenant), 'audit-filters'] as const,
};

const PAGE = 20;

export function useRoles() {
  const tenant = useTenantKey();
  const enabled = useCan(ROLES_VIEW_ACCESS);
  return useQuery({ queryKey: rbacKeys.roles(tenant), queryFn: () => rbacApi.listRoles(), enabled });
}

export function usePermissions() {
  const tenant = useTenantKey();
  const enabled = useCan(ROLES_VIEW_ACCESS);
  return useQuery({ queryKey: rbacKeys.permissions(tenant), queryFn: () => rbacApi.listPermissions(), enabled, staleTime: 5 * 60 * 1000 });
}

export function useUsersInfinite(search: string) {
  const tenant = useTenantKey();
  const enabled = useCan(ROLES_VIEW_ACCESS);
  return useInfiniteQuery({
    queryKey: rbacKeys.users(tenant, search),
    queryFn: ({ pageParam }) => rbacApi.listUsers({ page: pageParam, limit: PAGE, search: search || undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export type AuditFilterState = { search: string; action: string; tableName: string; from?: string };

export function useAuditInfinite(filters: AuditFilterState) {
  const tenant = useTenantKey();
  const enabled = useCan(AUDIT_ACCESS);
  return useInfiniteQuery({
    queryKey: rbacKeys.audit(tenant, filters),
    queryFn: ({ pageParam }) =>
      auditApi.list({ page: pageParam, limit: PAGE, search: filters.search || undefined, action: filters.action || undefined, tableName: filters.tableName || undefined, from: filters.from }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAuditFilters() {
  const tenant = useTenantKey();
  const enabled = useCan(AUDIT_ACCESS);
  return useQuery({ queryKey: rbacKeys.auditFilters(tenant), queryFn: () => auditApi.filters(), enabled, staleTime: 5 * 60 * 1000 });
}
