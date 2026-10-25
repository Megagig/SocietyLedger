/**
 * Who can vote and who can stand, against the database: the default (no rule) changes nothing, a rule is enforced when voting and
 * nominating, the committee's exceptions beat the rule, the count of who can vote is live, and a rule saved on an election is a copy.
 * Prisma is mocked.
 */
const tx: any = {
  $queryRaw: jest.fn(),
  election: { findFirst: jest.fn(), update: jest.fn() },
  candidate: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
  vote: { findFirst: jest.fn(), create: jest.fn() },
  member: { findFirst: jest.fn(), findMany: jest.fn() },
  transaction: { findMany: jest.fn() },
  electionEligibilityException: { findMany: jest.fn(), count: jest.fn() },
};
const mockPrisma: any = {
  ...tx,
  election: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  vote: { findFirst: jest.fn(), groupBy: jest.fn() },
  settings: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  electionEligibilityException: { findMany: jest.fn(), count: jest.fn(), upsert: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
  member: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
  $transaction: jest.fn(async (arg: any) => arg(tx)),
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));

import { eligibilityService } from '../../src/modules/voting/eligibility.service';
import { votingService } from '../../src/modules/voting/voting.service';

const day = 24 * 3600 * 1000;
const open = (rules: unknown = null, over: object = {}) => ({
  id: 4, associationId: 1, status: 'VOTING_OPEN', votingStartDate: new Date(Date.now() - day), votingEndDate: new Date(Date.now() + day), allowAbstention: true,
  eligibleVoterCount: 3, eligibilityRules: rules, positions: [{ id: 10 }], ...over,
});
const member = (over: object = {}) => ({ id: 3, status: 'active', category: 'regular', joinDate: new Date('2020-01-01'), ...over });
const ballot = { positionId: 10, candidateId: 7, isAbstention: false };

beforeEach(() => {
  jest.resetAllMocks();
  mockPrisma.$transaction.mockImplementation(async (arg: any) => arg(tx));
  tx.candidate.findFirst.mockResolvedValue({ id: 7, positionId: 10, status: 'APPROVED' });
  tx.vote.create.mockResolvedValue({ voteHash: 'h' });
});

describe('the default: no rule set', () => {
  it('voting is exactly as before, and nothing is looked up about money or exceptions beyond a count', async () => {
    tx.election.findFirst.mockResolvedValue(open(null));
    tx.member.findFirst.mockResolvedValue(member());
    tx.electionEligibilityException.count.mockResolvedValue(0);
    await votingService.castVote(1, 4, 3, ballot);
    expect(tx.vote.create).toHaveBeenCalled();
    expect(tx.transaction.findMany).not.toHaveBeenCalled();
  });

  it('standing for a position is as before', async () => {
    tx.election.findFirst.mockResolvedValue({ id: 4, status: 'NOMINATIONS_OPEN', eligibilityRules: null, positions: [{ id: 10 }] });
    tx.member.findFirst.mockResolvedValue(member());
    tx.candidate.findFirst.mockResolvedValue(null);
    tx.electionEligibilityException.count.mockResolvedValue(0);
    tx.candidate.create.mockResolvedValue({ id: 1 });
    await votingService.registerCandidate(1, 4, 50, { memberId: 3, positionId: 10 } as any);
    expect(tx.candidate.create).toHaveBeenCalled();
  });

  it('who can vote is the number fixed when voting opened', async () => {
    mockPrisma.electionEligibilityException.count.mockResolvedValue(0);
    expect(await eligibilityService.eligibleVoterCount(mockPrisma, 1, { id: 4, eligibilityRules: null, eligibleVoterCount: 80 }, [1, 2])).toBe(80);
    expect(mockPrisma.member.findMany).not.toHaveBeenCalled();
  });
});

