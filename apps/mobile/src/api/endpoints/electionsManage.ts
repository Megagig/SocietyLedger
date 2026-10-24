import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  CandidateMemberDTO,
  DecideCandidatePayload,
  ElectionPayload,
  ElectionResultsDTO,
  PollOptionPayload,
  PollPayload,
  PollResultsDTO,
  PollUpdatePayload,
  PositionPayload,
  RegisterCandidatePayload,
} from '@/types/api/electionsManage';
import type { CandidateDTO, ElectionDetailDTO, ElectionPositionDTO, PollDetailDTO, VotingDashboardDTO } from '@/types/api/voting';

const BASE = '/voting';

/**
 * Elections and polls for the committee. Each step of an election is taken from one status only and happens once (409 `WRONG_STATUS`,
 * `ALREADY_DONE`); the rule failures carry a plain-words message and a stable `code` (see voting-rules.ts).
 */
export const electionsManageApi = {
  async getDashboard(): Promise<VotingDashboardDTO> {
    return unwrap<VotingDashboardDTO>(client.get(`${BASE}/dashboard`));
  },

  // ---------------------------------------------------------------- elections
  async createElection(payload: ElectionPayload): Promise<ElectionDetailDTO> {
    return unwrap<ElectionDetailDTO>(client.post(`${BASE}/elections`, payload));
  },

  /** Only while the election is a draft. Positions are changed with their own calls. */
  async updateElection(id: number, payload: Partial<Omit<ElectionPayload, 'positions'>>): Promise<ElectionDetailDTO> {
    return unwrap<ElectionDetailDTO>(client.put(`${BASE}/elections/${id}`, payload));
  },

  /** Only a draft or cancelled election with no votes. */
  async deleteElection(id: number): Promise<unknown> {
    return unwrap<unknown>(client.delete(`${BASE}/elections/${id}`));
  },

  async startNominations(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/elections/${id}/start-nominations`));
  },

  async closeNominations(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/elections/${id}/close-nominations`));
  },

  /** 409 `PENDING_CANDIDATES` / `NO_CANDIDATES` / `VOTING_WINDOW_PASSED` explain what is missing. */
  async startVoting(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/elections/${id}/start-voting`));
  },

  async closeVoting(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/elections/${id}/close-voting`));
  },

  /** 409 `QUORUM_NOT_MET` when too few members voted. */
  async publishResults(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/elections/${id}/publish-results`));
  },

  /** A reason is required (400 `REASON_REQUIRED`); members can read it. */
  async cancelElection(id: number, reason: string): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/elections/${id}/cancel`, { reason }));
  },

  async getResults(id: number): Promise<ElectionResultsDTO> {
    return unwrap<ElectionResultsDTO>(client.get(`${BASE}/elections/${id}/results`));
  },

  // ---------------------------------------------------------------- positions
  async addPosition(electionId: number, payload: PositionPayload): Promise<ElectionPositionDTO> {
    return unwrap<ElectionPositionDTO>(client.post(`${BASE}/elections/${electionId}/positions`, payload));
  },

  async updatePosition(positionId: number, payload: Partial<PositionPayload>): Promise<ElectionPositionDTO> {
    return unwrap<ElectionPositionDTO>(client.put(`${BASE}/positions/${positionId}`, payload));
  },

  /** 409 `HAS_CANDIDATES` while someone is standing for it. */
  async deletePosition(positionId: number): Promise<unknown> {
    return unwrap<unknown>(client.delete(`${BASE}/positions/${positionId}`));
  },

  // ---------------------------------------------------------------- candidates
  async searchMembers(search: string): Promise<CandidateMemberDTO[]> {
    return unwrap<CandidateMemberDTO[]>(client.get(`${BASE}/candidate-members`, { params: { search: search || undefined, limit: 20 } }));
  },

  async registerCandidate(electionId: number, payload: RegisterCandidatePayload): Promise<CandidateDTO> {
    return unwrap<CandidateDTO>(client.post(`${BASE}/elections/${electionId}/candidates`, payload));
  },

  /** 403 `OWN_NOMINATION` for your own; 409 `ALREADY_DECIDED` / `CANDIDATES_LOCKED`. */
  async decideCandidate(candidateId: number, payload: DecideCandidatePayload): Promise<CandidateDTO> {
    return unwrap<CandidateDTO>(client.post(`${BASE}/candidates/${candidateId}/approve`, payload));
  },

  // ---------------------------------------------------------------- polls
  async createPoll(payload: PollPayload): Promise<PollDetailDTO> {
    return unwrap<PollDetailDTO>(client.post(`${BASE}/polls`, payload));
  },

  async updatePoll(id: number, payload: PollUpdatePayload): Promise<PollDetailDTO> {
    return unwrap<PollDetailDTO>(client.put(`${BASE}/polls/${id}`, payload));
  },

  /** Only a draft or cancelled poll with no answers. */
  async deletePoll(id: number): Promise<unknown> {
    return unwrap<unknown>(client.delete(`${BASE}/polls/${id}`));
  },

  async startPoll(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/polls/${id}/start`));
  },

  async closePoll(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/polls/${id}/close`));
  },

  async cancelPoll(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/polls/${id}/cancel`));
  },

  async addPollOption(pollId: number, payload: PollOptionPayload): Promise<unknown> {
    return unwrap<unknown>(client.post(`${BASE}/polls/${pollId}/options`, payload));
  },

  async deletePollOption(optionId: number): Promise<unknown> {
    return unwrap<unknown>(client.delete(`${BASE}/options/${optionId}`));
  },

  async getPollResults(id: number): Promise<PollResultsDTO> {
    return unwrap<PollResultsDTO>(client.get(`${BASE}/polls/${id}/results`));
  },
};
