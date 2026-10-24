import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { CandidateDTO, ElectionDetailDTO } from '@/types/api/voting';
import ElectionControlScreen from '../../../app/(app)/(tabs)/manage/elections/[id]';

// The committee runs an election from here: one step at a time, only the people allowed to take it, and nobody decides their own nomination.
let mockElection: ElectionDetailDTO | undefined;
let mockCan: Set<string>;
let mockOwnMemberId: number | undefined;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({ id: '4' }) }));
jest.mock('@/hooks/useModuleAccess', () => ({ useModuleAccess: () => true }));
jest.mock('@/hooks/useCan', () => ({ useCan: (alias: string) => mockCan.has(alias) }));
jest.mock('@/hooks/useMemberId', () => ({ useMemberId: () => mockOwnMemberId }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/feedback/ConfirmSheet', () => ({ ConfirmSheet: () => null }));
jest.mock('@/features/coopManage/components/ReasonSheet', () => ({ ReasonSheet: () => null }));
jest.mock('@/features/electionsManage/components/Sheets', () => ({ CandidateSheet: () => null, PositionSheet: () => null }));
jest.mock('@/features/voting/queries', () => ({
  useElectionDetail: () => ({ data: mockElection, isPending: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() }),
}));
jest.mock('@/features/electionsManage/queries', () => ({ VOTING_MODULE: 'voting' }));
const idle = () => ({ mutate: jest.fn(), isPending: false, variables: undefined });
jest.mock('@/features/electionsManage/mutations', () => ({
  useCancelElection: () => idle(),
  useAddPosition: () => idle(),
  useDecideCandidate: () => idle(),
  useDeleteElection: () => idle(),
  useDeletePosition: () => idle(),
  useElectionStep: () => idle(),
  useRegisterCandidate: () => idle(),
  useUpdatePosition: () => idle(),
}));

const candidate = (over: Partial<CandidateDTO> = {}): CandidateDTO => ({
  id: 7, electionId: 4, positionId: 10, memberId: 3, manifesto: null, photoUrl: null, status: 'PENDING', nominatedBy: 50, nominatedAt: '2026-10-20T00:00:00.000Z',
  approvedBy: null, approvedAt: null, rejectionReason: null, withdrawnAt: null, withdrawalReason: null, voteCount: 0,
  member: { id: 3, memberId: 'M-003', firstName: 'Ada', lastName: 'Obi' }, position: { id: 10, title: 'Treasurer' }, ...over,
});

const election = (over: Partial<ElectionDetailDTO> = {}): ElectionDetailDTO => ({
  id: 4, associationId: 1, title: '2027 executive election', description: null, electionType: 'EXECUTIVE', status: 'NOMINATIONS_CLOSED', nominationStartDate: null,
  nominationEndDate: null, votingStartDate: '2027-01-10T09:00:00.000Z', votingEndDate: '2027-01-12T09:00:00.000Z', maxVotesPerMember: 1, allowAbstention: true,
  isAnonymous: true, requiresQuorum: false, quorumPercentage: null, eligibleVoterCount: 80, totalVotesCast: 0, createdBy: 1, publishedBy: null, publishedAt: null,
  cancelledBy: null, cancelledAt: null, cancellationReason: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  positions: [{ id: 10, electionId: 4, title: 'Treasurer', description: null, maxCandidates: 1, orderNumber: 0, candidates: [] }],
  candidates: [candidate()], creator: { id: 1, email: 'a@b.com' }, _count: { votes: 0, candidates: 1 }, ...over,
});

beforeEach(() => {
  mockElection = election();
  mockCan = new Set(['ELECTION_MANAGE', 'ELECTION_CANDIDATES', 'ELECTION_RUN', 'ELECTION_RESULTS_VIEW', 'ELECTION_RESULTS_PUBLISH']);
  mockOwnMemberId = undefined;
});

describe('Election control', () => {
  it("shows where the election stands and lets another committee member approve or reject a waiting nomination", async () => {
    await render(<ElectionControlScreen />);
    expect(screen.getByText('2027 executive election')).toBeTruthy();
    expect(screen.getByText('Nominations closed')).toBeTruthy();
    expect(screen.getByTestId('candidate-approve-7')).toBeTruthy();
    expect(screen.getByTestId('candidate-reject-7')).toBeTruthy();
  });

  it('voting cannot be opened while a nomination is waiting, and the screen says why', async () => {
    await render(<ElectionControlScreen />);
    expect(screen.getByTestId('election-waiting')).toBeTruthy();
    expect(screen.getByTestId('election-step').props.accessibilityState.disabled).toBe(true);
  });

  it("your own nomination can't be decided by you", async () => {
    mockOwnMemberId = 3;
    await render(<ElectionControlScreen />);
    expect(screen.getByTestId('candidate-guard-7')).toBeTruthy();
    expect(screen.queryByTestId('candidate-approve-7')).toBeNull();
  });

  it('a member of the committee without the candidates permission sees no approve or reject', async () => {
    mockCan = new Set(['ELECTION_RUN']);
    await render(<ElectionControlScreen />);
    expect(screen.queryByTestId('candidate-approve-7')).toBeNull();
    expect(screen.queryByTestId('add-candidate-10')).toBeNull();
    expect(screen.queryByTestId('election-cancel')).toBeNull();
  });

  it('the step button is only for the people allowed to take it', async () => {
    mockCan = new Set(['ELECTION_CANDIDATES']);
    await render(<ElectionControlScreen />);
    expect(screen.queryByTestId('election-step')).toBeNull();
  });

  it('a draft with an approved candidate can skip straight to voting', async () => {
    mockElection = election({ status: 'DRAFT', candidates: [candidate({ status: 'APPROVED' })] });
    await render(<ElectionControlScreen />);
    expect(screen.getByTestId('election-open-now')).toBeTruthy();
    expect(screen.getByTestId('election-step')).toBeTruthy();
    expect(screen.getByTestId('edit-position-10')).toBeTruthy();
  });

  it('once voting has closed, the committee can read the results and the publisher can publish them', async () => {
    mockElection = election({ status: 'VOTING_CLOSED', totalVotesCast: 40, candidates: [candidate({ status: 'APPROVED' })] });
    await render(<ElectionControlScreen />);
    expect(screen.getByTestId('election-results')).toBeTruthy();
    expect(screen.getByTestId('election-voted')).toBeTruthy();
    expect(screen.getByText('Publish results')).toBeTruthy();
  });

  it("a member who can run the vote but not publish or see results sees neither", async () => {
    mockElection = election({ status: 'VOTING_CLOSED', candidates: [candidate({ status: 'APPROVED' })] });
    mockCan = new Set(['ELECTION_RUN']);
    await render(<ElectionControlScreen />);
    expect(screen.queryByTestId('election-results')).toBeNull();
    expect(screen.queryByTestId('election-step')).toBeNull();
  });

  it('a cancelled election shows why, and has no step', async () => {
    mockElection = election({ status: 'CANCELLED', cancellationReason: 'The venue fell through' });
    await render(<ElectionControlScreen />);
    expect(screen.getByText('The venue fell through')).toBeTruthy();
    expect(screen.queryByTestId('election-step')).toBeNull();
    expect(screen.queryByTestId('election-cancel')).toBeNull();
  });
});
