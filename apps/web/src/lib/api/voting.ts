import { apiGet, apiPost, apiPut, apiDelete } from '@/utils/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================
// VOTING & ELECTIONS API CLIENT
// Phase 4.5
// ============================================

// Enums
export type ElectionType = 'GENERAL' | 'BY_ELECTION' | 'REFERENDUM';
export type ElectionStatus = 'DRAFT' | 'NOMINATIONS_OPEN' | 'NOMINATIONS_CLOSED' | 'VOTING_OPEN' | 'VOTING_CLOSED' | 'RESULTS_PUBLISHED' | 'CANCELLED';
export type CandidateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type PollType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RANKED_CHOICE' | 'YES_NO';
export type PollStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

// Types
export interface Election {
  id: number;
  title: string;
  description?: string;
  electionType: ElectionType;
  status: ElectionStatus;
  nominationStartDate?: string;
  nominationEndDate?: string;
  votingStartDate?: string;
  votingEndDate?: string;
  resultsPublishedAt?: string;
  isAnonymous: boolean;
  allowAbstain: boolean;
  minVotesRequired?: number;
  createdAt: string;
  updatedAt: string;
  positions?: ElectionPosition[];
  _count?: {
    positions: number;
    votes: number;
  };
}

export interface ElectionPosition {
  id: number;
  electionId: number;
  title: string;
  description?: string;
  maxCandidates: number;
  minCandidates: number;
  displayOrder: number;
  candidates?: Candidate[];
  _count?: {
    candidates: number;
    votes: number;
  };
}

export interface Candidate {
  id: number;
  positionId: number;
  memberId: number;
  nominatedById?: number;
  manifesto?: string;
  status: CandidateStatus;
  approvedAt?: string;
  rejectedReason?: string;
  createdAt: string;
  member: {
    id: number;
    memberId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  nominatedBy?: {
    id: number;
    email: string;
  };
  position?: {
    id: number;
    title: string;
  };
  _count?: {
    votes: number;
  };
}

export interface Vote {
  id: number;
  electionId: number;
  positionId: number;
  candidateId?: number;
  memberId: number;
  isAbstain: boolean;
  votedAt: string;
}

export interface Poll {
  id: number;
  title: string;
  description?: string;
  pollType: PollType;
  status: PollStatus;
  startDate?: string;
  endDate?: string;
  isAnonymous: boolean;
  allowMultipleResponses: boolean;
  maxSelections?: number;
  createdAt: string;
  updatedAt: string;
  options?: PollOption[];
  _count?: {
    options: number;
    responses: number;
  };
}

export interface PollOption {
  id: number;
  pollId: number;
  text: string;
  displayOrder: number;
  _count?: {
    responses: number;
  };
}

export interface PollResponse {
  id: number;
  pollId: number;
  optionId: number;
  memberId: number;
  respondedAt: string;
}

export interface VotingDashboard {
  totalElections: number;
  activeElections: number;
  completedElections: number;
  totalPolls: number;
  activePolls: number;
  completedPolls: number;
  upcomingElections: Election[];
  recentResults: Election[];
}

export interface ElectionResults {
  election: Election;
  positions: Array<{
    position: ElectionPosition;
    candidates: Array<{
      candidate: Candidate;
      voteCount: number;
      percentage: number;
    }>;
    totalVotes: number;
    abstainCount: number;
    winner?: Candidate;
  }>;
  totalVoters: number;
  voterTurnout: number;
}

export interface PollResults {
  poll: Poll;
  options: Array<{
    option: PollOption;
    responseCount: number;
    percentage: number;
  }>;
  totalResponses: number;
  uniqueRespondents: number;
}

export interface VoterStatus {
  electionId: number;
  hasVoted: boolean;
  votedPositions: number[];
  remainingPositions: number[];
}

// ==========================================
// DASHBOARD
// ==========================================

export async function getVotingDashboard(): Promise<{ success: boolean; data: VotingDashboard }> {
  const response = await apiGet(`${API_URL}/api/voting/dashboard`);
  if (!response.ok) throw new Error('Failed to fetch voting dashboard');
  return response.json();
}

export async function getActiveVotingItems(): Promise<{ success: boolean; data: { elections: Election[]; polls: Poll[] } }> {
  const response = await apiGet(`${API_URL}/api/voting/active`);
  if (!response.ok) throw new Error('Failed to fetch active voting items');
  return response.json();
}

// ==========================================
// ELECTIONS
// ==========================================

export async function getElections(params?: {
  page?: number;
  limit?: number;
  status?: ElectionStatus;
  electionType?: ElectionType;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.electionType) searchParams.set('electionType', params.electionType);
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiGet(`${API_URL}/api/voting/elections?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch elections');
  return response.json();
}

export async function getElection(id: number): Promise<{ success: boolean; data: Election }> {
  const response = await apiGet(`${API_URL}/api/voting/elections/${id}`);
  if (!response.ok) throw new Error('Failed to fetch election');
  return response.json();
}

export async function createElection(data: {
  title: string;
  description?: string;
  electionType: ElectionType;
  nominationStartDate?: string;
  nominationEndDate?: string;
  votingStartDate?: string;
  votingEndDate?: string;
  isAnonymous?: boolean;
  allowAbstain?: boolean;
  minVotesRequired?: number;
}) {
  const response = await apiPost(`${API_URL}/api/voting/elections`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create election');
  }
  return response.json();
}

export async function updateElection(id: number, data: Partial<{
  title: string;
  description: string;
  electionType: ElectionType;
  nominationStartDate: string;
  nominationEndDate: string;
  votingStartDate: string;
  votingEndDate: string;
  isAnonymous: boolean;
  allowAbstain: boolean;
  minVotesRequired: number;
}>) {
  const response = await apiPut(`${API_URL}/api/voting/elections/${id}`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update election');
  }
  return response.json();
}

export async function deleteElection(id: number) {
  const response = await apiDelete(`${API_URL}/api/voting/elections/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete election');
  }
  return response.json();
}

// Election Status Actions
export async function startNominations(id: number) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${id}/start-nominations`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start nominations');
  }
  return response.json();
}

export async function closeNominations(id: number) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${id}/close-nominations`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to close nominations');
  }
  return response.json();
}

