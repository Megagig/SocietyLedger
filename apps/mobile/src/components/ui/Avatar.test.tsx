import { act, render, screen } from '@testing-library/react-native';

import { Avatar } from '@/components/ui/Avatar';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ chart: ['#0B5C53', '#B54708'], color: {} }),
}));

describe('Avatar', () => {
  it('shows initials when there is no photo', async () => {
    await render(<Avatar name="Anthony Obi" testID="av" />);
    expect(screen.getByText('AO')).toBeTruthy();
    expect(screen.queryByTestId('av-image')).toBeNull();
  });

  it('shows the photo instead of initials when it has one', async () => {
    await render(<Avatar name="Anthony Obi" imageUrl="https://files.example/photo.jpg" testID="av" />);
    expect(screen.getByTestId('av-image')).toBeTruthy();
    expect(screen.queryByText('AO')).toBeNull();
  });

  it('falls back to initials when the photo fails to load', async () => {
    await render(<Avatar name="Anthony Obi" imageUrl="https://files.example/expired.jpg" testID="av" />);
    await act(async () => {
      screen.getByTestId('av-image').props.onError({ nativeEvent: { error: 'expired' } });
    });
    expect(screen.getByText('AO')).toBeTruthy();
    expect(screen.queryByTestId('av-image')).toBeNull();
  });

  it('treats a null link as no photo', async () => {
    await render(<Avatar name="Ada Eze" imageUrl={null} testID="av" />);
    expect(screen.getByText('AE')).toBeTruthy();
  });
});
