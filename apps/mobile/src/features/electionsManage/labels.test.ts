import {
  candidateGuard,
  canAddCandidates,
  canCancelElection,
  canDecideCandidates,
  canDeleteElection,
  canDeletePoll,
  canEditElection,
  electionStatusKey,
  isFinished,
  nextStep,
  OPEN_VOTING_NOW,
  stageIndex,
  turnoutPercent,
  waitingNote,
} from './labels';

describe('the next step of an election', () => {
  it('moves forward one step at a time, and the right permission takes it', () => {
    expect(nextStep('DRAFT')).toMatchObject({ action: 'startNominations', access: 'ELECTION_RUN' });
    expect(nextStep('NOMINATIONS_OPEN')).toMatchObject({ action: 'closeNominations' });
    expect(nextStep('NOMINATIONS_CLOSED')).toMatchObject({ action: 'startVoting' });
    expect(nextStep('VOTING_OPEN')).toMatchObject({ action: 'closeVoting' });
    expect(nextStep('VOTING_CLOSED')).toMatchObject({ action: 'publishResults', access: 'ELECTION_RESULTS_PUBLISH' });
  });

  it('a published or cancelled election has no next step', () => {
    expect(nextStep('RESULTS_PUBLISHED')).toBeNull();
    expect(nextStep('CANCELLED')).toBeNull();
    expect(isFinished('RESULTS_PUBLISHED')).toBe(true);
    expect(isFinished('VOTING_OPEN')).toBe(false);
  });

  it('can go straight from a draft to voting when the committee has put the candidates in', () => {
    expect(OPEN_VOTING_NOW.action).toBe('startVoting');
  });

  it('closing nominations is its own stage, not a return to draft', () => {
    expect(stageIndex('NOMINATIONS_CLOSED')).toBe(1);
    expect(stageIndex('NOMINATIONS_OPEN')).toBe(1);
    expect(stageIndex('DRAFT')).toBe(0);
    expect(stageIndex('VOTING_CLOSED')).toBe(2);
    expect(stageIndex('RESULTS_PUBLISHED')).toBe(3);
    expect(stageIndex('CANCELLED')).toBe(-1);
    expect(electionStatusKey('NOMINATIONS_CLOSED')).not.toBe(electionStatusKey('DRAFT'));
  });
});

describe('what can be changed when', () => {
  it('only a draft can be edited; candidates can be added before nominations close and decided until voting opens', () => {
    expect(canEditElection('DRAFT')).toBe(true);
    expect(canEditElection('NOMINATIONS_OPEN')).toBe(false);
    expect(canAddCandidates('NOMINATIONS_OPEN')).toBe(true);
    expect(canAddCandidates('NOMINATIONS_CLOSED')).toBe(false);
    expect(canDecideCandidates('NOMINATIONS_CLOSED')).toBe(true);
    expect(canDecideCandidates('VOTING_OPEN')).toBe(false);
  });

  it('an election can be cancelled until it is published, and deleted only when draft or cancelled with no votes', () => {
    expect(canCancelElection('VOTING_OPEN')).toBe(true);
    expect(canCancelElection('RESULTS_PUBLISHED')).toBe(false);
    expect(canDeleteElection({ status: 'DRAFT', _count: { votes: 0, candidates: 0 } })).toBe(true);
    expect(canDeleteElection({ status: 'CANCELLED', _count: { votes: 4, candidates: 2 } })).toBe(false);
    expect(canDeleteElection({ status: 'VOTING_OPEN', _count: { votes: 0, candidates: 2 } })).toBe(false);
  });

  it('a poll with answers is kept as a record', () => {
    expect(canDeletePoll({ status: 'CANCELLED', _count: { responses: 3 } })).toBe(false);
    expect(canDeletePoll({ status: 'DRAFT', _count: { responses: 0 } })).toBe(true);
  });
});

describe('deciding a nomination', () => {
  const nomination = { status: 'PENDING' as const, memberId: 7 };

  it("is open to someone else's waiting nomination, before voting opens", () => {
    expect(candidateGuard(nomination, 'NOMINATIONS_CLOSED', 3)).toBe('ok');
  });

  it("never to your own", () => {
    expect(candidateGuard(nomination, 'NOMINATIONS_OPEN', 7)).toBe('own');
  });

  it('not once it has been decided, or voting has opened', () => {
    expect(candidateGuard({ ...nomination, status: 'APPROVED' }, 'NOMINATIONS_OPEN', 3)).toBe('decided');
    expect(candidateGuard(nomination, 'VOTING_OPEN', 3)).toBe('locked');
  });
});

describe('words and numbers', () => {
  it('says what is stopping voting from opening', () => {
    expect(waitingNote(0)).toBeNull();
    expect(waitingNote(1)).toMatch('1 nomination is waiting');
    expect(waitingNote(3)).toMatch('3 nominations are waiting');
  });

  it('turnout is of the members who could vote', () => {
    expect(turnoutPercent(25, 100)).toBe(25);
    expect(turnoutPercent(1, 3)).toBe(33);
    expect(turnoutPercent(5, 0)).toBe(0);
  });
});