export async function startVoting(id: number) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${id}/start-voting`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start voting');
  }
  return response.json();
}

export async function closeVoting(id: number) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${id}/close-voting`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to close voting');
  }
  return response.json();
}

export async function publishResults(id: number) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${id}/publish-results`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to publish results');
  }
  return response.json();
}

export async function cancelElection(id: number, reason?: string) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${id}/cancel`, { reason });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel election');
  }
  return response.json();
}

export async function getElectionResults(electionId: number): Promise<{ success: boolean; data: ElectionResults }> {
  const response = await apiGet(`${API_URL}/api/voting/elections/${electionId}/results`);
  if (!response.ok) throw new Error('Failed to fetch election results');
  return response.json();
}

// ==========================================
// POSITIONS
// ==========================================

export async function addPosition(electionId: number, data: {
  title: string;
  description?: string;
  maxCandidates?: number;
  minCandidates?: number;
  displayOrder?: number;
}) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${electionId}/positions`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add position');
  }
  return response.json();
}

export async function updatePosition(positionId: number, data: Partial<{
  title: string;
  description: string;
  maxCandidates: number;
  minCandidates: number;
  displayOrder: number;
}>) {
  const response = await apiPut(`${API_URL}/api/voting/positions/${positionId}`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update position');
  }
  return response.json();
}

export async function deletePosition(positionId: number) {
  const response = await apiDelete(`${API_URL}/api/voting/positions/${positionId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete position');
  }
  return response.json();
}

// ==========================================
// CANDIDATES
// ==========================================

export async function getCandidates(electionId: number, params?: {
  positionId?: number;
  status?: CandidateStatus;
}) {
  const searchParams = new URLSearchParams();
  if (params?.positionId) searchParams.set('positionId', params.positionId.toString());
  if (params?.status) searchParams.set('status', params.status);

  const response = await apiGet(`${API_URL}/api/voting/elections/${electionId}/candidates?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch candidates');
  return response.json();
}

export async function registerCandidate(electionId: number, data: {
  positionId: number;
  memberId: number;
  manifesto?: string;
}) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${electionId}/candidates`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to register candidate');
  }
  return response.json();
}

