/**
 * The election and poll integrity paths: every step is claimed so it happens once, a vote and a close can't interleave, nobody
 * decides their own nomination, a ballot is valid or refused, and results stay private until published. Prisma is mocked.
 */
const tx: any = {
  $queryRaw: jest.fn(),
  election: { findFirst: jest.fn(), findFirstOrThrow: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  candidate: { findFirst: jest.fn(), findFirstOrThrow: jest.fn(), updateMany: jest.fn(), update: jest.fn(), create: jest.fn() },
  vote: { findFirst: jest.fn(), groupBy: jest.fn(), create: jest.fn() },
  member: { findFirst: jest.fn(), count: jest.fn() },
  poll: { findFirst: jest.fn(), findFirstOrThrow: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  pollResponse: { findFirst: jest.fn(), groupBy: jest.fn(), createMany: jest.fn() },
  pollOption: { updateMany: jest.fn() },
};
const mockPrisma: any = {
  election: { findFirst: jest.fn(), findFirstOrThrow: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
  candidate: { findFirst: jest.fn(), updateMany: jest.fn(), findFirstOrThrow: jest.fn(), findMany: jest.fn() },
  vote: { groupBy: jest.fn() },
  poll: { findFirst: jest.fn(), findFirstOrThrow: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
  member: { count: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(async (arg: any) => arg(tx)),
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));

import { votingService } from '../../src/modules/voting/voting.service';

const day = 24 * 3600 * 1000;
const future = () => new Date(Date.now() + 3 * day);
const past = () => new Date(Date.now() - 3 * day);

const election = (over: object = {}) => ({
  id: 4, associationId: 1, status: 'VOTING_OPEN', votingStartDate: past(), votingEndDate: future(), allowAbstention: true,
  requiresQuorum: false, quorumPercentage: null, eligibleVoterCount: 100, positions: [{ id: 10 }, { id: 11 }], ...over,
});

beforeEach(() => {
  jest.resetAllMocks();
  mockPrisma.$transaction.mockImplementation(async (arg: any) => arg(tx));
});

describe('opening, closing and publishing', () => {
  it('a step is claimed with the status in the condition; the second of two attempts is told where the election is now', async () => {
    mockPrisma.election.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.election.findFirst.mockResolvedValue({ status: 'NOMINATIONS_CLOSED' });
    await expect(votingService.closeNominations(1, 4, 50)).rejects.toMatchObject({ status: 409, code: 'WRONG_STATUS' });
    expect(mockPrisma.election.updateMany.mock.calls[0][0].where).toMatchObject({ id: 4, associationId: 1, status: { in: ['NOMINATIONS_OPEN'] } });
  });

  it('closing nominations moves to NOMINATIONS_CLOSED, not back to draft', async () => {
    mockPrisma.election.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.election.findFirstOrThrow.mockResolvedValue({ id: 4 });
    await votingService.closeNominations(1, 4, 50);
    expect(mockPrisma.election.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'NOMINATIONS_CLOSED' });
  });

  it('cancelling needs a reason', async () => {
    await expect(votingService.cancelElection(1, 4, 50, '  ')).rejects.toMatchObject({ status: 400, code: 'REASON_REQUIRED' });
    expect(mockPrisma.election.updateMany).not.toHaveBeenCalled();
  });

  describe('startVoting', () => {
    const ready = (over: object = {}) => ({
      id: 4, status: 'NOMINATIONS_CLOSED', votingEndDate: future(),
      positions: [{ id: 10, title: 'President' }], candidates: [{ positionId: 10, status: 'APPROVED' }], ...over,
    });

    it('opens voting once, locking the election while it checks the ballot', async () => {
      tx.election.findFirst.mockResolvedValue(ready());
      tx.member.count.mockResolvedValue(80);
      tx.election.updateMany.mockResolvedValue({ count: 1 });
      tx.election.findFirstOrThrow.mockResolvedValue({ id: 4 });
      await votingService.startVoting(1, 4, 50);
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(tx.election.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'VOTING_OPEN', eligibleVoterCount: 80 });
    });

    it('is refused while a nomination is waiting, or a position has nobody to vote for', async () => {
      tx.election.findFirst.mockResolvedValue(ready({ candidates: [{ positionId: 10, status: 'APPROVED' }, { positionId: 10, status: 'PENDING' }] }));
      await expect(votingService.startVoting(1, 4, 50)).rejects.toMatchObject({ code: 'PENDING_CANDIDATES' });
      tx.election.findFirst.mockResolvedValue(ready({ candidates: [] }));
      await expect(votingService.startVoting(1, 4, 50)).rejects.toMatchObject({ code: 'NO_CANDIDATES' });
      expect(tx.election.updateMany).not.toHaveBeenCalled();
    });

    it("can't open while nominations are still open, or after the end date has passed", async () => {
      tx.election.findFirst.mockResolvedValue(ready({ status: 'NOMINATIONS_OPEN' }));
      await expect(votingService.startVoting(1, 4, 50)).rejects.toMatchObject({ code: 'WRONG_STATUS' });
      tx.election.findFirst.mockResolvedValue(ready({ votingEndDate: past() }));
      await expect(votingService.startVoting(1, 4, 50)).rejects.toMatchObject({ code: 'VOTING_WINDOW_PASSED' });
    });
  });

  describe('closeVoting', () => {
    it('counts the members who voted after taking the lock, so no vote can follow the close', async () => {
      tx.election.findFirst.mockResolvedValue(election());
      tx.vote.groupBy.mockResolvedValue([{ voterId: 1 }, { voterId: 2 }, { voterId: 3 }]);
      tx.election.updateMany.mockResolvedValue({ count: 1 });
      tx.election.findFirstOrThrow.mockResolvedValue({ id: 4 });
      await votingService.closeVoting(1, 4, 50);
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(tx.election.updateMany.mock.calls[0][0].where).toMatchObject({ status: 'VOTING_OPEN' });
      expect(tx.election.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'VOTING_CLOSED', totalVotesCast: 3 });
    });

    it('a second close is refused', async () => {
      tx.election.findFirst.mockResolvedValue(election({ status: 'VOTING_CLOSED' }));
      await expect(votingService.closeVoting(1, 4, 50)).rejects.toMatchObject({ status: 409, code: 'WRONG_STATUS' });
      expect(tx.election.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('publishResults', () => {
    it('publishes when the quorum is met', async () => {
      tx.election.findFirst.mockResolvedValue(election({ status: 'VOTING_CLOSED', requiresQuorum: true, quorumPercentage: 50 }));
      tx.vote.groupBy.mockResolvedValue(Array.from({ length: 60 }, (_, i) => ({ voterId: i })));
      tx.election.updateMany.mockResolvedValue({ count: 1 });
      tx.election.findFirstOrThrow.mockResolvedValue({ id: 4 });
      await votingService.publishResults(1, 4, 50);
      expect(tx.election.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'RESULTS_PUBLISHED', publishedBy: 50 });
    });

    it('refuses to publish results that did not reach the quorum', async () => {
      tx.election.findFirst.mockResolvedValue(election({ status: 'VOTING_CLOSED', requiresQuorum: true, quorumPercentage: 50 }));
      tx.vote.groupBy.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ voterId: i })));
      await expect(votingService.publishResults(1, 4, 50)).rejects.toMatchObject({ status: 409, code: 'QUORUM_NOT_MET' });
      expect(tx.election.updateMany).not.toHaveBeenCalled();
    });
  });

  it("an election with votes can't be deleted", async () => {
    mockPrisma.election.findFirst.mockResolvedValue({ id: 4, status: 'CANCELLED', _count: { votes: 12 } });
    await expect(votingService.deleteElection(1, 4)).rejects.toMatchObject({ code: 'HAS_VOTES' });
    expect(mockPrisma.election.deleteMany).not.toHaveBeenCalled();
  });
});

describe('castVote', () => {
  const approved = { id: 7, positionId: 10, status: 'APPROVED' };

  const setUp = (over: object = {}) => {
    tx.election.findFirst.mockResolvedValue(election(over));
    tx.member.findFirst.mockResolvedValue({ id: 3 });
    tx.candidate.findFirst.mockResolvedValue(approved);
    tx.vote.findFirst.mockResolvedValue(null);
    tx.vote.create.mockResolvedValue({ voteHash: 'abc' });
  };

  it('locks the election, records the vote and counts it, and counts the voter once', async () => {
    setUp();
    const result = await votingService.castVote(1, 4, 3, { positionId: 10, candidateId: 7, isAbstention: false });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.vote.create.mock.calls[0][0].data).toMatchObject({ electionId: 4, positionId: 10, candidateId: 7, voterId: 3 });
    expect(tx.candidate.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { voteCount: { increment: 1 } } });
    expect(tx.election.update).toHaveBeenCalledTimes(1);
    expect(result.voteHash).toBe('abc');
  });

  it('a second vote for the same position is refused and counts nothing', async () => {
    setUp();
    tx.vote.findFirst.mockResolvedValueOnce({ id: 99 });
    await expect(votingService.castVote(1, 4, 3, { positionId: 10, candidateId: 7, isAbstention: false })).rejects.toMatchObject({ status: 409, code: 'ALREADY_VOTED' });
    expect(tx.vote.create).not.toHaveBeenCalled();
    expect(tx.candidate.update).not.toHaveBeenCalled();
  });

  it('voting for a second position does not count the voter twice', async () => {
    setUp();
    tx.candidate.findFirst.mockResolvedValue({ id: 8, positionId: 11, status: 'APPROVED' });
    tx.vote.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 5 });
    await votingService.castVote(1, 4, 3, { positionId: 11, candidateId: 8, isAbstention: false });
    expect(tx.election.update).not.toHaveBeenCalled();
  });

  it('a vote after the election closed, or after its end date, is refused', async () => {
    setUp({ status: 'VOTING_CLOSED' });
    await expect(votingService.castVote(1, 4, 3, { positionId: 10, candidateId: 7, isAbstention: false })).rejects.toMatchObject({ code: 'VOTING_NOT_OPEN' });
    setUp({ votingEndDate: past() });
    await expect(votingService.castVote(1, 4, 3, { positionId: 10, candidateId: 7, isAbstention: false })).rejects.toMatchObject({ code: 'VOTING_ENDED' });
    expect(tx.vote.create).not.toHaveBeenCalled();
  });

  it('a blank ballot, a candidate from another position and a pending candidate are all refused', async () => {
    setUp();
    await expect(votingService.castVote(1, 4, 3, { positionId: 10, isAbstention: false } as any)).rejects.toMatchObject({ code: 'BLANK_BALLOT' });
    tx.candidate.findFirst.mockResolvedValue({ id: 8, positionId: 11, status: 'APPROVED' });
    await expect(votingService.castVote(1, 4, 3, { positionId: 10, candidateId: 8, isAbstention: false })).rejects.toMatchObject({ code: 'INVALID_CANDIDATE' });
    tx.candidate.findFirst.mockResolvedValue({ id: 7, positionId: 10, status: 'PENDING' });
    await expect(votingService.castVote(1, 4, 3, { positionId: 10, candidateId: 7, isAbstention: false })).rejects.toMatchObject({ code: 'INVALID_CANDIDATE' });
    expect(tx.vote.create).not.toHaveBeenCalled();
  });

  it('an inactive member cannot vote', async () => {
    setUp();
    tx.member.findFirst.mockResolvedValue(null);
    await expect(votingService.castVote(1, 4, 3, { positionId: 10, candidateId: 7, isAbstention: false })).rejects.toMatchObject({ status: 403, code: 'NOT_ELIGIBLE' });
  });

  it('abstaining records no candidate and bumps no tally', async () => {
    setUp();
    await votingService.castVote(1, 4, 3, { positionId: 10, isAbstention: true });
    expect(tx.vote.create.mock.calls[0][0].data).toMatchObject({ candidateId: null, isAbstention: true });
    expect(tx.candidate.update).not.toHaveBeenCalled();
  });
});

