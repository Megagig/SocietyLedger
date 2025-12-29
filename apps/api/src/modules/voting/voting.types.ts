// ============================================
// PHASE 4.5: VOTING & ELECTIONS TYPES
// ============================================

import { Decimal } from '@prisma/client/runtime/library';

// Election Types
export type ElectionType = 'GENERAL' | 'EXECUTIVE' | 'COMMITTEE' | 'SPECIAL';
export type ElectionStatus = 'DRAFT' | 'NOMINATIONS_OPEN' | 'VOTING_OPEN' | 'VOTING_CLOSED' | 'RESULTS_PUBLISHED' | 'CANCELLED';

// Candidate Types
export type CandidateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

// Poll Types
export type PollType = 'YES_NO' | 'MULTIPLE_CHOICE' | 'SINGLE_CHOICE' | 'RATING';
export type PollStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

// Election Interface
export interface Election {
  id: number;
  associationId: number;
  title: string;
  description?: string | null;
  electionType: ElectionType;
  status: ElectionStatus;
  nominationStartDate?: Date | null;
  nominationEndDate?: Date | null;
  votingStartDate: Date;
  votingEndDate: Date;
  maxVotesPerMember: number;
  allowAbstention: boolean;
  isAnonymous: boolean;
  requiresQuorum: boolean;
  quorumPercentage?: number | null;
  eligibleVoterCount: number;
  totalVotesCast: number;
  createdBy: number;
  publishedBy?: number | null;
  publishedAt?: Date | null;
  cancelledBy?: number | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Position Interface (for elections with multiple positions)
export interface ElectionPosition {
  id: number;
  electionId: number;
  title: string;
  description?: string | null;
  maxCandidates: number;
  orderNumber: number;
  createdAt: Date;
}

// Candidate Interface
export interface Candidate {
  id: number;
  electionId: number;
  positionId?: number | null;
  memberId: number;
  manifesto?: string | null;
  photoUrl?: string | null;
  status: CandidateStatus;
  nominatedBy?: number | null;
  nominatedAt: Date;
  approvedBy?: number | null;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  withdrawnAt?: Date | null;
  withdrawalReason?: string | null;
  voteCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Vote Interface
export interface Vote {
  id: number;
  electionId: number;
  positionId?: number | null;
  candidateId?: number | null;
  voterId: number;
  voteHash: string;
  isAbstention: boolean;
  votedAt: Date;
}

// Poll Interface
export interface Poll {
  id: number;
  associationId: number;
  title: string;
  description?: string | null;
  pollType: PollType;
  status: PollStatus;
  startDate: Date;
  endDate: Date;
  allowMultipleVotes: boolean;
  maxChoices?: number | null;
  isAnonymous: boolean;
  showResultsBeforeEnd: boolean;
  totalResponses: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

// Poll Option Interface
export interface PollOption {
  id: number;
  pollId: number;
  optionText: string;
  orderNumber: number;
  voteCount: number;
  createdAt: Date;
}

// Poll Response Interface
export interface PollResponse {
  id: number;
  pollId: number;
  optionId: number;
  responderId: number;
  responseHash: string;
  respondedAt: Date;
}

// API Request/Response Types
export interface CreateElectionRequest {
  title: string;
  description?: string;
  electionType: ElectionType;
  nominationStartDate?: string;
  nominationEndDate?: string;
  votingStartDate: string;
  votingEndDate: string;
  maxVotesPerMember?: number;
  allowAbstention?: boolean;
  isAnonymous?: boolean;
  requiresQuorum?: boolean;
  quorumPercentage?: number;
  positions?: CreatePositionRequest[];
}

export interface UpdateElectionRequest {
  title?: string;
  description?: string;
  electionType?: ElectionType;
  nominationStartDate?: string;
  nominationEndDate?: string;
  votingStartDate?: string;
  votingEndDate?: string;
  maxVotesPerMember?: number;
  allowAbstention?: boolean;
  isAnonymous?: boolean;
  requiresQuorum?: boolean;
  quorumPercentage?: number;
}

export interface CreatePositionRequest {
  title: string;
  description?: string;
  maxCandidates?: number;
  orderNumber?: number;
}

export interface RegisterCandidateRequest {
  electionId: number;
  positionId?: number;
  memberId: number;
  manifesto?: string;
  photoUrl?: string;
}

export interface ApproveCandidateRequest {
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

export interface CastVoteRequest {
  electionId: number;
  positionId?: number;
  candidateId?: number;
  isAbstention?: boolean;
}

export interface CreatePollRequest {
  title: string;
  description?: string;
  pollType: PollType;
  startDate: string;
  endDate: string;
  allowMultipleVotes?: boolean;
  maxChoices?: number;
  isAnonymous?: boolean;
  showResultsBeforeEnd?: boolean;
  options: CreatePollOptionRequest[];
}

export interface UpdatePollRequest {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  allowMultipleVotes?: boolean;
  maxChoices?: number;
  isAnonymous?: boolean;
  showResultsBeforeEnd?: boolean;
}

export interface CreatePollOptionRequest {
  optionText: string;
  orderNumber?: number;
}

export interface SubmitPollResponseRequest {
  pollId: number;
  optionIds: number[];
}

// Query Parameters
export interface ElectionQueryParams {
  page?: string;
  limit?: string;
  status?: ElectionStatus;
  electionType?: ElectionType;
  search?: string;
}

export interface PollQueryParams {
  page?: string;
  limit?: string;
  status?: PollStatus;
  pollType?: PollType;
  search?: string;
}

// Dashboard/Analytics Types
export interface ElectionDashboardStats {
  totalElections: number;
  activeElections: number;
  completedElections: number;
  totalPolls: number;
  activePolls: number;
  upcomingElections: number;
  averageVoterTurnout: number;
}

export interface ElectionResults {
  electionId: number;
  electionTitle: string;
  status: ElectionStatus;
  totalEligibleVoters: number;
  totalVotesCast: number;
  voterTurnout: number;
  quorumMet: boolean;
  positions: PositionResults[];
}

export interface PositionResults {
  positionId: number;
  positionTitle: string;
  candidates: CandidateResult[];
  winner?: CandidateResult;
}

export interface CandidateResult {
  candidateId: number;
  memberId: number;
  memberName: string;
  voteCount: number;
  votePercentage: number;
}

export interface PollResults {
  pollId: number;
  pollTitle: string;
  pollType: PollType;
  status: PollStatus;
  totalResponses: number;
  options: PollOptionResult[];
}

export interface PollOptionResult {
  optionId: number;
  optionText: string;
  voteCount: number;
  votePercentage: number;
}
