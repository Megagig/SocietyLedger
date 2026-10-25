import { render, screen } from '@testing-library/react-native';

import { StatusChip, getStatusTone } from '@/components/ui/StatusChip';

describe('StatusChip', () => {
  it('shows the humanized status text by default', async () => {
    await render(<StatusChip status="under_review" />);
    expect(screen.getByText('Under review')).toBeTruthy();
  });

  it('shows a custom label when provided, while still looking up tone from status', async () => {
    await render(<StatusChip status="overdue" label="2 overdue" />);
    expect(screen.getByText('2 overdue')).toBeTruthy();
  });

  it.each([
    ['paid', 'success'],
    ['pending', 'warning'],
    ['overdue', 'danger'],
    ['draft', 'neutral'],
    ['scheduled', 'info'],
  ] as const)('maps status "%s" to tone "%s" (ui-tokens.md §1.4)', (status, tone) => {
    expect(getStatusTone(status)).toBe(tone);
  });

  it('is case-insensitive', () => {
    expect(getStatusTone('OVERDUE')).toBe('danger');
  });

  it('falls back to neutral for an unmapped status rather than throwing', () => {
    expect(getStatusTone('some_future_status')).toBe('neutral');
  });
});
