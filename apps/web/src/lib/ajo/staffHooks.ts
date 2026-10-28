'use client';

/**
 * React Query hooks for the staff screens. Keys sit under `['ajo', …]`, the same root the member hooks use, so any write refreshes
 * every Ajo screen that could be showing the old figure.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ajoStaffApi } from './staffApi';

const k = (...parts: Array<string | number | undefined>) => ['ajo', 'staff', ...parts.filter((p) => p !== undefined)] as const;

export const useGroups = () => useQuery({ queryKey: k('groups'), queryFn: ajoStaffApi.groups });
export const useGroupDetail = (id: number) => useQuery({ queryKey: k('group', id), queryFn: () => ajoStaffApi.groupDetail(id), enabled: id > 0 });
export const useRuleVersions = (id: number) => useQuery({ queryKey: k('rules', id), queryFn: () => ajoStaffApi.ruleVersions(id), enabled: id > 0 });
export const useRoster = (id: number) => useQuery({ queryKey: k('roster', id), queryFn: () => ajoStaffApi.roster(id), enabled: id > 0 });
export const useOrder = (id: number) => useQuery({ queryKey: k('order', id), queryFn: () => ajoStaffApi.order(id), enabled: id > 0 });
export const useSwaps = (id: number) => useQuery({ queryKey: k('swaps', id), queryFn: () => ajoStaffApi.swaps(id), enabled: id > 0 });
export const useQueue = (id: number, status?: string) => useQuery({ queryKey: k('queue', id, status), queryFn: () => ajoStaffApi.queue(id, status ? { status } : {}), enabled: id > 0 });
export const useHandovers = (id: number, reconciled?: boolean) => useQuery({ queryKey: k('handovers', id, String(reconciled)), queryFn: () => ajoStaffApi.handovers(id, reconciled), enabled: id > 0 });
export const useCollectors = (id: number) => useQuery({ queryKey: k('collectors', id), queryFn: () => ajoStaffApi.collectors(id), enabled: id > 0 });
export const useCollectorCandidates = () => useQuery({ queryKey: k('collector-candidates'), queryFn: ajoStaffApi.collectorCandidates });
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
