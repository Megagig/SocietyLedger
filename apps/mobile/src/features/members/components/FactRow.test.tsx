import { render, screen } from '@testing-library/react-native';

import { FactRow } from './FactRow';

describe('FactRow', () => {
  it('shows the label and its value', async () => {
    await render(<FactRow label="Phone" value="0803 123 4567" />);

    expect(screen.getByText('Phone')).toBeTruthy();
    expect(screen.getByText('0803 123 4567')).toBeTruthy();
  });

  it('shows a dash for a missing or blank value', async () => {
    await render(
      <>
        <FactRow label="Email" value={null} />
        <FactRow label="Notes" value="   " />
      </>,
    );

    expect(screen.getAllByText('–')).toHaveLength(2);
  });

  it('formats an amount as naira', async () => {
    await render(<FactRow label="Total savings" amount="125000" />);

    expect(screen.getByText('₦125,000.00')).toBeTruthy();
  });
});
