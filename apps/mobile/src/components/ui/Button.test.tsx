import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components/ui/Button';

// Only Spinner (rendered while `loading`) reads theme tokens — mock the provider so these
// stay true unit tests of Button's own logic, not an integration test of ThemeProvider/fonts.
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({
    color: { primary: '#0B5C53', textInverse: '#FFFFFF', textSecondary: '#5E706C', danger: '#B42318' },
  }),
}));

describe('Button', () => {
  it('renders its label', async () => {
    await render(<Button onPress={() => {}}>Pay ₦25,000</Button>);
    expect(screen.getByText('Pay ₦25,000')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<Button onPress={onPress}>Submit proof</Button>);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(
      <Button onPress={onPress} disabled>
        Submit proof
      </Button>,
    );
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress while loading, and marks accessibilityState.busy', async () => {
    const onPress = jest.fn();
    await render(
      <Button onPress={onPress} loading>
        Submit proof
      </Button>,
    );
    const button = screen.getByRole('button');
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('falls back to the label as its accessibility label when none is given', async () => {
    await render(<Button onPress={() => {}}>Verify payment</Button>);
    expect(screen.getByLabelText('Verify payment')).toBeTruthy();
  });

  it('respects an explicit accessibilityLabel override', async () => {
    await render(
      <Button onPress={() => {}} accessibilityLabel="Custom label">
        Verify payment
      </Button>,
    );
    expect(screen.getByLabelText('Custom label')).toBeTruthy();
  });
});
