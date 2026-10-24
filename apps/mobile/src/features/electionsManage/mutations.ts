import { useMutation, useQueryClient } from '@tanstack/react-query';

import { electionsManageApi } from '@/api/endpoints/electionsManage';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { DecideCandidatePayload, ElectionPayload, PollOptionPayload, PollPayload, PollUpdatePayload, PositionPayload, RegisterCandidatePayload } from '@/types/api/electionsManage';
import type { ElectionStepAction } from './labels';

/**
 * Anything the committee does is also something members see (the election's status, who is standing, a poll's answers), and the queue
 * counts on Home and the Manage hub come from the dashboard, so all three are refreshed.
 */
function useInvalidateVoting() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    for (const root of ['voting', 'dashboard']) {
      void queryClient.invalidateQueries({ queryKey: [tenant, root] });
    }
  };
}

export function useCreateElection() {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (payload: ElectionPayload) => electionsManageApi.createElection(payload), onSuccess: invalidate });
}

export function useUpdateElection(id: number) {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (payload: Partial<Omit<ElectionPayload, 'positions'>>) => electionsManageApi.updateElection(id, payload), onSuccess: invalidate });
}

export function useDeleteElection() {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (id: number) => electionsManageApi.deleteElection(id), onSuccess: invalidate });
}

/** One step of the election: open or close nominations, open or close voting, publish the results. */
export function useElectionStep(id: number) {
  const invalidate = useInvalidateVoting();
  return useMutation({
    mutationFn: (action: ElectionStepAction) => electionsManageApi[action](id),
    onSuccess: invalidate,
    // A step that was refused (someone else moved first, or the ballot isn't ready) still tells us where the election is now.
    onError: invalidate,
  });
}

export function useCancelElection(id: number) {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (reason: string) => electionsManageApi.cancelElection(id, reason), onSuccess: invalidate, onError: invalidate });
}

export function useAddPosition(electionId: number) {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (payload: PositionPayload) => electionsManageApi.addPosition(electionId, payload), onSuccess: invalidate });
}

export function useUpdatePosition() {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (v: { id: number; payload: Partial<PositionPayload> }) => electionsManageApi.updatePosition(v.id, v.payload), onSuccess: invalidate });
}

export function useDeletePosition() {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (id: number) => electionsManageApi.deletePosition(id), onSuccess: invalidate });
}

export function useRegisterCandidate(electionId: number) {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (payload: RegisterCandidatePayload) => electionsManageApi.registerCandidate(electionId, payload), onSuccess: invalidate });
}

export function useDecideCandidate() {
  const invalidate = useInvalidateVoting();
  return useMutation({
    mutationFn: (v: { id: number; payload: DecideCandidatePayload }) => electionsManageApi.decideCandidate(v.id, v.payload),
    onSuccess: invalidate,
    onError: invalidate,
  });
}

// ---------------------------------------------------------------- polls

export function useCreatePoll() {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (payload: PollPayload) => electionsManageApi.createPoll(payload), onSuccess: invalidate });
}

export function useUpdatePoll(id: number) {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (payload: PollUpdatePayload) => electionsManageApi.updatePoll(id, payload), onSuccess: invalidate });
}

export function useDeletePoll() {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (id: number) => electionsManageApi.deletePoll(id), onSuccess: invalidate });
}

export function usePollStep(id: number) {
  const invalidate = useInvalidateVoting();
  return useMutation({
    mutationFn: (action: 'startPoll' | 'closePoll' | 'cancelPoll') => electionsManageApi[action](id),
    onSuccess: invalidate,
    onError: invalidate,
  });
}

export function useAddPollOption(pollId: number) {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (payload: PollOptionPayload) => electionsManageApi.addPollOption(pollId, payload), onSuccess: invalidate });
}

export function useDeletePollOption() {
  const invalidate = useInvalidateVoting();
  return useMutation({ mutationFn: (id: number) => electionsManageApi.deletePollOption(id), onSuccess: invalidate });
}
