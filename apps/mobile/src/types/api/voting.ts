/**
 * Voting (member-visible) — `/api/voting/*` (tenant required, even though `voting.routes.ts`
 * has no explicit tenant middleware call — the global one still applies) — api-contract.md §9.
 *
 * Only the 3 endpoints api-contract.md verified (dashboard, active, elections/:id) are typed
 * here. `GET /voting/elections` (the plain list, used by screen C5) was NOT re-verified against
 * controller source in that pass — don't type it from memory; verify against
 * voting.controller.ts/voting.service.ts when the feature that needs it starts (F3.5+).
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
