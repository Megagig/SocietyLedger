import { RuleError } from '../../src/modules/finance/rule-error';
import {
  assertProgressVisible,
  assertCanRegisterCandidate,
  assertCanWithdraw,
  assertCandidatesCanBeDecided,
  assertElectionTransition,
  assertNominationWindow,
  assertNotOwnNomination,
  assertPollAnswer,
  assertPollReady,
  assertPollResultsVisible,
  assertPollTransition,
  assertQuorumForPublishing,
  assertQuorumSetting,
  assertReadyForVoting,
  assertResultsVisible,
  assertValidBallot,
  assertVotingOpen,
  assertWindow,
  pickWinner,
  quorumMet,
  tallyVisible,
  turnoutPercent,
  turnoutTimeline,
} from '../../src/modules/voting/voting-rules';

const code = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(RuleError);
    return (e as RuleError).code;
  }
  return null;
};

describe('election steps', () => {
  it('each step is only taken from the right place', () => {
    expect(code(() => assertElectionTransition('startNominations', 'DRAFT'))).toBeNull();
    expect(code(() => assertElectionTransition('startNominations', 'NOMINATIONS_OPEN'))).toBe('WRONG_STATUS');
    expect(code(() => assertElectionTransition('closeNominations', 'NOMINATIONS_OPEN'))).toBeNull();
    expect(code(() => assertElectionTransition('closeNominations', 'DRAFT'))).toBe('WRONG_STATUS');
    expect(code(() => assertElectionTransition('closeVoting', 'VOTING_OPEN'))).toBeNull();
    expect(code(() => assertElectionTransition('closeVoting', 'VOTING_CLOSED'))).toBe('WRONG_STATUS');
    expect(code(() => assertElectionTransition('publishResults', 'VOTING_CLOSED'))).toBeNull();
    expect(code(() => assertElectionTransition('publishResults', 'VOTING_OPEN'))).toBe('WRONG_STATUS');
  });

  it('voting opens after nominations close, or straight from draft, never while nominations are still open', () => {
    expect(code(() => assertElectionTransition('startVoting', 'NOMINATIONS_CLOSED'))).toBeNull();
    expect(code(() => assertElectionTransition('startVoting', 'DRAFT'))).toBeNull();
    expect(code(() => assertElectionTransition('startVoting', 'NOMINATIONS_OPEN'))).toBe('WRONG_STATUS');
  });

  it('a published or cancelled election cannot be cancelled again', () => {
    expect(code(() => assertElectionTransition('cancel', 'VOTING_OPEN'))).toBeNull();
    expect(code(() => assertElectionTransition('cancel', 'RESULTS_PUBLISHED'))).toBe('WRONG_STATUS');
    expect(code(() => assertElectionTransition('cancel', 'CANCELLED'))).toBe('WRONG_STATUS');
  });

  it('dates make sense', () => {
    expect(code(() => assertWindow(new Date('2026-11-01'), new Date('2026-11-02')))).toBeNull();
    expect(code(() => assertWindow(new Date('2026-11-02'), new Date('2026-11-01')))).toBe('BAD_WINDOW');
    expect(code(() => assertNominationWindow(new Date('2026-10-01'), new Date('2026-10-10'), new Date('2026-11-01')))).toBeNull();
    expect(code(() => assertNominationWindow(new Date('2026-10-10'), new Date('2026-10-01'), new Date('2026-11-01')))).toBe('BAD_NOMINATION_WINDOW');
    expect(code(() => assertNominationWindow(null, new Date('2026-12-01'), new Date('2026-11-01')))).toBe('BAD_NOMINATION_WINDOW');
  });

  it('a quorum needs a percentage', () => {
    expect(code(() => assertQuorumSetting(true, undefined))).toBe('QUORUM_PERCENTAGE_REQUIRED');
    expect(code(() => assertQuorumSetting(true, 0))).toBe('QUORUM_PERCENTAGE_REQUIRED');
    expect(code(() => assertQuorumSetting(true, 101))).toBe('QUORUM_PERCENTAGE_REQUIRED');
    expect(code(() => assertQuorumSetting(true, 50))).toBeNull();
    expect(code(() => assertQuorumSetting(false, undefined))).toBeNull();
  });
});

