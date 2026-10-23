import { fireEvent, render, screen } from '@testing-library/react-native';
import type { UseQueryResult } from '@tanstack/react-query';

import type { AttentionItemDTO } from '@/api/endpoints/dashboard';
import { NeedsAttentionList } from './NeedsAttentionList';

const mockPush = jest.fn();
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const query = (over: Partial<UseQueryResult<AttentionItemDTO[], unknown>>) => over as UseQueryResult<AttentionItemDTO[], unknown>;

beforeEach(() => jest.clearAllMocks());

describe('NeedsAttentionList', () => {
  it('lists each waiting queue and opens it when tapped', async () => {
    await render(
      <NeedsAttentionList
        attentionQuery={query({ isLoading: false, isError: false, data: [{ key: 'paymentProofs', count: 3 }, { key: 'overdueCharges', count: 1 }] })}
      />,
    );
    expect(screen.getByText('3 payment proofs to verify')).toBeTruthy();
    expect(screen.getByText('1 charge overdue')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('attention-paymentProofs'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/manage/payments/proofs');
  });

  it('says so when nothing is waiting', async () => {
    await render(<NeedsAttentionList attentionQuery={query({ isLoading: false, isError: false, data: [] })} />);
    expect(screen.getByTestId('attention-clear')).toBeTruthy();
  });

  it('shows no false "all clear" when the list could not be loaded', async () => {
    await render(<NeedsAttentionList attentionQuery={query({ isLoading: false, isError: true, data: undefined })} />);
    expect(screen.queryByTestId('attention-clear')).toBeNull();
    expect(screen.queryByText('Needs your attention')).toBeNull();
  });
});
