import { render, screen } from '@testing-library/react-native';

import { ThreadMessage } from './ThreadMessage';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

// Opening a file goes through the API client (and its native storage) — not what these tests are about.
jest.mock('@/api/endpoints/support', () => ({ supportApi: {} }));

describe('ThreadMessage', () => {
  it('shows who wrote it and the message', async () => {
    await render(<ThreadMessage author="Support team" message="We found your payment." createdAt="2026-10-22T09:30:00.000Z" fromStaff />);

    expect(screen.getByText('Support team')).toBeTruthy();
    expect(screen.getByText('We found your payment.')).toBeTruthy();
  });

  it('lists attached files on the message', async () => {
    await render(
      <ThreadMessage
        author="You"
        message="Here is the receipt."
        createdAt="2026-10-22T09:30:00.000Z"
        fromStaff={false}
        attachments={[{ id: 4, ticketId: 1, responseId: null, originalName: 'receipt.png', mimeType: 'image/png', fileSize: 2048, createdAt: '2026-10-22T09:30:00.000Z' }]}
      />,
    );

    expect(screen.getByText('receipt.png')).toBeTruthy();
    expect(screen.getByText('2 KB')).toBeTruthy();
  });
});