describe('candidates', () => {
  it('can be decided until voting opens, then not', () => {
    expect(code(() => assertCandidatesCanBeDecided('NOMINATIONS_CLOSED'))).toBeNull();
    expect(code(() => assertCandidatesCanBeDecided('VOTING_OPEN'))).toBe('CANDIDATES_LOCKED');
    expect(code(() => assertCandidatesCanBeDecided('VOTING_CLOSED'))).toBe('CANDIDATES_LOCKED');
  });

  it('members nominate themselves only while nominations are open; the committee can also add before they open', () => {
    expect(code(() => assertCanRegisterCandidate('NOMINATIONS_OPEN', true))).toBeNull();
    expect(code(() => assertCanRegisterCandidate('DRAFT', true))).toBe('NOMINATIONS_CLOSED');
    expect(code(() => assertCanRegisterCandidate('DRAFT', false))).toBeNull();
    expect(code(() => assertCanRegisterCandidate('NOMINATIONS_CLOSED', false))).toBe('NOMINATIONS_CLOSED');
  });

  it("can't withdraw once voting has opened", () => {
    expect(code(() => assertCanWithdraw('NOMINATIONS_OPEN'))).toBeNull();
    expect(code(() => assertCanWithdraw('VOTING_OPEN'))).toBe('WITHDRAW_LOCKED');
  });

  it("nobody decides their own nomination", () => {
    expect(code(() => assertNotOwnNomination(7, 7))).toBe('OWN_NOMINATION');
    expect(code(() => assertNotOwnNomination(7, 8))).toBeNull();
    expect(code(() => assertNotOwnNomination(null, 8))).toBeNull();
  });
});

describe('opening voting', () => {
  const now = new Date('2026-11-01T10:00:00Z');
  const later = new Date('2026-11-05T10:00:00Z');
  const positions = [
    { id: 1, title: 'President' },
    { id: 2, title: 'Secretary' },
  ];

  it('needs an approved candidate for every position', () => {
    const candidates = [{ positionId: 1, status: 'APPROVED' }];
    expect(code(() => assertReadyForVoting({ positions, candidates, votingEndDate: later, now }))).toBe('NO_CANDIDATES');
    candidates.push({ positionId: 2, status: 'APPROVED' });
    expect(code(() => assertReadyForVoting({ positions, candidates, votingEndDate: later, now }))).toBeNull();
  });

  it('is blocked while a nomination is still waiting', () => {
    const candidates = [
      { positionId: 1, status: 'APPROVED' },
      { positionId: 2, status: 'APPROVED' },
      { positionId: 2, status: 'PENDING' },
    ];
    expect(code(() => assertReadyForVoting({ positions, candidates, votingEndDate: later, now }))).toBe('PENDING_CANDIDATES');
  });

  it('an election without positions needs at least one approved candidate', () => {
    expect(code(() => assertReadyForVoting({ positions: [], candidates: [], votingEndDate: later, now }))).toBe('NO_CANDIDATES');
    expect(code(() => assertReadyForVoting({ positions: [], candidates: [{ positionId: null, status: 'APPROVED' }], votingEndDate: later, now }))).toBeNull();
  });

  it("can't open when the end date has already passed", () => {
    const candidates = [{ positionId: null, status: 'APPROVED' }];
    expect(code(() => assertReadyForVoting({ positions: [], candidates, votingEndDate: new Date('2026-10-01'), now }))).toBe('VOTING_WINDOW_PASSED');
  });
});

