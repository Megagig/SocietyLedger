/**
 * Voting (member-visible) — `/api/voting/*` (tenant required) — api-contract.md §9.
 * Extended at F3.5/F3.6 with list shapes verified against voting.service.ts 2026-10-21.
 */
import type { ElectionType, ElectionStatus, CandidateStatus } from './enums';
import type { IsoDateString } from './common';

export type VotingUserRefDTO = { id: number; email: string };
export type VotingMemberRefDTO = { id: number; memberId: string; firstName: string; lastName: string };

/** GET /voting/dashboard — verified against voting.service.ts's getDashboard (2026-10-19). */
export type VotingDashboardElectionSummaryDTO = {
  id: number;
  title: string;
  status: ElectionStatus;
  votingStartDate: IsoDateString;
  votingEndDate: IsoDateString;
  totalVotesCast: number;
};

export type VotingDashboardPollSummaryDTO = {
  id: number;
  title: string;
  status: string;
  startDate: IsoDateString;
  endDate: IsoDateString;
  totalResponses: number;
};

export type VotingDashboardDTO = {
  totalElections: number;
  activeElections: number;
  completedElections: number;
  totalPolls: number;
  activePolls: number;
  upcomingElections: number;
  /** What is waiting for the Election Committee (F6.3). */
  candidatesAwaitingApproval: number;
  votingPastEnd: number;
  resultsToPublish: number;
  averageVoterTurnout: number;
  recentElections: VotingDashboardElectionSummaryDTO[];
  recentPolls: VotingDashboardPollSummaryDTO[];
};

/** GET /voting/active — verified against voting.service.ts's getActiveVotingItems (2026-10-19). Two separate lists, not one merged feed. */
export type ActiveElectionDTO = {
  id: number;
  title: string;
  votingEndDate: IsoDateString;
  totalVotesCast: number;
  eligibleVoterCount: number;
};

export type ActivePollDTO = {
  id: number;
  title: string;
  endDate: IsoDateString;
  totalResponses: number;
};

export type ActiveVotingItemsDTO = {
  activeElections: ActiveElectionDTO[];
  activePolls: ActivePollDTO[];
};

/** Pagination wrapper returned by list endpoints. */
export type VotingPaginationDTO = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
};

/** Election list item — from listElections service (F3.5). Verified 2026-10-21. */
export type ElectionListItemDTO = {
  id: number;
  associationId: number;
  title: string;
  description: string | null;
  electionType: ElectionType;
  status: ElectionStatus;
  nominationStartDate: IsoDateString | null;
  nominationEndDate: IsoDateString | null;
  votingStartDate: IsoDateString;
  votingEndDate: IsoDateString;
  maxVotesPerMember: number;
  allowAbstention: boolean;
  isAnonymous: boolean;
  requiresQuorum: boolean;
  quorumPercentage: number | null;
  eligibleVoterCount: number;
  totalVotesCast: number;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  positions: { id: number; title: string }[];
  _count: { votes: number; candidates: number };
};

export type ElectionsListResponseDTO = {
  elections: ElectionListItemDTO[];
  pagination: VotingPaginationDTO;
};

/** Poll list item — from listPolls service (F3.6). Verified 2026-10-21. */
export type PollListItemDTO = {
  id: number;
  associationId: number;
  title: string;
  description: string | null;
  pollType: string;
  status: string;
  startDate: IsoDateString;
  endDate: IsoDateString;
  allowMultipleVotes: boolean;
  isAnonymous: boolean;
  createdAt: IsoDateString;
  options: { id: number; optionText: string }[];
  _count: { responses: number };
};

export type PollsListResponseDTO = {
  polls: PollListItemDTO[];
  pagination: VotingPaginationDTO;
};

export type PollOptionDetailDTO = {
  id: number;
  pollId: number;
  optionText: string;
  orderNumber: number;
};

/** GET /voting/polls/:id — full poll row with options (F3.6). Verified 2026-10-21. */
export type PollDetailDTO = {
  id: number;
  associationId: number;
  title: string;
  description: string | null;
  pollType: string;
  status: string;
  startDate: IsoDateString;
  endDate: IsoDateString;
  allowMultipleVotes: boolean;
  maxChoices: number | null;
  isAnonymous: boolean;
  showResultsBeforeEnd: boolean;
  totalResponses: number;
  createdAt: IsoDateString;
  options: PollOptionDetailDTO[];
  creator: { id: number; email: string };
  _count: { responses: number };
};

