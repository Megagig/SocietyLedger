// ============================================
// ELECTION & POLL RULES
// Pure checks the voting service applies before it changes anything, so they can be tested without a database.
// ============================================

import { RuleError } from '../finance/rule-error';

export type ElectionStatusName =
  | 'DRAFT'
  | 'NOMINATIONS_OPEN'
  | 'NOMINATIONS_CLOSED'
  | 'VOTING_OPEN'
  | 'VOTING_CLOSED'
  | 'RESULTS_PUBLISHED'
  | 'CANCELLED';

export type ElectionAction = 'startNominations' | 'closeNominations' | 'startVoting' | 'closeVoting' | 'publishResults' | 'cancel';

/** Where each step of the election can be taken from. Every transition claims the election from one of these, so it happens once. */
export const ELECTION_TRANSITIONS: Record<ElectionAction, ElectionStatusName[]> = {
  startNominations: ['DRAFT'],
  closeNominations: ['NOMINATIONS_OPEN'],
  startVoting: ['DRAFT', 'NOMINATIONS_CLOSED'],
  closeVoting: ['VOTING_OPEN'],
  publishResults: ['VOTING_CLOSED'],
  cancel: ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED', 'VOTING_OPEN', 'VOTING_CLOSED'],
};

const WRONG_STATUS_MESSAGE: Record<ElectionAction, string> = {
  startNominations: 'Nominations can only be opened on an election that has not started.',
  closeNominations: 'Nominations are not open.',
  startVoting: 'Voting can only be opened once nominations are closed, or on an election that has not started.',
  closeVoting: 'Voting is not open.',
  publishResults: 'Results can only be published after voting has closed.',
  cancel: 'This election can no longer be cancelled.',
};

export function assertElectionTransition(action: ElectionAction, status: ElectionStatusName): void {
  if (!ELECTION_TRANSITIONS[action].includes(status)) {
    const why = status === 'CANCELLED' ? 'This election was cancelled.' : status === 'RESULTS_PUBLISHED' ? 'The results are already published.' : WRONG_STATUS_MESSAGE[action];
    throw new RuleError(why, 409, 'WRONG_STATUS');
  }
}

/** The claim found the election in another status: someone else moved it first (or a double tap). */
export function alreadyMovedOn(): RuleError {
  return new RuleError('This election was just changed by someone else. Refresh to see where it is now.', 409, 'ALREADY_DONE');
}

/** Positions, dates and the voting rules can only change while the election has not started. */
export function assertEditable(status: ElectionStatusName, what = 'an election'): void {
  if (status !== 'DRAFT') {
    throw new RuleError(`You can only change ${what} before nominations open.`, 409, 'NOT_EDITABLE');
  }
}

export function assertDeletable(status: ElectionStatusName): void {
  if (status !== 'DRAFT' && status !== 'CANCELLED') {
    throw new RuleError('Only an election that has not started, or one that was cancelled, can be deleted.', 409, 'NOT_DELETABLE');
  }
}

export function assertWindow(votingStartDate: Date, votingEndDate: Date): void {
  if (votingEndDate <= votingStartDate) {
    throw new RuleError('Voting has to end after it starts.', 400, 'BAD_WINDOW');
  }
}

export function assertNominationWindow(nominationStart: Date | null | undefined, nominationEnd: Date | null | undefined, votingStart: Date): void {
  if (nominationStart && nominationEnd && nominationEnd <= nominationStart) {
    throw new RuleError('Nominations have to end after they start.', 400, 'BAD_NOMINATION_WINDOW');
  }
  if (nominationEnd && nominationEnd > votingStart) {
    throw new RuleError('Nominations have to close before voting starts.', 400, 'BAD_NOMINATION_WINDOW');
  }
}

export function assertQuorumSetting(requiresQuorum: boolean | undefined | null, quorumPercentage: number | null | undefined): void {
  if (requiresQuorum && (!quorumPercentage || quorumPercentage < 1 || quorumPercentage > 100)) {
    throw new RuleError('Say what percentage of members must vote for the result to count (1 to 100).', 400, 'QUORUM_PERCENTAGE_REQUIRED');
  }
}