describe('candidates', () => {
  const pending = (over: object = {}) => ({ id: 7, electionId: 4, memberId: 3, election: { associationId: 1, status: 'NOMINATIONS_CLOSED' }, ...over });

  it('approving is claimed from PENDING, and a nomination decided at the same moment is reported', async () => {
    tx.candidate.findFirst.mockResolvedValue(pending());
    tx.member.findFirst.mockResolvedValue({ id: 99 });
    tx.candidate.updateMany.mockResolvedValue({ count: 0 });
    await expect(votingService.approveCandidate(1, 7, 50, { status: 'APPROVED' })).rejects.toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
    expect(tx.candidate.updateMany.mock.calls[0][0].where).toMatchObject({ id: 7, status: 'PENDING' });
  });

  it("nobody approves or rejects their own nomination", async () => {
    tx.candidate.findFirst.mockResolvedValue(pending());
    tx.member.findFirst.mockResolvedValue({ id: 3 });
    await expect(votingService.approveCandidate(1, 7, 50, { status: 'APPROVED' })).rejects.toMatchObject({ status: 403, code: 'OWN_NOMINATION' });
    expect(tx.candidate.updateMany).not.toHaveBeenCalled();
  });

  it('a nomination cannot be decided once voting has opened', async () => {
    tx.candidate.findFirst.mockResolvedValue(pending({ election: { associationId: 1, status: 'VOTING_OPEN' } }));
    await expect(votingService.approveCandidate(1, 7, 50, { status: 'APPROVED' })).rejects.toMatchObject({ code: 'CANDIDATES_LOCKED' });
  });

  it('a rejection needs a reason', async () => {
    await expect(votingService.approveCandidate(1, 7, 50, { status: 'REJECTED' } as any)).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it("a candidate can't withdraw once voting has opened", async () => {
    mockPrisma.candidate.findFirst.mockResolvedValue({ id: 7, memberId: 3, election: { associationId: 1, status: 'VOTING_OPEN' } });
    await expect(votingService.withdrawCandidate(1, 7, 3, {})).rejects.toMatchObject({ code: 'WITHDRAW_LOCKED' });
    expect(mockPrisma.candidate.updateMany).not.toHaveBeenCalled();
  });

  it('a member nominates themselves only while nominations are open, and not twice for the same position', async () => {
    tx.election.findFirst.mockResolvedValue({ id: 4, status: 'DRAFT', positions: [{ id: 10 }] });
    await expect(votingService.selfNominate(1, 4, 3, { positionId: 10 } as any)).rejects.toMatchObject({ code: 'NOMINATIONS_CLOSED' });

    tx.election.findFirst.mockResolvedValue({ id: 4, status: 'NOMINATIONS_OPEN', positions: [{ id: 10 }] });
    tx.member.findFirst.mockResolvedValue({ id: 3 });
    tx.candidate.findFirst.mockResolvedValue({ id: 1 });
    await expect(votingService.selfNominate(1, 4, 3, { positionId: 10 } as any)).rejects.toMatchObject({ code: 'ALREADY_CANDIDATE' });
    expect(tx.candidate.create).not.toHaveBeenCalled();
  });

  it('a candidate goes in pending, for someone else to decide', async () => {
    tx.election.findFirst.mockResolvedValue({ id: 4, status: 'NOMINATIONS_OPEN', positions: [{ id: 10 }] });
    tx.member.findFirst.mockResolvedValue({ id: 3 });
    tx.candidate.findFirst.mockResolvedValue(null);
    tx.candidate.create.mockResolvedValue({ id: 1 });
    await votingService.registerCandidate(1, 4, 50, { memberId: 3, positionId: 10 } as any);
    expect(tx.candidate.create.mock.calls[0][0].data).toMatchObject({ status: 'PENDING', nominatedBy: 50, positionId: 10 });
  });

  it('a position is required when the election has positions', async () => {
    tx.election.findFirst.mockResolvedValue({ id: 4, status: 'NOMINATIONS_OPEN', positions: [{ id: 10 }] });
    tx.member.findFirst.mockResolvedValue({ id: 3 });
    await expect(votingService.registerCandidate(1, 4, 50, { memberId: 3 } as any)).rejects.toMatchObject({ code: 'POSITION_REQUIRED' });
  });
});

describe('results', () => {
  const resultsElection = (over: object = {}) => ({
    id: 4, title: 'AGM', status: 'VOTING_CLOSED', eligibleVoterCount: 100, requiresQuorum: false, quorumPercentage: null,
    positions: [{ id: 10, title: 'President', candidates: [
      { id: 1, memberId: 1, voteCount: 5, member: { firstName: 'Ada', lastName: 'Obi' } },
      { id: 2, memberId: 2, voteCount: 5, member: { firstName: 'Bayo', lastName: 'Ade' } },
    ] }],
    candidates: [], ...over,
  });

  beforeEach(() => {
    mockPrisma.vote.groupBy.mockResolvedValue([{ voterId: 1 }, { voterId: 2 }]);
  });

  it('before they are published, only the committee can see them', async () => {
    mockPrisma.election.findFirst.mockResolvedValue(resultsElection());
    await expect(votingService.getElectionResults(1, 4, false)).rejects.toMatchObject({ status: 403, code: 'RESULTS_NOT_PUBLISHED' });
    await expect(votingService.getElectionResults(1, 4, true)).resolves.toMatchObject({ published: false });
  });

  it('nobody sees a tally while voting is open', async () => {
    mockPrisma.election.findFirst.mockResolvedValue(resultsElection({ status: 'VOTING_OPEN' }));
    await expect(votingService.getElectionResults(1, 4, true)).rejects.toMatchObject({ status: 409, code: 'RESULTS_NOT_READY' });
  });

  it('published results are open to everyone, and turnout counts people', async () => {
    mockPrisma.election.findFirst.mockResolvedValue(resultsElection({ status: 'RESULTS_PUBLISHED' }));
    const results = await votingService.getElectionResults(1, 4, false);
    expect(results.totalVotesCast).toBe(2);
    expect(results.voterTurnout).toBe(2);
  });

  it('a tie has no winner and names the candidates level at the top', async () => {
    mockPrisma.election.findFirst.mockResolvedValue(resultsElection({ status: 'RESULTS_PUBLISHED' }));
    const { positions } = await votingService.getElectionResults(1, 4, false);
    expect(positions[0].winner).toBeUndefined();
    expect(positions[0].tied.map((c: any) => c.candidateId)).toEqual([1, 2]);
  });
});

describe('vote counts on the election itself', () => {
  const withCounts = (status: string) => ({
    id: 4, status,
    positions: [{ id: 10, candidates: [{ id: 1, voteCount: 9 }] }],
    candidates: [{ id: 1, voteCount: 9 }],
  });

  it('are hidden from everyone while voting is open, and from members before the results are published', async () => {
    mockPrisma.election.findFirst.mockResolvedValue(withCounts('VOTING_OPEN'));
    const open = await votingService.getElection(1, 4, true);
    expect(open.positions[0].candidates[0].voteCount).toBe(0);
    expect(open.candidates[0].voteCount).toBe(0);

    mockPrisma.election.findFirst.mockResolvedValue(withCounts('VOTING_CLOSED'));
    expect((await votingService.getElection(1, 4, false)).candidates[0].voteCount).toBe(0);
  });

  it('are shown to the committee once voting has closed, and to everyone once published', async () => {
    mockPrisma.election.findFirst.mockResolvedValue(withCounts('VOTING_CLOSED'));
    expect((await votingService.getElection(1, 4, true)).candidates[0].voteCount).toBe(9);
    mockPrisma.election.findFirst.mockResolvedValue(withCounts('RESULTS_PUBLISHED'));
    expect((await votingService.getElection(1, 4, false)).positions[0].candidates[0].voteCount).toBe(9);
  });

  it('the candidate list follows the same rule, and never carries email addresses', async () => {
    mockPrisma.election.findFirst.mockResolvedValue({ id: 4, status: 'VOTING_OPEN' });
    mockPrisma.candidate.findMany.mockResolvedValue([{ id: 1, voteCount: 9 }]);
    expect((await votingService.listCandidates(1, 4, {}, true))[0].voteCount).toBe(0);
    expect(mockPrisma.candidate.findMany.mock.calls[0][0].include.member.select).not.toHaveProperty('email');
  });
});

describe('polls', () => {
  const poll = (over: object = {}) => ({
    id: 9, associationId: 1, status: 'ACTIVE', startDate: past(), endDate: future(), pollType: 'SINGLE_CHOICE', maxChoices: null,
    options: [{ id: 1 }, { id: 2 }], ...over,
  });

  it('picking several answers follows the poll type, whatever the caller sends', async () => {
    mockPrisma.poll.create.mockResolvedValue({ id: 9 });
    const base = { title: 'Which days?', startDate: '2027-01-10T09:00:00.000Z', endDate: '2027-01-12T09:00:00.000Z', options: [{ optionText: 'Sat' }, { optionText: 'Sun' }] };
    await votingService.createPoll(1, 50, { ...base, pollType: 'SINGLE_CHOICE', allowMultipleVotes: true, maxChoices: 3 } as any);
    expect(mockPrisma.poll.create.mock.calls[0][0].data).toMatchObject({ allowMultipleVotes: false, maxChoices: null });
    await votingService.createPoll(1, 50, { ...base, pollType: 'MULTIPLE_CHOICE', allowMultipleVotes: false, maxChoices: 2 } as any);
    expect(mockPrisma.poll.create.mock.calls[1][0].data).toMatchObject({ allowMultipleVotes: true, maxChoices: 2 });
  });

  it('a poll must end after it starts', async () => {
    await expect(votingService.createPoll(1, 50, { title: 'x', pollType: 'YES_NO', startDate: '2027-01-12T09:00:00.000Z', endDate: '2027-01-10T09:00:00.000Z', options: [] } as any)).rejects.toMatchObject({ code: 'BAD_WINDOW' });
  });

  it('starting is claimed from DRAFT and refuses a poll whose end date has passed', async () => {
    mockPrisma.poll.findFirst.mockResolvedValue({ id: 9, status: 'DRAFT', endDate: past(), _count: { options: 2 } });
    await expect(votingService.startPoll(1, 9)).rejects.toMatchObject({ code: 'POLL_WINDOW_PASSED' });
    mockPrisma.poll.findFirst.mockResolvedValue({ id: 9, status: 'DRAFT', endDate: future(), _count: { options: 2 } });
    mockPrisma.poll.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.poll.findFirstOrThrow.mockResolvedValue({ id: 9 });
    await votingService.startPoll(1, 9);
    expect(mockPrisma.poll.updateMany.mock.calls[0][0].where).toMatchObject({ id: 9, status: { in: ['DRAFT'] } });
  });

  it('closing counts the members who answered, after the lock', async () => {
    tx.poll.findFirst.mockResolvedValue(poll());
    tx.pollResponse.groupBy.mockResolvedValue([{ responderId: 1 }, { responderId: 2 }]);
    tx.poll.updateMany.mockResolvedValue({ count: 1 });
    tx.poll.findFirstOrThrow.mockResolvedValue({ id: 9 });
    await votingService.closePoll(1, 9);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.poll.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'CLOSED', totalResponses: 2 });
  });

  it('a member answers once, whatever the poll says about multiple votes', async () => {
    tx.poll.findFirst.mockResolvedValue(poll({ allowMultipleVotes: true }));
    tx.member.findFirst.mockResolvedValue({ id: 3 });
    tx.pollResponse.findFirst.mockResolvedValue({ id: 1 });
    await expect(votingService.submitPollResponse(1, 9, 3, { optionIds: [1] })).rejects.toMatchObject({ status: 409, code: 'ALREADY_RESPONDED' });
    expect(tx.pollResponse.createMany).not.toHaveBeenCalled();
  });

  it('records one answer per chosen option and counts the member once', async () => {
    tx.poll.findFirst.mockResolvedValue(poll({ pollType: 'MULTIPLE_CHOICE', maxChoices: 2 }));
    tx.member.findFirst.mockResolvedValue({ id: 3 });
    tx.pollResponse.findFirst.mockResolvedValue(null);
    await votingService.submitPollResponse(1, 9, 3, { optionIds: [1, 2] });
    expect(tx.pollResponse.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(tx.poll.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { totalResponses: { increment: 1 } } });
  });

  it('answers after the poll closed, or for an option that is not in it, are refused', async () => {
    tx.poll.findFirst.mockResolvedValue(poll({ status: 'CLOSED' }));
    await expect(votingService.submitPollResponse(1, 9, 3, { optionIds: [1] })).rejects.toMatchObject({ code: 'POLL_NOT_OPEN' });
    tx.poll.findFirst.mockResolvedValue(poll());
    await expect(votingService.submitPollResponse(1, 9, 3, { optionIds: [77] })).rejects.toMatchObject({ code: 'INVALID_OPTION' });
    expect(tx.pollResponse.createMany).not.toHaveBeenCalled();
  });

  it('the answers so far stay hidden on the poll itself unless it shows them or the caller runs polls', async () => {
    const live = { id: 9, status: 'ACTIVE', showResultsBeforeEnd: false, options: [{ id: 1, voteCount: 6 }] };
    mockPrisma.poll.findFirst.mockResolvedValue(live);
    expect((await votingService.getPoll(1, 9, false)).options[0].voteCount).toBe(0);
    expect((await votingService.getPoll(1, 9, true)).options[0].voteCount).toBe(6);
    mockPrisma.poll.findFirst.mockResolvedValue({ ...live, showResultsBeforeEnd: true });
    expect((await votingService.getPoll(1, 9, false)).options[0].voteCount).toBe(6);
    mockPrisma.poll.findFirst.mockResolvedValue({ ...live, status: 'CLOSED' });
    expect((await votingService.getPoll(1, 9, false)).options[0].voteCount).toBe(6);
  });

  it('a poll with answers is kept as a record, not deleted', async () => {
    mockPrisma.poll.findFirst.mockResolvedValue({ id: 9, status: 'CANCELLED', _count: { responses: 4 } });
    await expect(votingService.deletePoll(1, 9)).rejects.toMatchObject({ code: 'HAS_RESPONSES' });
    expect(mockPrisma.poll.deleteMany).not.toHaveBeenCalled();
  });

  it('live results stay hidden from members unless the poll shows them; managers always see them', async () => {
    mockPrisma.poll.findFirst.mockResolvedValue({ ...poll({ showResultsBeforeEnd: false }), title: 'Q', totalResponses: 0, options: [] });
    await expect(votingService.getPollResults(1, 9, 3, false)).rejects.toMatchObject({ code: 'RESULTS_NOT_READY' });
    await expect(votingService.getPollResults(1, 9, undefined, true)).resolves.toMatchObject({ status: 'ACTIVE' });
  });
});

describe('finding members to put forward', () => {
  it('searches active members of this association by name or number, capped', async () => {
    mockPrisma.member.findMany.mockResolvedValue([]);
    await votingService.searchCandidateMembers(1, ' ada ', 500);
    const args = mockPrisma.member.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ associationId: 1, status: 'active' });
    expect(args.where.OR).toHaveLength(3);
    expect(args.take).toBe(50);
  });
});
