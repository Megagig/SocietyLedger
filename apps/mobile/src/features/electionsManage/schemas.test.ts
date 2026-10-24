import {
  electionFormSchema,
  emptyElectionValues,
  emptyPollValues,
  pollFormSchema,
  pollOptionsProblem,
  positionSchema,
  toElectionPayload,
  toPollPayload,
  toPollUpdatePayload,
} from './schemas';

const issues = (result: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }) => (result.success ? [] : result.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`));

const election = (over: object = {}) => ({
  ...emptyElectionValues(),
  title: '2027 executive election',
  votingStartDate: '2027-01-10T09:00:00.000Z',
  votingEndDate: '2027-01-12T09:00:00.000Z',
  ...over,
});

describe('election form', () => {
  it('accepts a complete election', () => {
    expect(electionFormSchema.safeParse(election()).success).toBe(true);
  });

  it('needs a title and the voting dates', () => {
    const found = issues(electionFormSchema.safeParse({ ...emptyElectionValues() }));
    expect(found.some((i) => i.startsWith('title'))).toBe(true);
    expect(found.some((i) => i.startsWith('votingStartDate'))).toBe(true);
    expect(found.some((i) => i.startsWith('votingEndDate'))).toBe(true);
  });

  it('voting has to end after it starts, and nominations have to close before voting', () => {
    expect(issues(electionFormSchema.safeParse(election({ votingEndDate: '2027-01-09T09:00:00.000Z' })))).toContain('votingEndDate: Voting has to end after it starts');
    expect(issues(electionFormSchema.safeParse(election({ nominationEndDate: '2027-01-11T09:00:00.000Z' })))).toContain('nominationEndDate: Nominations have to close before voting starts');
    expect(issues(electionFormSchema.safeParse(election({ nominationStartDate: '2027-01-05T09:00:00.000Z', nominationEndDate: '2027-01-04T09:00:00.000Z' })))).toContain('nominationEndDate: Nominations have to end after they start');
  });

  it('a minimum turnout needs a percentage from 1 to 100', () => {
    expect(issues(electionFormSchema.safeParse(election({ requiresQuorum: true, quorumPercentage: '' })))).toContain('quorumPercentage: Say what percentage of members must vote (1 to 100)');
    expect(issues(electionFormSchema.safeParse(election({ requiresQuorum: true, quorumPercentage: '150' })))).toHaveLength(1);
    expect(electionFormSchema.safeParse(election({ requiresQuorum: true, quorumPercentage: '50' })).success).toBe(true);
    expect(electionFormSchema.safeParse(election({ requiresQuorum: false, quorumPercentage: '' })).success).toBe(true);
  });

  it('builds the payload: positions only on create, blank ones dropped, quorum only when asked for', () => {
    const values = election({ positions: [{ title: ' President ' }, { title: '' }, { title: 'Secretary' }], requiresQuorum: true, quorumPercentage: '40' });
    const created = toElectionPayload(values, true);
    expect(created.positions).toEqual([
      { title: 'President', maxCandidates: 1 },
      { title: 'Secretary', maxCandidates: 1 },
    ]);
    expect(created.quorumPercentage).toBe(40);
    expect(toElectionPayload(values, false).positions).toBeUndefined();
    expect(toElectionPayload(election(), true).quorumPercentage).toBeNull();
    expect(toElectionPayload(election(), true).nominationStartDate).toBeNull();
  });
});

describe('position form', () => {
  it('needs a title of at least two characters', () => {
    expect(issues(positionSchema.safeParse({ title: 'A', description: '' }))).toHaveLength(1);
    expect(positionSchema.safeParse({ title: 'Treasurer', description: '' }).success).toBe(true);
  });
});

describe('poll form', () => {
  const poll = (over: object = {}) => ({
    ...emptyPollValues(),
    title: 'Which day should we meet?',
    startDate: '2027-01-10T09:00:00.000Z',
    endDate: '2027-01-12T09:00:00.000Z',
    options: [{ text: 'Saturday' }, { text: 'Sunday' }],
    ...over,
  });

  it('accepts a complete poll, and the end has to follow the start', () => {
    expect(pollFormSchema.safeParse(poll()).success).toBe(true);
    expect(issues(pollFormSchema.safeParse(poll({ endDate: '2027-01-09T09:00:00.000Z' })))).toContain('endDate: The poll has to end after it starts');
  });

  it('a multiple-choice limit is a whole number', () => {
    expect(issues(pollFormSchema.safeParse(poll({ pollType: 'MULTIPLE_CHOICE', maxChoices: '0' })))).toHaveLength(1);
    expect(pollFormSchema.safeParse(poll({ pollType: 'MULTIPLE_CHOICE', maxChoices: '2' })).success).toBe(true);
  });

  it('the answers need two different ones; a yes/no poll makes its own', () => {
    expect(pollOptionsProblem(poll({ options: [{ text: 'Saturday' }, { text: '' }] }))).toBe('A poll needs at least two answers.');
    expect(pollOptionsProblem(poll({ options: [{ text: 'Saturday' }, { text: 'saturday' }] }))).toBe('Two answers are the same.');
    expect(pollOptionsProblem(poll({ pollType: 'MULTIPLE_CHOICE', maxChoices: '3' }))).toMatch('more answers than there are');
    expect(pollOptionsProblem(poll({ pollType: 'YES_NO', options: [] }))).toBeNull();
    expect(pollOptionsProblem(poll())).toBeNull();
  });

  it('builds the payload: yes/no gets Yes and No, limits only for multiple choice', () => {
    expect(toPollPayload(poll({ pollType: 'YES_NO', options: [] })).options).toEqual([{ optionText: 'Yes' }, { optionText: 'No' }]);
    const multiple = toPollPayload(poll({ pollType: 'MULTIPLE_CHOICE', maxChoices: '2' }));
    expect(multiple).toMatchObject({ allowMultipleVotes: true, maxChoices: 2 });
    expect(toPollPayload(poll({ maxChoices: '2' }))).toMatchObject({ allowMultipleVotes: false, maxChoices: null });
    expect(toPollUpdatePayload(poll())).not.toHaveProperty('options');
  });
});