export type CastVotePayload = {
  positionId?: number | null;
  candidateId?: number | null;
  isAbstention?: boolean;
};

export type BulkCastVotePayload = {
  votes: { positionId: number; candidateId?: number | null; isAbstention?: boolean }[];
};

export type SelfNominatePayload = {
  positionId?: number | null;
  manifesto?: string | null;
};

export type CandidateMemberRefDTO = { id: number; memberId: string; firstName: string; lastName: string };
export type CandidatePositionRefDTO = { id: number; title: string };

export type CandidateDTO = {
  id: number;
  electionId: number;
  positionId: number | null;
  memberId: number;
  manifesto: string | null;
  photoUrl: string | null;
  status: CandidateStatus;
  nominatedBy: number | null;
  nominatedAt: IsoDateString;
  approvedBy: number | null;
  approvedAt: IsoDateString | null;
  rejectionReason: string | null;
  withdrawnAt: IsoDateString | null;
  withdrawalReason: string | null;
  voteCount: number;
  member: CandidateMemberRefDTO;
  /** Only present on the flat `candidates[]` list, not on the per-position nested list. */
  position?: CandidatePositionRefDTO;
};

export type ElectionPositionDTO = {
  id: number;
  electionId: number;
  title: string;
  description: string | null;
  maxCandidates: number;
  orderNumber: number;
  /** Approved candidates only — the flat `election.candidates[]` below has every status. */
  candidates: CandidateDTO[];
};

/**
 * GET /voting/elections/:id — verified against voting.service.ts's getElection (2026-10-19).
 * Gap: a non-existent election id returns 500 "Election not found", not 404 (the service
 * throws a plain Error, caught generically) — the api/endpoints layer (F1.7) must special-case
 * this message string rather than treating every 500 as fatal/retry-worthy.
 */
export type ElectionDetailDTO = {
  id: number;
  associationId: number;
  title: string;
  description: string | null;
  electionType: ElectionType;
  status: ElectionStatus;
  nominationStartDate: IsoDateString | null;
  nominationEndDate: IsoDateString | null;
  votingStartDate: IsoDateString;
  votingEndDate: IsoDateString;
  maxVotesPerMember: number;
  allowAbstention: boolean;
  isAnonymous: boolean;
  requiresQuorum: boolean;
  quorumPercentage: number | null;
  eligibleVoterCount: number;
  totalVotesCast: number;
  createdBy: number;
  publishedBy: number | null;
  publishedAt: IsoDateString | null;
  cancelledBy: number | null;
  cancelledAt: IsoDateString | null;
  cancellationReason: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  /** Nested per-position, approved-candidates-only. */
  positions: ElectionPositionDTO[];
  /** Flat, every candidate regardless of status. */
  candidates: CandidateDTO[];
  creator: VotingUserRefDTO;
  _count: { votes: number; candidates: number };
};

/**
 * GET /voting/elections/:id/progress — turnout while voting runs, from the moment voting opens. How many have voted and how that built up;
 * never who anyone voted for. 409 `PROGRESS_NOT_READY` before voting opens.
 */
export type ElectionProgressDTO = {
  electionId: number;
  title: string;
  status: ElectionStatus;
  votingStartDate: IsoDateString;
  votingEndDate: IsoDateString;
  eligible: number;
  voted: number;
  turnoutPercent: number;
  requiresQuorum: boolean;
  quorumPercentage: number | null;
  quorumMet: boolean;
  positions: { positionId: number; title: string; voted: number }[];
  timeline: { at: IsoDateString; voted: number }[];
  updatedAt: IsoDateString;
};

/** GET /voting/elections/:id/voter-status — verified against voting.service.ts getVoterStatus (2026-10-21). */
export type VoterStatusDTO = {
  electionId: number;
  memberId: number;
  hasVoted: boolean;
  votedPositions: (number | null)[];
  pendingPositions: { id: number; title: string }[];
  totalPositions: number;
};