// ---------- candidates ----------

/** Nominations are decided before voting opens, and may be finished off after nominations close. */
const CANDIDATE_DECISION_STATUSES: ElectionStatusName[] = ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED'];

export function assertCandidatesCanBeDecided(status: ElectionStatusName): void {
  if (!CANDIDATE_DECISION_STATUSES.includes(status)) {
    throw new RuleError('Candidates can only be approved or rejected before voting opens.', 409, 'CANDIDATES_LOCKED');
  }
}

/** The committee can register a candidate before voting; a member can nominate themselves only while nominations are open. */
export function assertCanRegisterCandidate(status: ElectionStatusName, bySelf: boolean): void {
  const allowed: ElectionStatusName[] = bySelf ? ['NOMINATIONS_OPEN'] : ['DRAFT', 'NOMINATIONS_OPEN'];
  if (!allowed.includes(status)) {
    throw new RuleError(bySelf ? 'Nominations are not open.' : 'Candidates can only be added before nominations close.', 409, 'NOMINATIONS_CLOSED');
  }
}

export function assertCanWithdraw(status: ElectionStatusName): void {
  if (!CANDIDATE_DECISION_STATUSES.includes(status)) {
    throw new RuleError("A candidate can't withdraw once voting has opened.", 409, 'WITHDRAW_LOCKED');
  }
}

/** Nobody decides on their own nomination. */
export function assertNotOwnNomination(deciderMemberId: number | null | undefined, candidateMemberId: number): void {
  if (deciderMemberId !== null && deciderMemberId !== undefined && deciderMemberId === candidateMemberId) {
    throw new RuleError("This is your own nomination, so another member of the committee needs to decide it.", 403, 'OWN_NOMINATION');
  }
}

export function assertPositionBelongs(positionId: number | null | undefined, positionIds: number[]): void {
  if (positionId === null || positionId === undefined) {
    if (positionIds.length > 0) throw new RuleError('Choose the position this candidate is standing for.', 400, 'POSITION_REQUIRED');
    return;
  }
  if (!positionIds.includes(positionId)) {
    throw new RuleError('That position is not part of this election.', 404, 'POSITION_NOT_FOUND');
  }
}

// ---------- opening voting ----------

export interface ReadinessInput {
  positions: { id: number; title: string }[];
  candidates: { positionId: number | null; status: string }[];
  votingEndDate: Date;
  now: Date;
}

/** Voting opens only when every position has someone to vote for and nobody is left waiting for a decision. */
export function assertReadyForVoting({ positions, candidates, votingEndDate, now }: ReadinessInput): void {
  const waiting = candidates.filter((c) => c.status === 'PENDING').length;
  if (waiting > 0) {
    throw new RuleError(
      `${waiting} ${waiting === 1 ? 'nomination is' : 'nominations are'} still waiting for approval. Approve or reject each one before voting opens.`,
      409,
      'PENDING_CANDIDATES',
    );
  }
  const approved = candidates.filter((c) => c.status === 'APPROVED');
  if (positions.length === 0) {
    if (approved.length === 0) throw new RuleError('Add at least one approved candidate before voting opens.', 409, 'NO_CANDIDATES');
  } else {
    for (const position of positions) {
      if (!approved.some((c) => c.positionId === position.id)) {
        throw new RuleError(`"${position.title}" has no approved candidate. Add one, or remove the position, before voting opens.`, 409, 'NO_CANDIDATES');
      }
    }
  }
  if (votingEndDate <= now) {
    throw new RuleError('The voting end date has already passed. Change it before opening voting.', 409, 'VOTING_WINDOW_PASSED');
  }
}

// ---------- the ballot ----------

export interface BallotInput {
  election: { allowAbstention: boolean };
  positionIds: number[];
  vote: { positionId?: number | null; candidateId?: number | null; isAbstention?: boolean };
  /** The candidate the voter picked, found by its id in this election; null when there is none. */
  candidate: { id: number; positionId: number | null; status: string } | null;
}

