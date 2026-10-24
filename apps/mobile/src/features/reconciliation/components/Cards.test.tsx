import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ReconciliationDTO, SuggestionDTO } from '@/types/api/reconciliation';
import { MatchCard, SuggestionCard } from './Cards';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const suggestion: SuggestionDTO = {
  source: 'entry',
  statementEntryId: 21,
  bankTransferId: null,
  line: { amount: '10000.00', date: '2026-10-05T00:00:00Z', reference: 'S1', description: 'TRF FROM ADA OBI' },
  transactionId: 8,
  charge: { referenceNumber: 'DUE-1', categoryName: 'Monthly dues', memberId: 1, memberNumber: 'M-1', memberName: 'Ada Obi', amount: '10000.00', available: '10000.00', dueDate: null },
  confidence: 100,
  matchType: 'AUTO_REFERENCE',
  reasons: ['Its reference is in the narration', 'The amount is exactly what is owed'],
  recommended: true,
};

const match = (over: Partial<ReconciliationDTO> = {}): ReconciliationDTO => ({
  id: 3,
  status: 'PENDING',
  matchType: 'AUTO_REFERENCE',
  matchedAmount: '10000.00',
  createdAt: '2026-10-05T00:00:00Z',
  reconciledAt: null,
  createdBy: 9,
  notes: null,
  transaction: { id: 8, referenceNumber: 'DUE-1', amount: '10000', member: { id: 1, memberId: 'M-1', firstName: 'Ada', lastName: 'Obi' }, category: { id: 1, name: 'Monthly dues', type: 'due' } },
  statementEntry: { id: 21, transactionDate: '2026-10-05T00:00:00Z', reference: 'S1', description: 'TRF FROM ADA OBI', creditAmount: '10000' },
  bankTransfers: [],
  ...over,
});

describe('SuggestionCard', () => {
  it('shows the line, the charge it would pay, how sure it is and why, and toggles when tapped', async () => {
    const onToggle = jest.fn();
    await render(<SuggestionCard item={suggestion} selected onToggle={onToggle} />);
    expect(screen.getAllByText('₦10,000.00')).toHaveLength(2); // the money received, and what the charge still owes
    expect(screen.getByText('TRF FROM ADA OBI')).toBeTruthy();
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText(/Very likely/)).toBeTruthy();
    expect(screen.getByText(/reference is in the narration/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('suggestion-21-8'));
    expect(onToggle).toHaveBeenCalledWith(suggestion);
  });
});

describe('MatchCard', () => {
  it('lets another officer confirm or turn down a waiting match', async () => {
    const onConfirm = jest.fn();
    const onDispute = jest.fn();
    await render(<MatchCard item={match()} mine={false} busy={false} onConfirm={onConfirm} onDispute={onDispute} />);
    await fireEvent.press(screen.getByTestId('match-3-confirm'));
    await fireEvent.press(screen.getByTestId('match-3-dispute'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDispute).toHaveBeenCalledTimes(1);
  });

  it('a match you proposed can only be turned down, and says why', async () => {
    await render(<MatchCard item={match()} mine busy={false} onConfirm={jest.fn()} onDispute={jest.fn()} />);
    expect(screen.queryByTestId('match-3-confirm')).toBeNull();
    expect(screen.getByTestId('match-3-dispute')).toBeTruthy();
    expect(screen.getByText(/another officer has to confirm/)).toBeTruthy();
  });

  it('a decided match has no actions', async () => {
    await render(<MatchCard item={match({ status: 'CONFIRMED' })} mine={false} busy={false} onConfirm={jest.fn()} onDispute={jest.fn()} />);
    expect(screen.queryByTestId('match-3-confirm')).toBeNull();
    expect(screen.queryByTestId('match-3-dispute')).toBeNull();
    expect(screen.getByText('Confirmed')).toBeTruthy();
  });
});
