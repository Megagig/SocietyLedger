import { render, screen } from '@testing-library/react-native';

import type { ElectionProgressDTO } from '@/types/api/voting';
import { TurnoutCard } from './TurnoutCard';

let mockProgress: { data?: ElectionProgressDTO; isPending: boolean; isError: boolean };

jest.mock('react-native-gifted-charts', () => ({ LineChart: () => null }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('../queries', () => ({ useElectionProgress: () => mockProgress }));

const progress = (over: Partial<ElectionProgressDTO> = {}): ElectionProgressDTO => ({
  electionId: 4, title: 'AGM', status: 'VOTING_OPEN', votingStartDate: '2027-01-10T09:00:00.000Z', votingEndDate: '2027-01-12T09:00:00.000Z', eligible: 80, voted: 20,
  turnoutPercent: 25, requiresQuorum: true, quorumPercentage: 50, quorumMet: false, positions: [{ positionId: 10, title: 'President', voted: 18 }],
  timeline: [{ at: '2027-01-10T09:00:00.000Z', voted: 0 }, { at: '2027-01-10T12:00:00.000Z', voted: 20 }], updatedAt: '2027-01-10T12:00:00.000Z', ...over,
});

beforeEach(() => {
  mockProgress = { data: progress(), isPending: false, isError: false };
});

describe('TurnoutCard', () => {
  it('shows how many have voted, the turnout, the minimum still needed, and that it is live', async () => {
    await render(<TurnoutCard electionId={4} />);
    expect(screen.getByText('20 of 80')).toBeTruthy();
    expect(screen.getByText('members have voted · 25% turnout · 50% needed')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByTestId('turnout-chart-4')).toBeTruthy();
  });

  it('shows participation on each position, and never a candidate', async () => {
    await render(<TurnoutCard electionId={4} />);
    expect(screen.getByText('President')).toBeTruthy();
    expect(screen.getByText('18 of 80')).toBeTruthy();
  });

  it('says when the minimum is met, and is no longer live once voting has closed', async () => {
    mockProgress = { data: progress({ status: 'VOTING_CLOSED', voted: 50, turnoutPercent: 63, quorumMet: true }), isPending: false, isError: false };
    await render(<TurnoutCard electionId={4} />);
    expect(screen.getByText('members have voted · 63% turnout · 50% minimum met')).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
  });

  it('the compact version is the count and the bar only', async () => {
    await render(<TurnoutCard electionId={4} compact />);
    expect(screen.getByText('20 of 80')).toBeTruthy();
    expect(screen.queryByTestId('turnout-chart-4')).toBeNull();
    expect(screen.queryByText('President')).toBeNull();
  });

  it('shows nothing when the turnout could not be loaded', async () => {
    mockProgress = { data: undefined, isPending: false, isError: true };
    await render(<TurnoutCard electionId={4} />);
    expect(screen.queryByTestId('turnout-4')).toBeNull();
  });
});