describe('the ballot', () => {
  const election = { allowAbstention: true };
  const approved = { id: 5, positionId: 1, status: 'APPROVED' };

  it('a vote names an approved candidate for that position', () => {
    expect(code(() => assertValidBallot({ election, positionIds: [1, 2], vote: { positionId: 1, candidateId: 5 }, candidate: approved }))).toBeNull();
  });

  it("a blank ballot is refused", () => {
    expect(code(() => assertValidBallot({ election, positionIds: [], vote: {}, candidate: null }))).toBe('BLANK_BALLOT');
    expect(code(() => assertValidBallot({ election, positionIds: [], vote: { candidateId: null }, candidate: null }))).toBe('BLANK_BALLOT');
  });

  it('a position is required when the election has positions', () => {
    expect(code(() => assertValidBallot({ election, positionIds: [1, 2], vote: { candidateId: 5 }, candidate: approved }))).toBe('POSITION_REQUIRED');
  });

  it("a candidate from another position can't be voted for", () => {
    expect(code(() => assertValidBallot({ election, positionIds: [1, 2], vote: { positionId: 2, candidateId: 5 }, candidate: approved }))).toBe('INVALID_CANDIDATE');
  });

  it("a pending, rejected or withdrawn candidate can't be voted for", () => {
    for (const status of ['PENDING', 'REJECTED', 'WITHDRAWN']) {
      expect(code(() => assertValidBallot({ election, positionIds: [1], vote: { positionId: 1, candidateId: 5 }, candidate: { ...approved, status } }))).toBe('INVALID_CANDIDATE');
    }
  });

  it('a position that is not in this election is refused', () => {
    expect(code(() => assertValidBallot({ election, positionIds: [1], vote: { positionId: 9, candidateId: 5 }, candidate: approved }))).toBe('POSITION_NOT_FOUND');
  });

  it('abstaining only where allowed, and never together with a candidate', () => {
    expect(code(() => assertValidBallot({ election, positionIds: [], vote: { isAbstention: true }, candidate: null }))).toBeNull();
    expect(code(() => assertValidBallot({ election: { allowAbstention: false }, positionIds: [], vote: { isAbstention: true }, candidate: null }))).toBe('ABSTENTION_NOT_ALLOWED');
    expect(code(() => assertValidBallot({ election, positionIds: [], vote: { isAbstention: true, candidateId: 5 }, candidate: approved }))).toBe('BAD_BALLOT');
  });

  it('voting has to be open and inside its dates', () => {
    const base = { votingStartDate: new Date('2026-11-01T08:00:00Z'), votingEndDate: new Date('2026-11-02T08:00:00Z') };
    expect(code(() => assertVotingOpen({ ...base, status: 'VOTING_OPEN', now: new Date('2026-11-01T10:00:00Z') }))).toBeNull();
    expect(code(() => assertVotingOpen({ ...base, status: 'VOTING_CLOSED', now: new Date('2026-11-01T10:00:00Z') }))).toBe('VOTING_NOT_OPEN');
    expect(code(() => assertVotingOpen({ ...base, status: 'VOTING_OPEN', now: new Date('2026-11-03T10:00:00Z') }))).toBe('VOTING_ENDED');
    expect(code(() => assertVotingOpen({ ...base, status: 'VOTING_OPEN', now: new Date('2026-10-31T10:00:00Z') }))).toBe('VOTING_NOT_STARTED');
  });
});

