import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { electionsManageApi } from '@/api/endpoints/electionsManage';
import { votingApi } from '@/api/endpoints/voting';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import { votingKeys } from '@/features/voting/queries';
import { ELECTION_ADMIN_ACCESS, VOTING_MODULE } from './labels';

export { VOTING_MODULE };

const PAGE = 20;

/** Everything the committee reads sits under the member voting root, so one refresh after a decision updates both sides. */
export const electionAdminKeys = {
  dashboard: (tenant: string) => [...votingKeys.all(tenant), 'admin', 'dashboard'] as const,
  elections: (tenant: string, filters: object) => [...votingKeys.all(tenant), 'admin', 'elections', filters] as const,
  results: (tenant: string, id: number) => [...votingKeys.all(tenant), 'admin', 'results', id] as const,
  members: (tenant: string, search: string) => [...votingKeys.all(tenant), 'admin', 'members', search] as const,
  myEligibility: (tenant: string, id: number) => [...votingKeys.all(tenant), 'admin', 'myEligibility', id] as const,
  eligibility: (tenant: string, id: number) => [...votingKeys.all(tenant), 'admin', 'eligibility', id] as const,
  template: (tenant: string) => [...votingKeys.all(tenant), 'admin', 'eligibilityTemplate'] as const,
  options: (tenant: string) => [...votingKeys.all(tenant), 'admin', 'eligibilityOptions'] as const,
  pollResults: (tenant: string, id: number) => [...votingKeys.all(tenant), 'admin', 'pollResults', id] as const,
};

/** What is waiting for the committee, plus how many elections and polls there are. */
export function useVotingDashboard() {
  const tenant = useTenantKey();
  const enabled = useModuleAccess([...ELECTION_ADMIN_ACCESS, 'POLL_MANAGE'], VOTING_MODULE);
  return useQuery({ queryKey: electionAdminKeys.dashboard(tenant), queryFn: () => electionsManageApi.getDashboard(), enabled });
}

/** Every election of the association, newest first, optionally one status. */
export function useAdminElections(filters: { status?: string } = {}) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(ELECTION_ADMIN_ACCESS, VOTING_MODULE);
  return useInfiniteQuery({
    queryKey: electionAdminKeys.elections(tenant, filters),
    queryFn: ({ pageParam }) => votingApi.listElections({ ...filters, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/**
 * The results, for whoever may see them now: the committee once voting has closed, everyone once they are published. `enabled` is false
 * while voting is still open, because nobody can read a tally then.
 */
export function useElectionResults(id: number, enabled: boolean) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: electionAdminKeys.results(tenant, id), queryFn: () => electionsManageApi.getResults(id), enabled: enabled && Number.isFinite(id), retry: false });
}

/** Active members to put forward as candidates; the committee has no members list, so this is their search. */
export function useCandidateMemberSearch(search: string, enabled: boolean) {
  const tenant = useTenantKey();
  const term = search.trim();
  return useQuery({
    queryKey: electionAdminKeys.members(tenant, term),
    queryFn: () => electionsManageApi.searchMembers(term),
    enabled,
    staleTime: 30 * 1000,
  });
}

/** May I vote, may I stand, and what does this election ask of people. Nobody is turned away unless the association set a rule. */
export function useMyEligibility(electionId: number | undefined) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess('ELECTION_VIEW', VOTING_MODULE);
  return useQuery({
    queryKey: electionAdminKeys.myEligibility(tenant, electionId ?? 0),
    queryFn: () => electionsManageApi.getMyEligibility(electionId!),
    enabled: enabled && electionId !== undefined,
    staleTime: 15 * 1000,
  });
}

/** The rules and exceptions of one election, for the committee. */
export function useElectionEligibility(electionId: number | undefined) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess('ELECTION_MANAGE', VOTING_MODULE);
  return useQuery({ queryKey: electionAdminKeys.eligibility(tenant, electionId ?? 0), queryFn: () => electionsManageApi.getElectionEligibility(electionId!), enabled: enabled && electionId !== undefined });
}

/** The association's template: the rules new elections start from. */
export function useEligibilityTemplate() {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(['ELECTION_MANAGE', 'ELECTION_RULES'], VOTING_MODULE);
  return useQuery({ queryKey: electionAdminKeys.template(tenant), queryFn: () => electionsManageApi.getEligibilityTemplate(), enabled });
}

/** What the rule forms offer to choose from (the member categories in use here). */
export function useEligibilityOptions() {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(['ELECTION_MANAGE', 'ELECTION_RULES'], VOTING_MODULE);
  return useQuery({ queryKey: electionAdminKeys.options(tenant), queryFn: () => electionsManageApi.getEligibilityOptions(), enabled, staleTime: 5 * 60 * 1000 });
}

export function usePollResults(id: number, enabled: boolean) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: electionAdminKeys.pollResults(tenant, id), queryFn: () => electionsManageApi.getPollResults(id), enabled: enabled && Number.isFinite(id), retry: false });
}
