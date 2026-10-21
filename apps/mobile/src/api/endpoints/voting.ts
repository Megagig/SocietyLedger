import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  ActiveVotingItemsDTO,
  BulkCastVotePayload,
  CastVotePayload,
  ElectionDetailDTO,
  ElectionsListResponseDTO,
  PollDetailDTO,
  PollsListResponseDTO,
  SelfNominatePayload,
  VoterStatusDTO,
} from '@/types/api/voting';

export type ListElectionsParams = { page?: number; limit?: number; status?: string };
/** `search`/`pollType` are real server-side filters (voting.validation.ts pollQuerySchema). */
export type ListPollsParams = { page?: number; limit?: number; status?: string; pollType?: string; search?: string };

/** `/voting/*` (tenant required — api-contract.md §9). */
export const votingApi = {
  /** GET /voting/active — verified against voting.service.ts getActiveVotingItems (2026-10-20).
   * Two separate lists (`activeElections`/`activePolls`), not one merged feed. */
  async getActive(): Promise<ActiveVotingItemsDTO> {
    return unwrap<ActiveVotingItemsDTO>(client.get('/voting/active'));
  },

  /** GET /voting/elections — verified 2026-10-21. Paginated list with positions select + _count. */
  async listElections(params: ListElectionsParams = {}): Promise<ElectionsListResponseDTO> {
    return unwrap<ElectionsListResponseDTO>(client.get('/voting/elections', { params: { page: 1, limit: 20, ...params } }));
  },

  /** GET /voting/elections/:id — full detail (already typed as ElectionDetailDTO). */
  async getElection(id: number): Promise<ElectionDetailDTO> {
    return unwrap<ElectionDetailDTO>(client.get(`/voting/elections/${id}`));
  },

  /** POST /voting/elections/:electionId/self-nominate — requires ELECTION_NOMINATE permission. */
  async selfNominate(electionId: number, payload: SelfNominatePayload): Promise<void> {
    await unwrap<undefined>(client.post(`/voting/elections/${electionId}/self-nominate`, payload));
  },

  /** POST /voting/elections/:electionId/vote — single position vote. */
  async castVote(electionId: number, payload: CastVotePayload): Promise<{ voteHash: string }> {
    return unwrap<{ voteHash: string }>(client.post(`/voting/elections/${electionId}/vote`, payload));
  },

  /** POST /voting/elections/:electionId/vote/bulk — all positions at once. */
  async bulkCastVotes(electionId: number, payload: BulkCastVotePayload): Promise<void> {
    await unwrap<undefined>(client.post(`/voting/elections/${electionId}/vote/bulk`, payload));
  },

  /** GET /voting/polls — verified 2026-10-21. Paginated list. */
  async listPolls(params: ListPollsParams = {}): Promise<PollsListResponseDTO> {
    return unwrap<PollsListResponseDTO>(client.get('/voting/polls', { params: { page: 1, limit: 20, ...params } }));
  },

  /** GET /voting/polls/:id — full poll row with options. */
  async getPoll(id: number): Promise<PollDetailDTO> {
    return unwrap<PollDetailDTO>(client.get(`/voting/polls/${id}`));
  },

  /** GET /voting/elections/:id/voter-status — whether the caller has voted. Requires ELECTION_VOTE. */
  async getVoterStatus(electionId: number): Promise<VoterStatusDTO> {
    return unwrap<VoterStatusDTO>(client.get(`/voting/elections/${electionId}/voter-status`));
  },

  /** POST /voting/polls/:pollId/respond — `{ optionIds: [number] }`. */
  async respondToPoll(pollId: number, optionIds: number[]): Promise<void> {
    await unwrap<undefined>(client.post(`/voting/polls/${pollId}/respond`, { optionIds }));
  },
};
