import { render, screen } from '@testing-library/react-native';

import type { TicketDTO } from '@/types/api/support';
import { TicketRow } from './TicketRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const ticket: TicketDTO = {
  id: 1,
  ticketNumber: 'TKT-20261022-0001',
  subject: 'My payment is missing',
  description: 'Paid on Monday',
  category: 'PAYMENTS',
  priority: 'MEDIUM',
  status: 'WAITING_ON_STAFF',
  resolvedAt: null,
  closedAt: null,
  createdAt: '2026-10-22T09:00:00.000Z',
  updatedAt: '2026-10-22T09:30:00.000Z',
  user: { id: 7, email: 'ada@example.com', member: { firstName: 'Ada', lastName: 'Obi' } },
};

describe('TicketRow for staff', () => {
  it('shows who opened it and the status from the staff side', async () => {
    await render(<TicketRow ticket={ticket} staffView onPress={() => undefined} />);

    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('Needs reply')).toBeTruthy();
  });

  it('falls back to the email when the opener has no member profile', async () => {
    await render(<TicketRow ticket={{ ...ticket, user: { id: 7, email: 'ada@example.com', member: null } }} staffView onPress={() => undefined} />);

    expect(screen.getByText('ada@example.com')).toBeTruthy();
  });

  it("keeps the member's wording on the member's own list", async () => {
    await render(<TicketRow ticket={ticket} onPress={() => undefined} />);

    expect(screen.getByText('Waiting on support')).toBeTruthy();
    expect(screen.queryByText('Ada Obi')).toBeNull();
  });
});
