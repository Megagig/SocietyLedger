import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { votingApi, type ListElectionsParams, type ListPollsParams } from '@/api/endpoints/voting';
import type { BulkCastVotePayload, SelfNominatePayload } from '@/types/api/voting';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import { useSessionStore } from '@/stores/session';

export const votingKeys = {
  all: (tenant: string) => [tenant, 'voting'] as const,
  active: (tenant: string) => [...votingKeys.all(tenant), 'active'] as const,
  elections: (tenant: string, params: ListElectionsParams) => [...votingKeys.all(tenant), 'elections', params] as const,
  election: (tenant: string, id: number) => [...votingKeys.all(tenant), 'election', id] as const,
  polls: (tenant: string, params: ListPollsParams) => [...votingKeys.all(tenant), 'polls', params] as const,
  poll: (tenant: string, id: number) => [...votingKeys.all(tenant), 'poll', id] as const,
  progress: (tenant: string, electionId: number) => [...votingKeys.all(tenant), 'progress', electionId] as const,
  voterStatus: (tenant: string, electionId: number) => [...votingKeys.all(tenant), 'voterStatus', electionId] as const,
};

/** `/voting/active` is gated server-side on `ELECTION_VIEW` — checked client-side first, same
 * reasoning as `features/meetings/queries.ts`'s `useUpcomingMeetings`. */
export function useActiveVoting() {
  const tenant = useTenantKey();
  const canView = useModuleAccess('ELECTION_VIEW', 'voting');

  return useQuery({
    queryKey: votingKeys.active(tenant),
    queryFn: votingApi.getActive,
    enabled: canView,
  });
}

export function useElections(params: ListElectionsParams = {}) {
  const tenant = useTenantKey();
  const canView = useModuleAccess('ELECTION_VIEW', 'voting');

  return useQuery({
    queryKey: votingKeys.elections(tenant, params),
    queryFn: () => votingApi.listElections(params),
    enabled: canView,
  });
}

export function useElectionDetail(id: number | undefined) {
  const tenant = useTenantKey();
  const canView = useModuleAccess('ELECTION_VIEW', 'voting');

  return useQuery({
    queryKey: votingKeys.election(tenant, id ?? 0),
    queryFn: () => votingApi.getElection(id!),
    enabled: canView && id !== undefined,
  });
}

/** How often the turnout of an election that is being voted on refreshes. */
export const PROGRESS_REFRESH_MS = 10_000;

/** Turnout while voting runs, refreshed every few seconds while the screen is open. */
export function useElectionProgress(electionId: number | undefined) {
  const tenant = useTenantKey();
  const canView = useModuleAccess('ELECTION_VIEW', 'voting');

  return useQuery({
    queryKey: votingKeys.progress(tenant, electionId ?? 0),
    queryFn: () => votingApi.getProgress(electionId!),
    enabled: canView && electionId !== undefined,
    refetchInterval: PROGRESS_REFRESH_MS,
  });
}

/** Elections whose results are published — the web "My Voting" history list (RESULTS_PUBLISHED, newest 10). */
export function useVotingHistoryElections() {
  return useElections({ status: 'RESULTS_PUBLISHED', limit: 10 });
}

/** Per-election `hasVoted` for the history list. Gated on ELECTION_VOTE (the server's own gate for this endpoint). */
export function useVoterStatuses(electionIds: number[]) {
  const tenant = useTenantKey();
  const canVote = useModuleAccess('ELECTION_VOTE', 'voting');
  const memberId = useSessionStore((s) => s.user?.member?.id);

  return useQueries({
    queries: electionIds.map((id) => ({
      queryKey: votingKeys.voterStatus(tenant, id),
      queryFn: () => votingApi.getVoterStatus(id),
      // voter status is per member; an account without a member record can't have voted.
      enabled: canVote && memberId !== undefined,
    })),
  });
}

export function useSelfNominate() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: ({ electionId, payload }: { electionId: number; payload: SelfNominatePayload }) =>
      votingApi.selfNominate(electionId, payload),
    onSuccess: (_data, { electionId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.election(tenant, electionId) });
    },
  });
}

export function useBulkCastVotes() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: ({ electionId, payload }: { electionId: number; payload: BulkCastVotePayload }) =>
      votingApi.bulkCastVotes(electionId, payload),
    onSuccess: (_data, { electionId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.election(tenant, electionId) });
      queryClient.invalidateQueries({ queryKey: votingKeys.voterStatus(tenant, electionId) });
      queryClient.invalidateQueries({ queryKey: votingKeys.active(tenant) });
    },
  });
}

export function usePolls(params: ListPollsParams = {}) {
  const tenant = useTenantKey();
  const canView = useModuleAccess('POLL_VIEW', 'voting');

  return useQuery({
    queryKey: votingKeys.polls(tenant, params),
    queryFn: () => votingApi.listPolls(params),
    enabled: canView,
  });
}

/** Paginated, server-filtered polls list (search / status / type are all real query params). */
export function usePollsInfinite(filters: Omit<ListPollsParams, 'page' | 'limit'>) {
  const tenant = useTenantKey();
  const canView = useModuleAccess('POLL_VIEW', 'voting');

  return useInfiniteQuery({
    queryKey: [...votingKeys.all(tenant), 'polls-infinite', filters] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => votingApi.listPolls({ ...filters, page: pageParam, limit: 20 }),
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled: canView,
  });
}

export function usePollDetail(id: number | undefined) {
  const tenant = useTenantKey();
  const canView = useModuleAccess('POLL_VIEW', 'voting');

  return useQuery({
    queryKey: votingKeys.poll(tenant, id ?? 0),
    queryFn: () => votingApi.getPoll(id!),
    enabled: canView && id !== undefined,
  });
}

export function useRespondToPoll() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: ({ pollId, optionIds }: { pollId: number; optionIds: number[] }) =>
      votingApi.respondToPoll(pollId, optionIds),
    onSuccess: (_data, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: votingKeys.poll(tenant, pollId) });
      queryClient.invalidateQueries({ queryKey: votingKeys.active(tenant) });
    },
  });
}
