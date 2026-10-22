import { render, screen } from '@testing-library/react-native';

import { ThreadMessage } from './ThreadMessage';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/api/endpoints/support', () => ({ supportApi: {} }));

const props = { author: 'Ada Obi', message: 'Hello', createdAt: '2026-10-22T09:30:00.000Z' };

const alignmentOf = () => {
  const root = screen.getByTestId('bubble');
  return String(root.props.className);
};

describe('ThreadMessage perspective', () => {
  it("puts a member's own messages on the right on their screen, and support on the left", async () => {
    await render(<ThreadMessage {...props} fromStaff={false} testID="bubble" />);
    expect(alignmentOf()).toContain('items-end');
  });

  it("puts support's messages on the left on the member's screen", async () => {
    await render(<ThreadMessage {...props} fromStaff testID="bubble" />);
    expect(alignmentOf()).toContain('items-start');
  });

  it('flips it for staff: their own replies on the right, the member on the left', async () => {
    await render(<ThreadMessage {...props} fromStaff perspective="staff" testID="bubble" />);
    expect(alignmentOf()).toContain('items-end');
  });

  it('labels a staff-only note so it cannot be mistaken for a reply the member will see', async () => {
    await render(<ThreadMessage {...props} fromStaff perspective="staff" internal testID="bubble" />);

    expect(screen.getByText('Ada Obi · internal note')).toBeTruthy();
  });
});
