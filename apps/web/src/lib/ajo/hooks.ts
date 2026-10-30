'use client';

/**
 * React Query hooks for the Ajo screens. Keys are grouped under `ajo` so a write can refresh everything that depends on it.
 * A group's full bank account number and a proof are never kept here: they are fetched on demand with `gcTime`-less one-off calls.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ajoApi } from './api';

export const ajoKeys = {
  all: ['ajo'] as const,
  status: () => ['ajo', 'status'] as const,
  mine: () => ['ajo', 'mine'] as const,
  group: (groupId: number) => ['ajo', 'group', groupId] as const,
  schedule: (membershipId: number) => ['ajo', 'schedule', membershipId] as const,
  contributions: (membershipId: number) => ['ajo', 'contributions', membershipId] as const,
  lateFees: (membershipId: number) => ['ajo', 'late-fees', membershipId] as const,
  trust: (membershipId: number) => ['ajo', 'trust', membershipId] as const,
  disputes: (membershipId: number) => ['ajo', 'disputes', membershipId] as const,
  cases: (membershipId: number) => ['ajo', 'cases', membershipId] as const,
  myPayouts: () => ['ajo', 'my-payouts'] as const,
  rules: (membershipId: number) => ['ajo', 'rules', membershipId] as const,
  payoutAccount: () => ['ajo', 'payout-account'] as const,
  verification: () => ['ajo', 'verification'] as const,
};

export const useAjoStatus = () => useQuery({ queryKey: ajoKeys.status(), queryFn: ajoApi.status, staleTime: 30_000, retry: false });
export const useMyMemberships = (enabled = true) => useQuery({ queryKey: ajoKeys.mine(), queryFn: ajoApi.mine, enabled });
export const useGroup = (groupId: number) => useQuery({ queryKey: ajoKeys.group(groupId), queryFn: () => ajoApi.group(groupId), enabled: groupId > 0 });
export const useSchedule = (membershipId: number) => useQuery({ queryKey: ajoKeys.schedule(membershipId), queryFn: () => ajoApi.schedule(membershipId), enabled: membershipId > 0 });
export const useContributions = (membershipId: number) => useQuery({ queryKey: ajoKeys.contributions(membershipId), queryFn: () => ajoApi.contributions(membershipId), enabled: membershipId > 0 });
export const useLateFees = (membershipId: number) => useQuery({ queryKey: ajoKeys.lateFees(membershipId), queryFn: () => ajoApi.lateFees(membershipId), enabled: membershipId > 0 });
export const useTrust = (membershipId: number) => useQuery({ queryKey: ajoKeys.trust(membershipId), queryFn: () => ajoApi.trust(membershipId), enabled: membershipId > 0 });
export const useDisputes = (membershipId: number) => useQuery({ queryKey: ajoKeys.disputes(membershipId), queryFn: () => ajoApi.disputes(membershipId), enabled: membershipId > 0 });
export const useMemberCases = (membershipId: number) => useQuery({ queryKey: ajoKeys.cases(membershipId), queryFn: () => ajoApi.cases(membershipId), enabled: membershipId > 0 });
export const useMyPayouts = () => useQuery({ queryKey: ajoKeys.myPayouts(), queryFn: ajoApi.myPayouts });
export const useRulesToAccept = (membershipId: number) => useQuery({ queryKey: ajoKeys.rules(membershipId), queryFn: () => ajoApi.rulesToAccept(membershipId), enabled: membershipId > 0 });
export const usePayoutAccount = () => useQuery({ queryKey: ajoKeys.payoutAccount(), queryFn: ajoApi.payoutAccount });
export const useVerification = () => useQuery({ queryKey: ajoKeys.verification(), queryFn: ajoApi.verification });

/** Anything a write can change is refreshed together; it is cheap and avoids showing a stale balance. */
function useRefreshAjo() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ajoKeys.all });
}

export function useReportTransfer(groupId: number) {
  const refresh = useRefreshAjo();
  return useMutation({ mutationFn: (input: Parameters<typeof ajoApi.reportTransfer>[1]) => ajoApi.reportTransfer(groupId, input), onSuccess: refresh });
}

export function useAcceptRules(membershipId: number) {
  const refresh = useRefreshAjo();
  return useMutation({ mutationFn: (body: { ruleVersionId: number; note?: string }) => ajoApi.acceptRules(membershipId, body), onSuccess: refresh });
}

export function useRespondToCase() {
  const refresh = useRefreshAjo();
  return useMutation({ mutationFn: (input: { caseId: number; note: string }) => ajoApi.respondToCase(input.caseId, input.note), onSuccess: refresh });
}

export function useSavePayoutAccount() {
  const refresh = useRefreshAjo();
  return useMutation({ mutationFn: ajoApi.savePayoutAccount, onSuccess: refresh });
}

export function useRaiseDispute(membershipId: number) {
  const refresh = useRefreshAjo();
  return useMutation({ mutationFn: (input: Parameters<typeof ajoApi.raiseDispute>[1]) => ajoApi.raiseDispute(membershipId, input), onSuccess: refresh });
}
