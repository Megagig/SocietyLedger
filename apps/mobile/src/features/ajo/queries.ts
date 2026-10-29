import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { AJO_QUEUE_PAGE, ajoApi } from '@/api/endpoints/ajo';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';

/** The module code the API answers `MODULE_DISABLED` with. */
export const AJO_MODULE = 'ajo';

/** Seeing one's own circles: contributors hold `ajo.view_own`. */
export const AJO_MEMBER_ACCESS: PermissionAlias[] = ['AJO_VIEW_OWN'];
/** Taking collections as a collector. */
export const AJO_COLLECT_ACCESS: PermissionAlias[] = ['AJO_COLLECT'];
/** Running circles: managing, reconciling or approving payouts. Each screen inside checks its own permission too. */
export const AJO_STAFF_ACCESS: PermissionAlias[] = ['AJO_MANAGE', 'AJO_RECONCILE', 'AJO_APPROVE_PAYOUT'];
/** Anything in Ajo at all. */
export const AJO_ANY_ACCESS: PermissionAlias[] = ['AJO_VIEW_OWN', 'AJO_COLLECT', 'AJO_MANAGE', 'AJO_RECONCILE', 'AJO_APPROVE_PAYOUT', 'AJO_REPORTS'];

/** Query keys start with the tenant (code-standards.md §6) and share the `ajo` root, so a write refreshes every Ajo screen. */
export const ajoKeys = {
  all: (tenant: string) => [tenant, 'ajo'] as const,
  status: (tenant: string) => [...ajoKeys.all(tenant), 'status'] as const,
  mine: (tenant: string) => [...ajoKeys.all(tenant), 'mine'] as const,
  group: (tenant: string, groupId: number) => [...ajoKeys.all(tenant), 'group', groupId] as const,
  schedule: (tenant: string, membershipId: number) => [...ajoKeys.all(tenant), 'schedule', membershipId] as const,
  contributions: (tenant: string, membershipId: number) => [...ajoKeys.all(tenant), 'contributions', membershipId] as const,
  lateFees: (tenant: string, membershipId: number) => [...ajoKeys.all(tenant), 'late-fees', membershipId] as const,
  trust: (tenant: string, membershipId: number) => [...ajoKeys.all(tenant), 'trust', membershipId] as const,
  disputes: (tenant: string, membershipId: number) => [...ajoKeys.all(tenant), 'disputes', membershipId] as const,
  rules: (tenant: string, membershipId: number) => [...ajoKeys.all(tenant), 'rules', membershipId] as const,
  payoutAccount: (tenant: string) => [...ajoKeys.all(tenant), 'payout-account'] as const,
  verification: (tenant: string) => [...ajoKeys.all(tenant), 'verification'] as const,
  staff: (tenant: string, ...parts: (string | number | undefined)[]) => [...ajoKeys.all(tenant), 'staff', ...parts.filter((p) => p !== undefined)] as const,
};

const valid = (id: number) => Number.isFinite(id) && id > 0;

/** What this account can do with Ajo now: full, read-only, locked or forbidden. Shared by the gate and the navigation entries. */
export function useAjoStatus(enabled = true) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.status(tenant), queryFn: () => ajoApi.status(), staleTime: 30_000, retry: false, enabled });
}

// ── contributor ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function useMyMemberships(enabled = true) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.mine(tenant), queryFn: () => ajoApi.mine(), enabled });
}
export function useGroup(groupId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.group(tenant, groupId), queryFn: () => ajoApi.group(groupId), enabled: valid(groupId) });
}
export function useSchedule(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.schedule(tenant, membershipId), queryFn: () => ajoApi.schedule(membershipId), enabled: valid(membershipId) });
}
export function useContributions(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.contributions(tenant, membershipId), queryFn: () => ajoApi.contributions(membershipId), enabled: valid(membershipId) });
}
export function useMyLateFees(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.lateFees(tenant, membershipId), queryFn: () => ajoApi.lateFees(membershipId), enabled: valid(membershipId) });
}
export function useTrust(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.trust(tenant, membershipId), queryFn: () => ajoApi.trust(membershipId), enabled: valid(membershipId) });
}
export function useMyDisputes(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.disputes(tenant, membershipId), queryFn: () => ajoApi.disputes(membershipId), enabled: valid(membershipId) });
}
export function useRulesToAccept(membershipId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.rules(tenant, membershipId), queryFn: () => ajoApi.rulesToAccept(membershipId), enabled: valid(membershipId) });
}
export function usePayoutAccount() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.payoutAccount(tenant), queryFn: () => ajoApi.payoutAccount() });
}
export function useVerification() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.verification(tenant), queryFn: () => ajoApi.verification() });
}