describe('a financial-standing rule', () => {
  const rules = { voters: { financialStanding: { maxOverdue: 0 } } };

  beforeEach(() => {
    tx.election.findFirst.mockResolvedValue(open(rules));
    tx.member.findFirst.mockResolvedValue(member());
    tx.electionEligibilityException.findMany.mockResolvedValue([]);
  });

  it('turns away a member with an overdue charge, saying how much, and records no vote', async () => {
    tx.transaction.findMany.mockResolvedValue([{ memberId: 3, amount: 5000, payments: [] }]);
    await expect(votingService.castVote(1, 4, 3, ballot)).rejects.toMatchObject({ status: 403, code: 'NOT_ELIGIBLE', message: 'You have ₦5,000.00 overdue. Clear it to vote.' });
    expect(tx.vote.create).not.toHaveBeenCalled();
  });

  it('counts only what is still owed: a part-paid charge owes the rest, a settled one nothing', async () => {
    tx.transaction.findMany.mockResolvedValue([{ memberId: 3, amount: 5000, payments: [{ amountPaid: 3000 }] }]);
    await expect(votingService.castVote(1, 4, 3, ballot)).rejects.toMatchObject({ message: 'You have ₦2,000.00 overdue. Clear it to vote.' });
    tx.transaction.findMany.mockResolvedValue([{ memberId: 3, amount: 5000, payments: [{ amountPaid: 5000 }] }]);
    await votingService.castVote(1, 4, 3, ballot);
    expect(tx.vote.create).toHaveBeenCalledTimes(1);
  });

  it('lets the member in as soon as they have cleared it, mid-election', async () => {
    tx.transaction.findMany.mockResolvedValueOnce([{ memberId: 3, amount: 5000, payments: [] }]).mockResolvedValueOnce([]);
    await expect(votingService.castVote(1, 4, 3, ballot)).rejects.toMatchObject({ code: 'NOT_ELIGIBLE' });
    await votingService.castVote(1, 4, 3, ballot);
    expect(tx.vote.create).toHaveBeenCalledTimes(1);
  });

  it("the committee's exception lets a named member in, or keeps one out", async () => {
    tx.transaction.findMany.mockResolvedValue([{ memberId: 3, amount: 5000, payments: [] }]);
    tx.electionEligibilityException.findMany.mockResolvedValue([{ memberId: 3, scope: 'VOTE', kind: 'ALLOW' }]);
    await votingService.castVote(1, 4, 3, ballot);
    expect(tx.vote.create).toHaveBeenCalledTimes(1);

    tx.transaction.findMany.mockResolvedValue([]);
    tx.electionEligibilityException.findMany.mockResolvedValue([{ memberId: 3, scope: 'VOTE', kind: 'BAR' }]);
    await expect(votingService.castVote(1, 4, 3, ballot)).rejects.toMatchObject({ code: 'NOT_ELIGIBLE' });
  });
});

describe('a rule for who can stand', () => {
  const rules = { candidates: { minMembershipMonths: 12, maxPositions: 1 } };
  const nominating = () => {
    tx.election.findFirst.mockResolvedValue({ id: 4, status: 'NOMINATIONS_OPEN', eligibilityRules: rules, positions: [{ id: 10 }, { id: 11 }] });
    tx.candidate.findFirst.mockResolvedValue(null);
    tx.electionEligibilityException.findMany.mockResolvedValue([]);
    tx.candidate.count.mockResolvedValue(0);
    tx.candidate.create.mockResolvedValue({ id: 1 });
  };

  it('a member who has not been one long enough cannot nominate themselves', async () => {
    nominating();
    tx.member.findFirst.mockResolvedValue(member({ joinDate: new Date() }));
    await expect(votingService.selfNominate(1, 4, 3, { positionId: 10 } as any)).rejects.toMatchObject({ status: 403, code: 'NOT_ELIGIBLE' });
    expect(tx.candidate.create).not.toHaveBeenCalled();
  });

  it('the committee is told which member and why, so it knows what to fix', async () => {
    nominating();
    tx.member.findFirst.mockResolvedValue(member({ joinDate: new Date() }));
    await expect(votingService.registerCandidate(1, 4, 50, { memberId: 3, positionId: 10 } as any)).rejects.toMatchObject({
      message: expect.stringContaining("That member can't stand in this election."),
    });
  });

  it('limits how many positions one person can stand for', async () => {
    nominating();
    tx.member.findFirst.mockResolvedValue(member());
    tx.candidate.count.mockResolvedValue(1);
    await expect(votingService.selfNominate(1, 4, 3, { positionId: 11 } as any)).rejects.toMatchObject({ code: 'NOT_ELIGIBLE', message: expect.stringContaining('already stand for 1 position') });
  });

  it('a long-standing member who stands for nothing yet is let through', async () => {
    nominating();
    tx.member.findFirst.mockResolvedValue(member());
    await votingService.selfNominate(1, 4, 3, { positionId: 10 } as any);
    expect(tx.candidate.create).toHaveBeenCalled();
  });
});