describe('turnout, quorum and results', () => {
  it('turnout counts people, as a whole percent', () => {
    expect(turnoutPercent(25, 100)).toBe(25);
    expect(turnoutPercent(1, 3)).toBe(33);
    expect(turnoutPercent(5, 0)).toBe(0);
  });

  it('quorum is compared exactly, not rounded', () => {
    expect(quorumMet(true, 50, 50, 100)).toBe(true);
    expect(quorumMet(true, 50, 496, 1000)).toBe(false); // 49.6% rounds to 50 but is short
    expect(quorumMet(false, null, 0, 100)).toBe(true);
    expect(quorumMet(true, 50, 5, 0)).toBe(false);
  });

  it('results below quorum cannot be published', () => {
    expect(code(() => assertQuorumForPublishing(true, 50, 20, 100))).toBe('QUORUM_NOT_MET');
    expect(code(() => assertQuorumForPublishing(true, 50, 60, 100))).toBeNull();
    expect(code(() => assertQuorumForPublishing(false, null, 0, 100))).toBeNull();
  });

  it('only the committee see results before they are published, and nobody while voting is open', () => {
    expect(code(() => assertResultsVisible('RESULTS_PUBLISHED', false))).toBeNull();
    expect(code(() => assertResultsVisible('VOTING_CLOSED', true))).toBeNull();
    expect(code(() => assertResultsVisible('VOTING_CLOSED', false))).toBe('RESULTS_NOT_PUBLISHED');
    expect(code(() => assertResultsVisible('VOTING_OPEN', true))).toBe('RESULTS_NOT_READY');
    expect(code(() => assertResultsVisible('DRAFT', true))).toBe('RESULTS_NOT_READY');
  });

  it('vote counts follow the same rule as the results', () => {
    expect(tallyVisible('VOTING_OPEN', true)).toBe(false);
    expect(tallyVisible('VOTING_CLOSED', false)).toBe(false);
    expect(tallyVisible('VOTING_CLOSED', true)).toBe(true);
    expect(tallyVisible('RESULTS_PUBLISHED', false)).toBe(true);
    expect(tallyVisible('NOMINATIONS_OPEN', true)).toBe(false);
  });

  it('a tie at the top has no winner; no votes has no winner', () => {
    expect(pickWinner([{ candidateId: 1, voteCount: 5 }, { candidateId: 2, voteCount: 3 }]).winner?.candidateId).toBe(1);
    const tie = pickWinner([{ candidateId: 1, voteCount: 4 }, { candidateId: 2, voteCount: 4 }, { candidateId: 3, voteCount: 1 }]);
    expect(tie.winner).toBeUndefined();
    expect(tie.tied.map((r) => r.candidateId)).toEqual([1, 2]);
    expect(pickWinner([{ candidateId: 1, voteCount: 0 }])).toEqual({ tied: [] });
  });
});

describe('turnout progress', () => {
  it('can be followed once voting has opened, not before', () => {
    expect(code(() => assertProgressVisible('VOTING_OPEN'))).toBeNull();
    expect(code(() => assertProgressVisible('RESULTS_PUBLISHED'))).toBeNull();
    expect(code(() => assertProgressVisible('NOMINATIONS_OPEN'))).toBe('PROGRESS_NOT_READY');
    expect(code(() => assertProgressVisible('DRAFT'))).toBe('PROGRESS_NOT_READY');
  });

  it('builds a running total from the first vote of each member', () => {
    const start = new Date('2027-01-10T00:00:00Z');
    const end = new Date('2027-01-10T05:00:00Z');
    const points = turnoutTimeline([new Date('2027-01-10T00:30:00Z'), new Date('2027-01-10T00:45:00Z'), new Date('2027-01-10T03:10:00Z')], start, end);
    expect(points[0]).toEqual({ at: start.toISOString(), voted: 0 });
    expect(points.map((p) => p.voted)).toEqual([0, 2, 2, 2, 3, 3]);
    expect(points[points.length - 1].at).toBe(end.toISOString());
  });

  it('never goes down, and a long election is cut into at most 48 slices', () => {
    const start = new Date('2027-01-01T00:00:00Z');
    const end = new Date('2027-01-15T00:00:00Z');
    const times = Array.from({ length: 30 }, (_, i) => new Date(start.getTime() + i * 11 * 3600 * 1000));
    const points = turnoutTimeline(times, start, end);
    expect(points.length).toBeLessThanOrEqual(50);
    points.forEach((p, i) => i > 0 && expect(p.voted).toBeGreaterThanOrEqual(points[i - 1].voted));
    expect(points[points.length - 1].voted).toBe(30);
  });
});

