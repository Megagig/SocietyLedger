import { render, screen } from '@testing-library/react-native';

import { Money } from '@/components/ui/Money';

// Formatting edge cases (negative/credit, decimal precision) are covered by
// `lib/money.test.ts` (F1.6) — these tests only check the component renders the result.
describe('Money component', () => {
  it('renders the formatted amount as text', async () => {
    await render(<Money value={25000} />);
    expect(screen.getByText('₦25,000.00')).toBeTruthy();
  });

  it('always writes the full amount, never 1.2m', async () => {
    await render(<Money value={1200000} size="num-lg" />);
    expect(screen.getByText('₦1,200,000.00')).toBeTruthy();
  });
});