describe('who can vote, counted now', () => {
  it('counts the members who meet the rule today, plus anyone who has already voted', async () => {
    mockPrisma.electionEligibilityException.count.mockResolvedValue(0);
    mockPrisma.electionEligibilityException.findMany.mockResolvedValue([]);
    mockPrisma.member.findMany.mockResolvedValue([member({ id: 1 }), member({ id: 2 }), member({ id: 3 })]);
    mockPrisma.transaction = { findMany: jest.fn().mockResolvedValue([{ memberId: 2, amount: 100, payments: [] }, { memberId: 3, amount: 100, payments: [] }]) };
    const election = { id: 4, eligibleVoterCount: 3, eligibilityRules: { voters: { financialStanding: { maxOverdue: 0 } } } };
    // members 2 and 3 owe; member 3 voted before they fell behind, so still counts
    expect(await eligibilityService.eligibleVoterCount(mockPrisma, 1, election, [3])).toBe(2);
    expect(await eligibilityService.eligibleVoterCount(mockPrisma, 1, election, [])).toBe(1);
  });
});

describe('exceptions', () => {
  it('need a reason', async () => {
    await expect(eligibilityService.addException(1, 4, 50, { memberId: 3, scope: 'VOTE', kind: 'ALLOW', reason: '  ' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it('cannot bar someone who has already voted: a cast vote is never taken back', async () => {
    mockPrisma.election.findFirst.mockResolvedValue({ id: 4, status: 'VOTING_OPEN' });
    mockPrisma.member.findFirst.mockResolvedValue({ id: 3 });
    mockPrisma.vote.findFirst.mockResolvedValue({ id: 9 });
    await expect(eligibilityService.addException(1, 4, 50, { memberId: 3, scope: 'VOTE', kind: 'BAR', reason: 'Disciplinary hold' })).rejects.toMatchObject({ status: 409, code: 'ALREADY_VOTED' });
  });

  it('can be made while voting is open, but not once it has closed', async () => {
    mockPrisma.member.findFirst.mockResolvedValue({ id: 3 });
    mockPrisma.electionEligibilityException.upsert.mockResolvedValue({ id: 1 });
    mockPrisma.election.findFirst.mockResolvedValue({ id: 4, status: 'VOTING_OPEN' });
    await eligibilityService.addException(1, 4, 50, { memberId: 3, scope: 'VOTE', kind: 'ALLOW', reason: 'One day short of the year' });
    expect(mockPrisma.electionEligibilityException.upsert.mock.calls[0][0].create).toMatchObject({ electionId: 4, memberId: 3, scope: 'VOTE', kind: 'ALLOW', createdBy: 50 });
    mockPrisma.election.findFirst.mockResolvedValue({ id: 4, status: 'VOTING_CLOSED' });
    await expect(eligibilityService.addException(1, 4, 50, { memberId: 3, scope: 'VOTE', kind: 'ALLOW', reason: 'Late' })).rejects.toMatchObject({ code: 'EXCEPTIONS_LOCKED' });
  });
});

describe('saving rules', () => {
  it('can be changed on an election until voting opens, and not after', async () => {
    mockPrisma.election.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.election.findFirst.mockResolvedValue({ id: 4, eligibilityRules: null });
    mockPrisma.electionEligibilityException.findMany.mockResolvedValue([]);
    await eligibilityService.setForElection(1, 4, { voters: { minMembershipMonths: 6 } });
    expect(mockPrisma.election.updateMany.mock.calls[0][0].where.status.in).toEqual(['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED']);

    mockPrisma.election.updateMany.mockResolvedValue({ count: 0 });
    await expect(eligibilityService.setForElection(1, 4, { voters: { minMembershipMonths: 6 } })).rejects.toMatchObject({ code: 'RULES_LOCKED' });
  });

  it('refuses a rule it does not understand before anything is saved', async () => {
    await expect(eligibilityService.setForElection(1, 4, { voters: { livesInLagos: true } })).rejects.toMatchObject({ code: 'BAD_ELIGIBILITY_RULE' });
    expect(mockPrisma.election.updateMany).not.toHaveBeenCalled();
  });
});

describe("the association's template", () => {
  it('a new election starts from it, as a copy, when no rule is given', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue({ value: JSON.stringify({ voters: { financialStanding: { maxOverdue: 0 } } }) });
    mockPrisma.member.count.mockResolvedValue(10);
    mockPrisma.election.create.mockResolvedValue({ id: 1 });
    await votingService.createElection(1, 50, { title: 'AGM', electionType: 'GENERAL', votingStartDate: '2027-01-10T09:00:00.000Z', votingEndDate: '2027-01-12T09:00:00.000Z' } as any);
    expect(mockPrisma.election.create.mock.calls[0][0].data.eligibilityRules).toEqual({ voters: { financialStanding: { maxOverdue: 0 } } });
  });

  it('what was chosen for this election wins over the template, and "nothing" really means nothing', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue({ value: JSON.stringify({ voters: { minMembershipMonths: 6 } }) });
    mockPrisma.member.count.mockResolvedValue(10);
    mockPrisma.election.create.mockResolvedValue({ id: 1 });
    const base = { title: 'AGM', electionType: 'GENERAL', votingStartDate: '2027-01-10T09:00:00.000Z', votingEndDate: '2027-01-12T09:00:00.000Z' };
    await votingService.createElection(1, 50, { ...base, eligibilityRules: { voters: { categories: ['regular'] } } } as any);
    expect(mockPrisma.election.create.mock.calls[0][0].data.eligibilityRules).toEqual({ voters: { categories: ['regular'] } });
    await votingService.createElection(1, 50, { ...base, eligibilityRules: {} } as any);
    expect(mockPrisma.election.create.mock.calls[1][0].data).not.toHaveProperty('eligibilityRules');
  });

  it('with no template and no rule, an election has none: the default', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(null);
    mockPrisma.member.count.mockResolvedValue(10);
    mockPrisma.election.create.mockResolvedValue({ id: 1 });
    await votingService.createElection(1, 50, { title: 'AGM', electionType: 'GENERAL', votingStartDate: '2027-01-10T09:00:00.000Z', votingEndDate: '2027-01-12T09:00:00.000Z' } as any);
    expect(mockPrisma.election.create.mock.calls[0][0].data).not.toHaveProperty('eligibilityRules');
  });

  it('an empty template removes it', async () => {
    mockPrisma.settings.deleteMany.mockResolvedValue({ count: 1 });
    expect(await eligibilityService.setTemplate(1, 50, {})).toBeNull();
    expect(mockPrisma.settings.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.settings.upsert).not.toHaveBeenCalled();
  });
});

describe('what the rule forms offer', () => {
  it('the categories in use here, plus the ones the app has always had', async () => {
    mockPrisma.member.groupBy.mockResolvedValue([{ category: 'Founder' }, { category: 'regular' }]);
    expect((await eligibilityService.options(1)).categories).toEqual(['executive', 'founder', 'honorary', 'regular', 'student']);
  });
});