describe('polls', () => {
  const now = new Date('2026-11-01T10:00:00Z');
  const open = { status: 'ACTIVE' as const, startDate: new Date('2026-11-01T08:00:00Z'), endDate: new Date('2026-11-02T08:00:00Z'), pollType: 'SINGLE_CHOICE', maxChoices: null };

  it('each step is only taken from the right place', () => {
    expect(code(() => assertPollTransition('start', 'DRAFT'))).toBeNull();
    expect(code(() => assertPollTransition('start', 'ACTIVE'))).toBe('WRONG_STATUS');
    expect(code(() => assertPollTransition('close', 'ACTIVE'))).toBeNull();
    expect(code(() => assertPollTransition('close', 'CLOSED'))).toBe('WRONG_STATUS');
    expect(code(() => assertPollTransition('cancel', 'CLOSED'))).toBe('WRONG_STATUS');
    expect(code(() => assertPollTransition('cancel', 'CANCELLED'))).toBe('WRONG_STATUS');
  });

  it('starting needs two options and an end date in the future', () => {
    expect(code(() => assertPollReady(1, new Date('2026-12-01'), now))).toBe('NOT_ENOUGH_OPTIONS');
    expect(code(() => assertPollReady(2, new Date('2026-10-01'), now))).toBe('POLL_WINDOW_PASSED');
    expect(code(() => assertPollReady(2, new Date('2026-12-01'), now))).toBeNull();
  });

  it('an answer is one of the poll\'s options, inside its dates', () => {
    expect(code(() => assertPollAnswer({ poll: open, validOptionIds: [1, 2], optionIds: [1], now }))).toBeNull();
    expect(code(() => assertPollAnswer({ poll: open, validOptionIds: [1, 2], optionIds: [], now }))).toBe('BLANK_ANSWER');
    expect(code(() => assertPollAnswer({ poll: open, validOptionIds: [1, 2], optionIds: [9], now }))).toBe('INVALID_OPTION');
    expect(code(() => assertPollAnswer({ poll: open, validOptionIds: [1, 2], optionIds: [1, 1], now }))).toBe('DUPLICATE_OPTION');
    expect(code(() => assertPollAnswer({ poll: open, validOptionIds: [1, 2], optionIds: [1, 2], now }))).toBe('TOO_MANY_CHOICES');
    expect(code(() => assertPollAnswer({ poll: { ...open, status: 'CLOSED' }, validOptionIds: [1], optionIds: [1], now }))).toBe('POLL_NOT_OPEN');
    expect(code(() => assertPollAnswer({ poll: { ...open, endDate: new Date('2026-11-01T09:00:00Z') }, validOptionIds: [1], optionIds: [1], now }))).toBe('POLL_ENDED');
  });

  it('a multiple-choice poll takes several answers up to its limit', () => {
    const multi = { ...open, pollType: 'MULTIPLE_CHOICE', maxChoices: 2 };
    expect(code(() => assertPollAnswer({ poll: multi, validOptionIds: [1, 2, 3], optionIds: [1, 2], now }))).toBeNull();
    expect(code(() => assertPollAnswer({ poll: multi, validOptionIds: [1, 2, 3], optionIds: [1, 2, 3], now }))).toBe('TOO_MANY_CHOICES');
  });

  it('live results are for the managers unless the poll shows them', () => {
    expect(code(() => assertPollResultsVisible('ACTIVE', false, false))).toBe('RESULTS_NOT_READY');
    expect(code(() => assertPollResultsVisible('ACTIVE', false, true))).toBeNull();
    expect(code(() => assertPollResultsVisible('ACTIVE', true, false))).toBeNull();
    expect(code(() => assertPollResultsVisible('CLOSED', false, false))).toBeNull();
    expect(code(() => assertPollResultsVisible('DRAFT', false, true))).toBe('RESULTS_NOT_READY');
  });
});
