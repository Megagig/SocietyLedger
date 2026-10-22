import { render, screen } from '@testing-library/react-native';

import type { TicketDTO } from '@/types/api/support';
import { TicketRow } from './TicketRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const ticket = (overrides: Partial<TicketDTO> = {}): TicketDTO => ({
  id: 1,
  ticketNumber: 'TKT-20261022-0001',
  subject: 'My payment is missing',
  description: 'Paid on Monday',
  category: 'PAYMENTS',
  priority: 'MEDIUM',
  status: 'WAITING_ON_USER',
  resolvedAt: null,
  closedAt: null,
  createdAt: '2026-10-22T09:00:00.000Z',
  updatedAt: '2026-10-22T09:30:00.000Z',
  ...overrides,
});

describe('TicketRow', () => {
  it("shows the number, subject, category and the status from the member's side", async () => {
    await render(<TicketRow ticket={ticket()} onPress={() => undefined} />);

    expect(screen.getByText('TKT-20261022-0001')).toBeTruthy();
    expect(screen.getByText('My payment is missing')).toBeTruthy();
    expect(screen.getByText('Payments')).toBeTruthy();
    expect(screen.getByText('Waiting on you')).toBeTruthy();
  });
});
