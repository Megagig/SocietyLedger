/* eslint-disable @typescript-eslint/no-require-imports -- a jest.mock factory can only use require() */
import { render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';

import { PasswordField } from './PasswordField';

// A password asked for inside a bottom sheet (approve an expense, post an entry, void) must use the sheet's own input, or the keyboard covers it.
let mockInsideSheet = false;
jest.mock('@gorhom/bottom-sheet', () => {
  const { TextInput } = require('react-native');
  return {
    useBottomSheetInternal: () => (mockInsideSheet ? {} : null),
    BottomSheetTextInput: (props: object) => <TextInput {...props} accessibilityLabel="sheet-input" />,
  };
});
jest.mock('@/providers/ThemeProvider', () => ({ useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }) }) }));
jest.mock('@/components/ui/IconButton', () => {
  const { Pressable } = require('react-native');
  return { IconButton: ({ accessibilityLabel }: { accessibilityLabel: string }) => <Pressable accessibilityLabel={accessibilityLabel} /> };
});

function Harness() {
  const { control } = useForm<{ password: string }>({ defaultValues: { password: '' } });
  return <PasswordField control={control} name="password" label="Your password" testID="pw" />;
}

describe('the password field', () => {
  it('is the sheet’s own input inside a bottom sheet, so the sheet rises above the keyboard', async () => {
    mockInsideSheet = true;
    await render(<Harness />);
    expect(screen.getByLabelText('sheet-input')).toBeTruthy();
    expect(screen.getByTestId('pw').props.secureTextEntry).toBe(true);
  });

  it('is an ordinary input anywhere else', async () => {
    mockInsideSheet = false;
    await render(<Harness />);
    expect(screen.queryByLabelText('sheet-input')).toBeNull();
    expect(screen.getByTestId('pw')).toBeTruthy();
  });
});
