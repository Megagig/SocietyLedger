/**
 * Elections and polls for the Election Committee (and the Administrator for polls) — `/api/voting/*`. Verified against voting.service.ts
 * and voting.validation.ts (F6.3). The member-facing shapes (lists, detail, candidates) live in `./voting`.
 */
import type { ElectionType, PollStatus, PollType } from './enums';
import type { IsoDateString } from './common';

/** What is waiting for the committee, from GET /voting/dashboard. */
export type CommitteeQueuesDTO = {
  candidatesAwaitingApproval: number;
  votingPastEnd: number;
  resultsToPublish: number;
};

export type PositionPayload = {
  title: string;
  description?: string | null;
  maxCandidates?: number;
  orderNumber?: number;
};

export type ElectionPayload = {
  title: string;
  description?: string | null;
  electionType: ElectionType;
  nominationStartDate?: IsoDateString | null;
  nominationEndDate?: IsoDateString | null;
  votingStartDate: IsoDateString;
  votingEndDate: IsoDateString;
  allowAbstention: boolean;
  isAnonymous: boolean;
  requiresQuorum: boolean;
  quorumPercentage?: number | null;
  /** On create only: positions are added one by one once the election exists. */
  positions?: PositionPayload[];
  /** Who can vote and stand. Left out = the association's template, if it has one; null = every active member. */
  eligibilityRules?: EligibilityRulesDTO | null;
};

// ---------------------------------------------------------------- who can vote and who can stand
// Optional. With no rule set every active member can vote and stand, as always.

export type MemberRuleDTO = {
  /** Members may owe at most this much on overdue charges (0 = nothing overdue). */
  financialStanding?: { maxOverdue: number };
  minMembershipMonths?: number;
  categories?: string[];
};
export type CandidateRuleDTO = MemberRuleDTO & { mustBeVoter?: boolean; maxPositions?: number };
export type EligibilityRulesDTO = { voters?: MemberRuleDTO; candidates?: CandidateRuleDTO };

export type EligibilityResultDTO = { eligible: boolean; reason: string | null; code: string };

/** GET /voting/elections/:id/my-eligibility — may I vote, may I stand, and what does this election ask of people. */
export type MyEligibilityDTO = {
  hasRules: boolean;
  vote: EligibilityResultDTO;
  stand: EligibilityResultDTO;
  requirements: { voters: string[]; candidates: string[] };
};

export type EligibilityExceptionDTO = {
  id: number;
  memberId: number;
  scope: 'VOTE' | 'STAND';
  kind: 'ALLOW' | 'BAR';
  reason: string;
  createdAt: IsoDateString;
  member: { id: number; memberId: string; firstName: string; lastName: string };
};

/** GET /voting/elections/:id/eligibility — the rules of one election and the exceptions made for it (committee). */
export type ElectionEligibilityDTO = {
  rules: EligibilityRulesDTO | null;
  requirements: { voters: string[]; candidates: string[] };
  exceptions: EligibilityExceptionDTO[];
};

export type EligibilityExceptionPayload = { memberId: number; scope: 'VOTE' | 'STAND'; kind: 'ALLOW' | 'BAR'; reason: string };

/** POST /voting/eligibility/preview — what a rule would let in and turn away, before it is saved. */
export type EligibilityPreviewDTO = {
  activeMembers: number;
  canVote: number;
  canStand: number;
  turnedAway: { memberId: number; memberNumber: string; name: string; scope: 'VOTE' | 'STAND'; reason: string }[];
};

export type RegisterCandidatePayload = {
  memberId: number;
  positionId?: number | null;
  manifesto?: string | null;
};

export type DecideCandidatePayload =
  | { status: 'APPROVED' }
  | { status: 'REJECTED'; rejectionReason: string };

/** GET /voting/candidate-members — active members the committee can put forward (they have no members list). */
export type CandidateMemberDTO = { id: number; memberId: string; firstName: string; lastName: string };

export type CandidateResultDTO = {
  candidateId: number;
  memberId: number;
  memberName: string;
  voteCount: number;
  votePercentage: number;
};

/**
 * GET /voting/elections/:id/results. Only the committee can read it before it is published; nobody can while voting is open (403
 * `RESULTS_NOT_PUBLISHED`, 409 `RESULTS_NOT_READY`). A tie at the top has no `winner`; `tied` names who is level.
 */
export type ElectionResultsDTO = {
  electionId: number;
  electionTitle: string;
  status: string;
  published: boolean;
  totalEligibleVoters: number;
  /** Members who voted — each counted once, however many positions they voted in. */
  totalVotesCast: number;
  voterTurnout: number;
  requiresQuorum: boolean;
  quorumPercentage: number | null;
  quorumMet: boolean;
  positions: {
    positionId: number;
    positionTitle: string;
    candidates: CandidateResultDTO[];
    abstentions: number;
    winner?: CandidateResultDTO;
    tied: CandidateResultDTO[];
  }[];
  generalResults?: CandidateResultDTO[];
  generalWinner?: CandidateResultDTO;
  generalTied: CandidateResultDTO[];
  generalAbstentions: number;
};

export type PollOptionPayload = { optionText: string; orderNumber?: number };

export type PollPayload = {
  title: string;
  description?: string | null;
  pollType: PollType;
  startDate: IsoDateString;
  endDate: IsoDateString;
  allowMultipleVotes: boolean;
  maxChoices?: number | null;
  isAnonymous: boolean;
  showResultsBeforeEnd: boolean;
  options: PollOptionPayload[];
};

/** What can still be changed on a poll that has not started. */
export type PollUpdatePayload = Partial<Omit<PollPayload, 'options' | 'pollType' | 'allowMultipleVotes'>>;

/** GET /voting/polls/:id/results. Members see it when the poll shows results early or has closed; whoever runs polls always can. */
export type PollResultsDTO = {
  pollId: number;
  pollTitle: string;
  pollType: PollType;
  status: PollStatus;
  /** Members who answered, each counted once. */
  totalResponses: number;
  totalVotes: number;
  options: { optionId: number; optionText: string; voteCount: number; votePercentage: number }[];
  hasResponded: boolean;
};
