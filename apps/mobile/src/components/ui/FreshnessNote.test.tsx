import { render, screen } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';

import { FreshnessNote } from '@/components/ui/FreshnessNote';

afterEach(() => onlineManager.setOnline(true));

describe('FreshnessNote', () => {
  it('draws nothing when the data is fresh, or when there is none yet', async () => {
    await render(<FreshnessNote query={{ isFetching: false, data: [1], dataUpdatedAt: Date.now() }} />);
    expect(screen.queryByTestId('freshness-note')).toBeNull();
    await render(<FreshnessNote query={{ isFetching: true, data: undefined, dataUpdatedAt: 0 }} />);
    expect(screen.queryByTestId('freshness-note')).toBeNull();
  });

  it('says it is updating while saved data is on screen and the server is being asked', async () => {
    await render(<FreshnessNote query={{ isFetching: true, data: [1], dataUpdatedAt: Date.now() }} />);
    expect(screen.getByText('Updating…')).toBeTruthy();
  });

  it('says it is offline, with the time it was last updated', async () => {
    onlineManager.setOnline(false);
    await render(<FreshnessNote query={{ isFetching: false, data: [1], dataUpdatedAt: new Date(2027, 0, 5, 10, 42).getTime() }} />);
    expect(screen.getByText('Offline · last updated 10:42')).toBeTruthy();
  });
});