/** A ballot names one approved candidate in the position it is cast in, or abstains where that is allowed. Never both, never blank. */
export function assertValidBallot({ election, positionIds, vote, candidate }: BallotInput): void {
  const positionId = vote.positionId ?? null;
  if (positionIds.length > 0 && positionId === null) {
    throw new RuleError('Choose which position you are voting for.', 400, 'POSITION_REQUIRED');
  }
  if (positionId !== null && !positionIds.includes(positionId)) {
    throw new RuleError('That position is not part of this election.', 404, 'POSITION_NOT_FOUND');
  }
  if (vote.isAbstention) {
    if (vote.candidateId) throw new RuleError('Choose a candidate or abstain, not both.', 400, 'BAD_BALLOT');
    if (!election.allowAbstention) throw new RuleError('This election does not allow abstaining.', 400, 'ABSTENTION_NOT_ALLOWED');
    return;
  }
  if (!vote.candidateId) {
    throw new RuleError('Choose a candidate, or abstain.', 400, 'BLANK_BALLOT');
  }
  if (!candidate || candidate.status !== 'APPROVED' || candidate.positionId !== positionId) {
    throw new RuleError('That candidate is not standing for this position.', 400, 'INVALID_CANDIDATE');
  }
}

export interface VotingOpenInput {
  status: ElectionStatusName;
  votingStartDate: Date;
  votingEndDate: Date;
  now: Date;
}

export function assertVotingOpen({ status, votingStartDate, votingEndDate, now }: VotingOpenInput): void {
  if (status !== 'VOTING_OPEN') throw new RuleError('Voting is not open.', 409, 'VOTING_NOT_OPEN');
  if (now > votingEndDate) throw new RuleError('Voting has ended.', 409, 'VOTING_ENDED');
  if (now < votingStartDate) throw new RuleError('Voting has not started yet.', 409, 'VOTING_NOT_STARTED');
}

// ---------- turnout, quorum, results ----------

/** Share of eligible members who voted, as a whole percent. */
export function turnoutPercent(voters: number, eligible: number): number {
  return eligible > 0 ? Math.round((voters / eligible) * 100) : 0;
}

/** Compared exactly (no rounding), so 49.6% of members never counts as meeting a 50% quorum. */
export function quorumMet(requiresQuorum: boolean, quorumPercentage: number | null | undefined, voters: number, eligible: number): boolean {
  if (!requiresQuorum) return true;
  if (!quorumPercentage) return false;
  return eligible > 0 && voters * 100 >= quorumPercentage * eligible;
}

/** Results with too few voters don't count: the committee has to cancel and run it again, not publish them. */
export function assertQuorumForPublishing(requiresQuorum: boolean, quorumPercentage: number | null | undefined, voters: number, eligible: number): void {
  if (!quorumMet(requiresQuorum, quorumPercentage, voters, eligible)) {
    throw new RuleError(
      `Only ${turnoutPercent(voters, eligible)}% of members voted, and the election needs ${quorumPercentage ?? 'more'}%. These results can't be published. Cancel the election and run it again.`,
      409,
      'QUORUM_NOT_MET',
    );
  }
}

/** Before they are published, results are for the committee only; while voting is open nobody sees a tally. */
export function assertResultsVisible(status: ElectionStatusName, canSeeBeforePublishing: boolean): void {
  if (status === 'RESULTS_PUBLISHED') return;
  if (status === 'VOTING_CLOSED') {
    if (canSeeBeforePublishing) return;
    throw new RuleError('The results have not been published yet.', 403, 'RESULTS_NOT_PUBLISHED');
  }
  throw new RuleError(status === 'VOTING_OPEN' ? 'Voting is still open, so there are no results yet.' : 'There are no results for this election.', 409, 'RESULTS_NOT_READY');
}

/**
 * A candidate's vote count is part of the result, so it follows the same rule: hidden from everyone while voting is open, visible to the
 * committee once voting has closed, and to every member once the results are published.
 */
export function tallyVisible(status: ElectionStatusName, canSeeBeforePublishing: boolean): boolean {
  return status === 'RESULTS_PUBLISHED' || (status === 'VOTING_CLOSED' && canSeeBeforePublishing);
}

export interface TallyRow {
  candidateId: number;
  voteCount: number;
}

