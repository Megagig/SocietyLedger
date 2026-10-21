import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { cn } from '@/lib/cn';

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body-lg'
  | 'body'
  | 'body-strong'
  | 'label'
  | 'caption'
  | 'micro'
  | 'num-lg'
  | 'num';

export type TextTone =
  | 'default'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'primary'
  | 'onPrimarySoft'
  | 'accent'
  | 'accentText'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'onPassbook'
  | 'onPassbookMuted'
  | 'onCtaGradient';

export type TextProps = {
  variant?: TextVariant;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
  className?: string;
  children?: RNTextProps['children'];
  numberOfLines?: number;
  maxFontSizeMultiplier?: number;
  /** Escape hatch for genuinely dynamic values (Avatar's data-derived colour, Money's forced tabular figures) — code-standards.md §5 allows `style` only for these, never for a static design colour (use `tone` instead). */
  style?: TextStyle;
} & Pick<RNTextProps, 'accessibilityLabel' | 'testID'>;

// ui-tokens.md §2 — size/weight pairing per variant. `num` reuses `body`'s size at 400 weight
// but forces tabular figures (see the tabularStyle below), per ui-tokens.md §2's own rule.
const VARIANT_CLASSES: Record<TextVariant, string> = {
  display: 'text-display font-extrabold',
  h1: 'text-h1 font-bold',
  h2: 'text-h2 font-bold',
  h3: 'text-h3 font-semibold',
  'body-lg': 'text-body-lg font-sans',
  body: 'text-body font-regular',
  'body-strong': 'text-body font-semibold',
  label: 'text-label font-semibold',
  caption: 'text-caption font-sans',
  micro: 'text-micro font-semibold',
  'num-lg': 'text-num-lg font-bold',
  num: 'text-body font-regular',
};

const TONE_CLASSES: Record<TextTone, string> = {
  default: 'text-text',
  secondary: 'text-text-secondary',
  tertiary: 'text-text-tertiary',
  inverse: 'text-text-inverse',
  primary: 'text-primary',
  onPrimarySoft: 'text-on-primary-soft',
  accent: 'text-accent',
  accentText: 'text-accent-text',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  onPassbook: 'text-on-passbook',
  onPassbookMuted: 'text-on-passbook-muted',
  onCtaGradient: 'text-on-cta-gradient',
};

const ALIGN_CLASSES = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

// RN has no `font-variant` utility class — this is the one case code-standards.md §5 allows a
// style-prop exception for (a fixed, non-token layout value), per ui-tokens.md §2's own rule.
const TABULAR_STYLE = { fontVariant: ['tabular-nums'] as const };

export function Text({
  variant = 'body',
  tone = 'default',
  align,
  className,
  numberOfLines,
  maxFontSizeMultiplier,
  style,
  children,
  ...rest
}: TextProps) {
  const isTabular = variant === 'num' || variant === 'num-lg';

  return (
    <RNText
      className={cn(VARIANT_CLASSES[variant], TONE_CLASSES[tone], align && ALIGN_CLASSES[align], className)}
      style={isTabular ? [TABULAR_STYLE, style] : style}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
    >
      {children}
    </RNText>
  );
}
