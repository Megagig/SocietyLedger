import { fireEvent, render, screen } from '@testing-library/react-native';

import type { CampaignListItemDTO, CategoryDTO } from '@/types/api/financeSetup';
import { CampaignRow } from './CampaignRow';
import { CategoryRow } from './CategoryRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const category = (over: Partial<CategoryDTO> = {}): CategoryDTO => ({
  id: 5, name: 'Monthly dues', type: 'due', amount: '5000', frequency: 'monthly', description: null, isActive: true, usageCount: 12, ...over,
});

const campaign = (over: Partial<CampaignListItemDTO> = {}): CampaignListItemDTO => ({
  id: 8, name: 'Building fund', description: null, targetAmount: '500000', amountPerMember: '10000', deadline: '2099-01-01T00:00:00.000Z',
  status: 'ACTIVE', category: { id: 4, name: 'Building levy' },
  progress: { totalAssigned: 100000, totalCollected: 40000, remaining: 460000, stillOwed: 60000, progressPercentage: 8, assignedMembers: 10, paidCount: 4 },
  ...over,
});

describe('CategoryRow', () => {
  it('shows the name, kind, default amount, frequency and use, and opens on press', async () => {
    const onPress = jest.fn();
    const row = category();
    await render(<CategoryRow category={row} position="only" onPress={onPress} />);
    expect(screen.getByText('Monthly dues')).toBeTruthy();
    expect(screen.getByText('Due')).toBeTruthy();
    expect(screen.getByText(/· Monthly$/)).toBeTruthy();
    expect(screen.getByText('Used by 12 charges and campaigns')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('category-row-5'));
    expect(onPress).toHaveBeenCalledWith(row);
  });

  it('marks a switched-off category and says when there is no default amount', async () => {
    await render(<CategoryRow category={category({ isActive: false, amount: null, frequency: null, usageCount: 0 })} position="only" />);
    expect(screen.getByText('Inactive')).toBeTruthy();
    expect(screen.getByText('No default amount')).toBeTruthy();
    expect(screen.getByText('Not used yet')).toBeTruthy();
  });
});

describe('CampaignRow', () => {
  it('shows the status, what is collected and who has paid, and opens on press', async () => {
    const onPress = jest.fn();
    const row = campaign();
    await render(<CampaignRow campaign={row} position="only" onPress={onPress} />);
    expect(screen.getByText('Building fund')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText(/4\/10 paid/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('campaign-row-8'));
    expect(onPress).toHaveBeenCalledWith(row);
  });

  it('a closed campaign shows its deadline date rather than a countdown', async () => {
    await render(<CampaignRow campaign={campaign({ status: 'CLOSED' })} position="only" onPress={jest.fn()} />);
    expect(screen.getByText('Closed')).toBeTruthy();
    expect(screen.getByText(/Deadline /)).toBeTruthy();
  });
});