/** The winner is the single highest count; a tie at the top has no winner, so the committee decides what happens next. */
export function pickWinner<T extends TallyRow>(rows: T[]): { winner?: T; tied: T[] } {
  const top = rows.reduce((max, r) => Math.max(max, r.voteCount), 0);
  if (top <= 0) return { tied: [] };
  const leaders = rows.filter((r) => r.voteCount === top);
  return leaders.length === 1 ? { winner: leaders[0], tied: [] } : { tied: leaders };
}

// ---------- polls ----------

export type PollStatusName = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
export type PollAction = 'start' | 'close' | 'cancel';

export const POLL_TRANSITIONS: Record<PollAction, PollStatusName[]> = {
  start: ['DRAFT'],
  close: ['ACTIVE'],
  cancel: ['DRAFT', 'ACTIVE'],
};

const POLL_WRONG_STATUS: Record<PollAction, string> = {
  start: 'Only a poll that has not started can be started.',
  close: 'This poll is not open.',
  cancel: 'This poll can no longer be cancelled.',
};

export function assertPollTransition(action: PollAction, status: PollStatusName): void {
  if (!POLL_TRANSITIONS[action].includes(status)) {
    throw new RuleError(POLL_WRONG_STATUS[action], 409, 'WRONG_STATUS');
  }
}

export function alreadyMovedOnPoll(): RuleError {
  return new RuleError('This poll was just changed by someone else. Refresh to see where it is now.', 409, 'ALREADY_DONE');
}

export function assertPollReady(optionCount: number, endDate: Date, now: Date): void {
  if (optionCount < 2) throw new RuleError('A poll needs at least two options.', 409, 'NOT_ENOUGH_OPTIONS');
  if (endDate <= now) throw new RuleError('The poll end date has already passed. Change it before starting the poll.', 409, 'POLL_WINDOW_PASSED');
}

export interface PollAnswerInput {
  poll: { status: PollStatusName; startDate: Date; endDate: Date; pollType: string; maxChoices: number | null };
  validOptionIds: number[];
  optionIds: number[];
  now: Date;
}

/** One answer per member. A single-choice or yes/no poll takes one option; a multiple-choice poll takes up to its limit. */
export function assertPollAnswer({ poll, validOptionIds, optionIds, now }: PollAnswerInput): void {
  if (poll.status !== 'ACTIVE') throw new RuleError('This poll is not open.', 409, 'POLL_NOT_OPEN');
  if (now > poll.endDate) throw new RuleError('This poll has ended.', 409, 'POLL_ENDED');
  if (now < poll.startDate) throw new RuleError('This poll has not started yet.', 409, 'POLL_NOT_STARTED');
  if (optionIds.length === 0) throw new RuleError('Choose an answer.', 400, 'BLANK_ANSWER');
  if (new Set(optionIds).size !== optionIds.length) throw new RuleError('Each option can only be chosen once.', 400, 'DUPLICATE_OPTION');
  if (optionIds.some((id) => !validOptionIds.includes(id))) throw new RuleError('That option is not part of this poll.', 400, 'INVALID_OPTION');
  const single = poll.pollType === 'SINGLE_CHOICE' || poll.pollType === 'YES_NO' || poll.pollType === 'RATING';
  if (single && optionIds.length > 1) throw new RuleError('Choose one answer only.', 400, 'TOO_MANY_CHOICES');
  if (poll.maxChoices && optionIds.length > poll.maxChoices) {
    throw new RuleError(`Choose at most ${poll.maxChoices} ${poll.maxChoices === 1 ? 'answer' : 'answers'}.`, 400, 'TOO_MANY_CHOICES');
  }
}

/** Members see live results only when the poll says so; whoever runs polls always can. */
export function assertPollResultsVisible(status: PollStatusName, showResultsBeforeEnd: boolean, canManage: boolean): void {
  if (status === 'ACTIVE' && !showResultsBeforeEnd && !canManage) {
    throw new RuleError('Results will be available when the poll closes.', 403, 'RESULTS_NOT_READY');
  }
  if (status === 'DRAFT' || status === 'CANCELLED') {
    throw new RuleError('There are no results for this poll.', 409, 'RESULTS_NOT_READY');
  }
}
