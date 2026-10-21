import { useId } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { cn } from '@/lib/cn';
import { Spinner, type SpinnerTone } from '@/components/ui/Spinner';
import { Text, type TextTone } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'soft'
  | 'ghost'
  | 'danger'
  | 'danger-ghost'
  | 'onPassbook'
  | 'gradient'
  | 'accent-ghost';
export type ButtonSize = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  children: string;
  accessibilityLabel?: string;
  testID?: string;
};

// ui-rules.md §5.2 — container classes per variant. onPassbook reuses the passbook tokens
// (white fill, passbook-green text) rather than a hardcoded hex, since ui-tokens.md §1.3
// defines `on-passbook` as literal white specifically so this variant never needs one.
const CONTAINER_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:bg-primary-pressed',
  secondary: 'bg-surface border border-border-strong',
  soft: 'bg-primary-soft',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
  'danger-ghost': 'bg-transparent',
  onPassbook: 'bg-on-passbook',
  // Fill comes from the SVG gradient layer below; the radius is set as a style value (see SIZE_CLASSES).
  gradient: 'bg-transparent overflow-hidden',
  'accent-ghost': 'bg-transparent',
};

const LABEL_TONE: Record<ButtonVariant, TextTone> = {
  primary: 'inverse',
  secondary: 'default',
  soft: 'onPrimarySoft',
  ghost: 'primary',
  danger: 'inverse',
  'danger-ghost': 'danger',
  onPassbook: 'default', // overridden to the passbook colour via SPINNER_TONE/labelClassName below
  gradient: 'onCtaGradient',
  'accent-ghost': 'accentText',
};

const SPINNER_TONE: Record<ButtonVariant, SpinnerTone> = {
  primary: 'inverse',
  secondary: 'primary',
  soft: 'primary',
  ghost: 'primary',
  danger: 'inverse',
  'danger-ghost': 'danger',
  onPassbook: 'primary',
  gradient: 'primary',
  'accent-ghost': 'primary',
};

// `radius` is half the container height — the exact pill. It is applied as a style value rather
// than a class because an SVG `rect` clamps `rx` to half the *width*, so a shared "fully round"
// value turns a wide button into an ellipse instead of a pill.
const SIZE_CLASSES: Record<ButtonSize, { container: string; textVariant: 'body-lg' | 'body'; radius: number }> = {
  lg: { container: 'h-[54px] px-6 rounded-xl', textVariant: 'body-lg', radius: 27 },
  md: { container: 'h-11 px-4', textVariant: 'body', radius: 22 },
  sm: { container: 'h-9 px-3', textVariant: 'body', radius: 18 },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  onPress,
  children,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const sizeConfig = SIZE_CLASSES[size];
  const { color } = useThemeTokens();
  // Unique per instance — SVG gradient ids are global, so two gradient Buttons on one screen
  // would otherwise share (and fight over) the same definition.
  const gradientId = `btn-gradient-${useId()}`;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      style={({ pressed }) => ({
        transform: [{ scale: pressed && !isDisabled ? 0.97 : 1 }],
        ...(variant === 'gradient' ? { borderRadius: sizeConfig.radius } : null),
      })}
      className={cn(
        'flex-row items-center justify-center rounded-md',
        CONTAINER_CLASSES[variant],
        sizeConfig.container,
        // Must come after sizeConfig to win the padding. RN places an absolutely positioned child
        // against the parent's *padding* box, so any horizontal padding here would insets the
        // gradient layer below — leaving the button's ends unpainted and visually off-centre.
        // The label carries the padding instead.
        variant === 'gradient' && 'px-0',
        // w-full handles row-layout parents (StickyFooter etc.) via explicit 100% width;
        // self-stretch handles column-layout parents where Yoga's percentage-width calculation
        // can drift next to horizontal ScrollViews on Android. Together they cover both cases.
        fullWidth ? 'w-full self-stretch' : 'self-auto',
        isDisabled && !loading && 'opacity-40',
      )}
    >
      {variant === 'gradient' ? (
        <Svg width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={color.ctaGradientFrom} />
              <Stop offset="0.5" stopColor={color.accent} />
              <Stop offset="1" stopColor={color.ctaGradientTo} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={sizeConfig.radius} fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
      <View className={cn(loading ? 'opacity-0' : 'opacity-100', variant === 'gradient' && 'px-6')}>
        <Text
          variant={sizeConfig.textVariant}
          tone={LABEL_TONE[variant]}
          className={cn('font-semibold', variant === 'onPassbook' && 'text-passbook')}
          // Inline style beats NativeWind class order — avoids text-text (white) winning
          // over text-passbook (dark green) on the white onPassbook background.
          style={variant === 'onPassbook' ? { color: color.passbook } : undefined}
          numberOfLines={1}
        >
          {children}
        </Text>
      </View>
      {loading ? (
        <View className="absolute inset-0 items-center justify-center">
          <Spinner tone={SPINNER_TONE[variant]} />
        </View>
      ) : null}
    </Pressable>
  );
}