// ── staff ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function useGroups() {
  const tenant = useTenantKey();
  const enabled = useCan(AJO_STAFF_ACCESS);
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'groups'), queryFn: () => ajoApi.groups(), enabled });
}
export function useGroupDetail(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'group', id), queryFn: () => ajoApi.groupDetail(id), enabled: valid(id) });
}
export function useRuleVersions(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'rules', id), queryFn: () => ajoApi.ruleVersions(id), enabled: valid(id) });
}
export function usePeople(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'people', id), queryFn: () => ajoApi.people(id), enabled: valid(id) });
}
export function useRoster(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'roster', id), queryFn: () => ajoApi.roster(id), enabled: valid(id) });
}
export function useOrder(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'order', id), queryFn: () => ajoApi.order(id), enabled: valid(id) });
}
export function useSwaps(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'swaps', id), queryFn: () => ajoApi.swaps(id), enabled: valid(id) });
}
/** The payments queue a page at a time: `items` is everything loaded so far, `total` is how many there are, `hasMore` says whether to offer "Show more". */
export function useQueue(id: number, status?: string) {
  const tenant = useTenantKey();
  const query = useInfiniteQuery({
    queryKey: ajoKeys.staff(tenant, 'queue', id, status ?? 'all'),
    queryFn: ({ pageParam }) => ajoApi.queue(id, { ...(status ? { status } : {}), skip: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, page) => n + page.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled: valid(id),
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return { ...query, items, total: query.data?.pages[0]?.total ?? 0, hasMore: !!query.hasNextPage };
}
/** Cash handovers a page at a time; a full page means there may be more. */
export function useHandovers(id: number, reconciled?: boolean) {
  const tenant = useTenantKey();
  const query = useInfiniteQuery({
    queryKey: ajoKeys.staff(tenant, 'handovers', id, String(reconciled)),
    queryFn: ({ pageParam }) => ajoApi.handovers(id, reconciled, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === AJO_QUEUE_PAGE ? all.reduce((n, page) => n + page.length, 0) : undefined),
    enabled: valid(id),
  });
  return { ...query, items: query.data?.pages.flat() ?? [], hasMore: !!query.hasNextPage };
}
export function useHandover(handoverId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'handover', handoverId), queryFn: () => ajoApi.handover(handoverId), enabled: valid(handoverId) });
}
export function useCollectors(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'collectors', id), queryFn: () => ajoApi.collectors(id), enabled: valid(id) });
}
export function useCollectorCandidates() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'collector-candidates'), queryFn: () => ajoApi.collectorCandidates() });
}
export function useMyContributors() {
  const tenant = useTenantKey();
  const enabled = useCan(AJO_COLLECT_ACCESS);
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'my-contributors'), queryFn: () => ajoApi.myContributors(), enabled });
}
export function useCollectorDay(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'collector-day', id), queryFn: () => ajoApi.collectorDay(id), enabled: valid(id) });
}
export function usePayouts(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'payouts', id), queryFn: () => ajoApi.payouts(id), enabled: valid(id) });
}
export function usePayoutPreview(id: number, params: { round?: number; membershipId?: number }, enabled = true) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ajoKeys.staff(tenant, 'payout-preview', id, params.round, params.membershipId),
    queryFn: () => ajoApi.payoutPreview(id, params),
    enabled: enabled && valid(id),
    staleTime: 0,
  });
}
export function useGroupLateFees(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'late-fees', id), queryFn: () => ajoApi.groupLateFees(id), enabled: valid(id) });
}
export function useGroupDisputes(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'disputes', id), queryFn: () => ajoApi.groupDisputes(id), enabled: valid(id) });
}
export function useGroupCases(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'cases', id), queryFn: () => ajoApi.groupCases(id), enabled: valid(id) });
}
export function useCase(id: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ajoKeys.staff(tenant, 'case', id), queryFn: () => ajoApi.getCase(id), enabled: valid(id) });
}
