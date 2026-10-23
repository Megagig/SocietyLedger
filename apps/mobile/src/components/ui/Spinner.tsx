import { ActivityIndicator } from 'react-native';

import { useThemeTokens } from '@/providers/ThemeProvider';

/** `onDark` is always light — for a spinner on an always-dark surface (image viewer backdrop); `inverse` flips to dark in dark mode. */
export type SpinnerTone = 'primary' | 'inverse' | 'secondary' | 'danger' | 'onDark';
export type SpinnerSize = 'sm' | 'lg';

export type SpinnerProps = {
  tone?: SpinnerTone;
  size?: SpinnerSize;
};

// ActivityIndicator needs a resolved colour, not a className — the one place a token value
// must be read in JS rather than via NativeWind (ui-registry.md's F1.2 "theme & design tokens" convention).
export function Spinner({ tone = 'primary', size = 'sm' }: SpinnerProps) {
  const { color } = useThemeTokens();

  const resolvedColor = {
    primary: color.primary,
    inverse: color.textInverse,
    secondary: color.textSecondary,
    danger: color.danger,
    onDark: color.onPassbook,
  }[tone];

  return <ActivityIndicator size={size === 'lg' ? 'large' : 'small'} color={resolvedColor} />;
}