export async function selfNominate(electionId: number, data: {
  positionId: number;
  manifesto?: string;
}) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${electionId}/self-nominate`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to self-nominate');
  }
  return response.json();
}

export async function approveCandidate(candidateId: number, data: {
  approved: boolean;
  rejectedReason?: string;
}) {
  const response = await apiPost(`${API_URL}/api/voting/candidates/${candidateId}/approve`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to approve/reject candidate');
  }
  return response.json();
}

export async function withdrawCandidate(candidateId: number) {
  const response = await apiPost(`${API_URL}/api/voting/candidates/${candidateId}/withdraw`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to withdraw candidacy');
  }
  return response.json();
}

// ==========================================
// VOTING
// ==========================================

export async function castVote(electionId: number, data: {
  positionId: number;
  candidateId?: number;
  isAbstain?: boolean;
}) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${electionId}/vote`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cast vote');
  }
  return response.json();
}

export async function bulkCastVotes(electionId: number, votes: Array<{
  positionId: number;
  candidateId?: number;
  isAbstain?: boolean;
}>) {
  const response = await apiPost(`${API_URL}/api/voting/elections/${electionId}/vote/bulk`, { votes });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cast votes');
  }
  return response.json();
}

export async function getVoterStatus(electionId: number): Promise<{ success: boolean; data: VoterStatus }> {
  const response = await apiGet(`${API_URL}/api/voting/elections/${electionId}/voter-status`);
  if (!response.ok) throw new Error('Failed to fetch voter status');
  return response.json();
}

// ==========================================
// POLLS
// ==========================================

export async function getPolls(params?: {
  page?: number;
  limit?: number;
  status?: PollStatus;
  pollType?: PollType;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.pollType) searchParams.set('pollType', params.pollType);
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiGet(`${API_URL}/api/voting/polls?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch polls');
  return response.json();
}

export async function getPoll(id: number): Promise<{ success: boolean; data: Poll }> {
  const response = await apiGet(`${API_URL}/api/voting/polls/${id}`);
  if (!response.ok) throw new Error('Failed to fetch poll');
  return response.json();
}

export async function createPoll(data: {
  title: string;
  description?: string;
  pollType: PollType;
  startDate?: string;
  endDate?: string;
  isAnonymous?: boolean;
  allowMultipleResponses?: boolean;
  maxSelections?: number;
  options?: string[];
}) {
  const response = await apiPost(`${API_URL}/api/voting/polls`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create poll');
  }
  return response.json();
}

export async function updatePoll(id: number, data: Partial<{
  title: string;
  description: string;
  pollType: PollType;
  startDate: string;
  endDate: string;
  isAnonymous: boolean;
  allowMultipleResponses: boolean;
  maxSelections: number;
}>) {
  const response = await apiPut(`${API_URL}/api/voting/polls/${id}`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update poll');
  }
  return response.json();
}

export async function deletePoll(id: number) {
  const response = await apiDelete(`${API_URL}/api/voting/polls/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete poll');
  }
  return response.json();
}

// Poll Status Actions
export async function startPoll(id: number) {
  const response = await apiPost(`${API_URL}/api/voting/polls/${id}/start`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start poll');
  }
  return response.json();
}

export async function closePoll(id: number) {
  const response = await apiPost(`${API_URL}/api/voting/polls/${id}/close`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to close poll');
  }
  return response.json();
}

export async function cancelPoll(id: number) {
  const response = await apiPost(`${API_URL}/api/voting/polls/${id}/cancel`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel poll');
  }
  return response.json();
}

// Poll Options
export async function addPollOption(pollId: number, data: {
  text: string;
  displayOrder?: number;
}) {
  const response = await apiPost(`${API_URL}/api/voting/polls/${pollId}/options`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add poll option');
  }
  return response.json();
}

export async function deletePollOption(optionId: number) {
  const response = await apiDelete(`${API_URL}/api/voting/options/${optionId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete poll option');
  }
  return response.json();
}

// Poll Responses
export async function submitPollResponse(pollId: number, data: {
  optionIds: number[];
}) {
  const response = await apiPost(`${API_URL}/api/voting/polls/${pollId}/respond`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to submit poll response');
  }
  return response.json();
}

export async function getPollResults(pollId: number): Promise<{ success: boolean; data: PollResults }> {
  const response = await apiGet(`${API_URL}/api/voting/polls/${pollId}/results`);
  if (!response.ok) throw new Error('Failed to fetch poll results');
  return response.json();
}
