import { fireEvent, render, screen } from '@testing-library/react-native';

import type { CandidateDTO, ElectionListItemDTO, PollListItemDTO } from '@/types/api/voting';
import { CandidateCard, ElectionRow, PollRow, ResultBar } from './Rows';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const candidate = (over: Partial<CandidateDTO> = {}): CandidateDTO => ({
  id: 7, electionId: 4, positionId: 10, memberId: 3, manifesto: 'I will keep the books open.', photoUrl: null, status: 'PENDING', nominatedBy: 50,
  nominatedAt: '2026-10-20T00:00:00.000Z', approvedBy: null, approvedAt: null, rejectionReason: null, withdrawnAt: null, withdrawalReason: null, voteCount: 0,
  member: { id: 3, memberId: 'M-003', firstName: 'Ada', lastName: 'Obi' }, position: { id: 10, title: 'Treasurer' }, ...over,
});

describe('CandidateCard', () => {
  it('shows who is standing and lets another committee member approve or reject while it is waiting', async () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    await render(<CandidateCard candidate={candidate()} guard="ok" onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('I will keep the books open.')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('candidate-approve-7'));
    expect(onApprove).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('candidate-reject-7'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('your own nomination shows why there are no buttons', async () => {
    await render(<CandidateCard candidate={candidate()} guard="own" onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(screen.getByText('This is your own nomination, so another member of the committee needs to decide it.')).toBeTruthy();
    expect(screen.queryByTestId('candidate-approve-7')).toBeNull();
  });

  it('a decided one has neither buttons nor a note, and a rejection shows its reason', async () => {
    await render(<CandidateCard candidate={candidate({ status: 'REJECTED', rejectionReason: 'Not in good standing' })} guard="decided" onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(screen.getByText('Not approved')).toBeTruthy();
    expect(screen.getByText('Reason: Not in good standing')).toBeTruthy();
    expect(screen.queryByTestId('candidate-approve-7')).toBeNull();
    expect(screen.queryByTestId('candidate-guard-7')).toBeNull();
  });

  it('names the position when the list mixes positions', async () => {
    await render(<CandidateCard candidate={candidate()} guard="decided" showPosition onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(screen.getByText('M-003 · Treasurer')).toBeTruthy();
  });
});

describe('ElectionRow', () => {
  const election = (over: Partial<ElectionListItemDTO> = {}): ElectionListItemDTO => ({
    id: 4, associationId: 1, title: '2027 executive election', description: null, electionType: 'EXECUTIVE', status: 'VOTING_OPEN', nominationStartDate: null,
    nominationEndDate: null, votingStartDate: '2027-01-10T09:00:00.000Z', votingEndDate: '2027-01-12T09:00:00.000Z', maxVotesPerMember: 1, allowAbstention: true,
    isAnonymous: true, requiresQuorum: false, quorumPercentage: null, eligibleVoterCount: 80, totalVotesCast: 20, createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z', positions: [{ id: 10, title: 'President' }, { id: 11, title: 'Secretary' }], _count: { votes: 40, candidates: 5 }, ...over,
  });

  it('shows what it is, where it stands, and turnout while voting is open', async () => {
    const onPress = jest.fn();
    const item = election();
    await render(<ElectionRow item={item} position="only" onPress={onPress} />);
    expect(screen.getByText('2027 executive election')).toBeTruthy();
    expect(screen.getByText('Voting open')).toBeTruthy();
    expect(screen.getByText('Executive committee · 2 positions · 5 candidates')).toBeTruthy();
    expect(screen.getByText('20 of 80 members have voted')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('election-row-4'));
    expect(onPress).toHaveBeenCalledWith(item);
  });

  it('shows no turnout before voting opens, and says when nominations are closed', async () => {
    await render(<ElectionRow item={election({ status: 'NOMINATIONS_CLOSED' })} position="only" />);
    expect(screen.getByText('Nominations closed')).toBeTruthy();
    expect(screen.queryByText(/have voted/)).toBeNull();
  });
});

describe('PollRow', () => {
  it('shows the question, how many have answered and where it stands', async () => {
    const poll: PollListItemDTO = {
      id: 5, associationId: 1, title: 'Which day should we meet?', description: null, pollType: 'SINGLE_CHOICE', status: 'ACTIVE', startDate: '2027-01-10T09:00:00.000Z',
      endDate: '2027-01-12T09:00:00.000Z', allowMultipleVotes: false, isAnonymous: true, createdAt: '2026-10-01T00:00:00.000Z', options: [{ id: 1, optionText: 'Sat' }, { id: 2, optionText: 'Sun' }],
      _count: { responses: 1 },
    };
    await render(<PollRow item={poll} position="only" />);
    expect(screen.getByText('Which day should we meet?')).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('2 answers · 1 answer so far')).toBeTruthy();
  });
});

describe('ResultBar', () => {
  const row = { candidateId: 1, memberId: 3, memberName: 'Ada Obi', voteCount: 12, votePercentage: 60 };

  it('marks the winner', async () => {
    await render(<ResultBar row={row} winner />);
    expect(screen.getByText('Winner')).toBeTruthy();
    expect(screen.getByText('12 votes · 60%')).toBeTruthy();
  });

  it('marks candidates who are level, and says one vote in the singular', async () => {
    await render(<ResultBar row={{ ...row, voteCount: 1, votePercentage: 50 }} tied />);
    expect(screen.getByText('Level')).toBeTruthy();
    expect(screen.queryByText('Winner')).toBeNull();
    expect(screen.getByText('1 vote · 50%')).toBeTruthy();
  });
});
