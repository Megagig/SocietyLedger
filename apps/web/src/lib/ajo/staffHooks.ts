'use client';

/**
 * React Query hooks for the staff screens. Keys sit under `['ajo', …]`, the same root the member hooks use, so any write refreshes
 * every Ajo screen that could be showing the old figure.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ajoStaffApi, QUEUE_PAGE } from './staffApi';

const k = (...parts: Array<string | number | undefined>) => ['ajo', 'staff', ...parts.filter((p) => p !== undefined)] as const;

export const useGroups = () => useQuery({ queryKey: k('groups'), queryFn: ajoStaffApi.groups });
export const useGroupDetail = (id: number) => useQuery({ queryKey: k('group', id), queryFn: () => ajoStaffApi.groupDetail(id), enabled: id > 0 });
export const useRuleVersions = (id: number) => useQuery({ queryKey: k('rules', id), queryFn: () => ajoStaffApi.ruleVersions(id), enabled: id > 0 });
export const usePeople = (id: number) => useQuery({ queryKey: k('people', id), queryFn: () => ajoStaffApi.people(id), enabled: id > 0 });
export const useGroupTrust = (id: number) => useQuery({ queryKey: k('trust', id), queryFn: () => ajoStaffApi.groupTrust(id), enabled: id > 0 });
export const useRoster = (id: number) => useQuery({ queryKey: k('roster', id), queryFn: () => ajoStaffApi.roster(id), enabled: id > 0 });
export const useOrder = (id: number) => useQuery({ queryKey: k('order', id), queryFn: () => ajoStaffApi.order(id), enabled: id > 0 });
export const useSwaps = (id: number) => useQuery({ queryKey: k('swaps', id), queryFn: () => ajoStaffApi.swaps(id), enabled: id > 0 });
/** The payments queue a page at a time: `items` is everything loaded so far, `total` is how many there are, `hasMore` says whether to offer "Show more". */
export function useQueue(id: number, status?: string) {
  const q = useInfiniteQuery({
    queryKey: k('queue', id, status),
    queryFn: ({ pageParam = 0 }) => ajoStaffApi.queue(id, { ...(status ? { status } : {}), skip: pageParam }),
    getNextPageParam: (last, all) => { const loaded = all.reduce((n, p) => n + p.items.length, 0); return loaded < last.total ? loaded : undefined; },
    enabled: id > 0,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return { ...q, items, total: q.data?.pages[0]?.total ?? 0, hasMore: !!q.hasNextPage };
}
/** Cash handovers a page at a time; a full page means there may be more. */
export function useHandovers(id: number, reconciled?: boolean) {
  const q = useInfiniteQuery({
    queryKey: k('handovers', id, String(reconciled)),
    queryFn: ({ pageParam = 0 }) => ajoStaffApi.handovers(id, reconciled, pageParam),
    getNextPageParam: (last, all) => (last.length === QUEUE_PAGE ? all.reduce((n, p) => n + p.length, 0) : undefined),
    enabled: id > 0,
  });
  return { ...q, items: q.data?.pages.flat() ?? [], hasMore: !!q.hasNextPage };
}
export const useCollectors = (id: number) => useQuery({ queryKey: k('collectors', id), queryFn: () => ajoStaffApi.collectors(id), enabled: id > 0 });
/** Listing collectors needs ajo.manage, so a screen that may be opened by someone without it passes `enabled` instead of making a request that is refused. */
export const useCollectorCandidates = (enabled = true) => useQuery({ queryKey: k('collector-candidates'), queryFn: ajoStaffApi.collectorCandidates, enabled });
export const useMyContributors = () => useQuery({ queryKey: k('my-contributors'), queryFn: ajoStaffApi.myContributors });
export const useCollectorDay = (id: number) => useQuery({ queryKey: k('collector-day', id), queryFn: () => ajoStaffApi.collectorDay(id), enabled: id > 0 });
export const usePayouts = (id: number) => useQuery({ queryKey: k('payouts', id), queryFn: () => ajoStaffApi.payouts(id), enabled: id > 0 });
export const useLateFees = (id: number) => useQuery({ queryKey: k('late-fees', id), queryFn: () => ajoStaffApi.groupLateFees(id), enabled: id > 0 });
export const useGroupDisputes = (id: number) => useQuery({ queryKey: k('disputes', id), queryFn: () => ajoStaffApi.groupDisputes(id), enabled: id > 0 });
export const useGroupCases = (id: number) => useQuery({ queryKey: k('cases', id), queryFn: () => ajoStaffApi.groupCases(id), enabled: id > 0 });
export const useCase = (id: number) => useQuery({ queryKey: k('case', id), queryFn: () => ajoStaffApi.getCase(id), enabled: id > 0 });

/** A write. Whatever it changes, every Ajo screen refetches, which is cheap and never shows a stale balance. */
export function useAjoAction<Input, Output = unknown>(fn: (input: Input) => Promise<Output>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries({ queryKey: ['ajo'] }) });
}
