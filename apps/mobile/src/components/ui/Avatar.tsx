import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type AvatarSize = 32 | 40 | 64;
export type AvatarShape = 'circle' | 'square';

export type AvatarProps = {
  /** Full name, used for initials (ui-rules.md §5.14). */
  name: string;
  size?: AvatarSize;
  /** 'circle' for members, 'square' (radius md) for association logos. */
  shape?: AvatarShape;
  /** Member id (or any stable identifier) used to pick a chart-palette colour — ui-rules.md §5.14. Ignored when `tintColor` is given. */
  colorSeed?: number | string;
  /** Association `primaryColor` override (ui-rules.md §5.14's logo fallback) — a real hex from data, not a hardcoded design value. */
  tintColor?: string;
  testID?: string;
};

// No image loading yet (expo-image isn't installed — no screen needs a real logo/photo
// through F1.4; added when the first feature that does starts, e.g. F1.8 or F2.x).

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

function hashSeed(seed: number | string): number {
  if (typeof seed === 'number') return Math.abs(Math.trunc(seed));
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return hash;
}

function withAlpha(hex: string, alpha: number): string {
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${channel}`;
}

const SIZE_CLASSES: Record<AvatarSize, string> = { 32: 'h-8 w-8', 40: 'h-10 w-10', 64: 'h-16 w-16' };
const TEXT_VARIANT: Record<AvatarSize, 'caption' | 'body-strong' | 'h3'> = { 32: 'caption', 40: 'body-strong', 64: 'h3' };
const SHAPE_CLASSES: Record<AvatarShape, string> = { circle: 'rounded-full', square: 'rounded-md' };

export function Avatar({ name, size = 40, shape = 'circle', colorSeed, tintColor, testID }: AvatarProps) {
  const { chart } = useThemeTokens();
  const baseColor = tintColor ?? chart[hashSeed(colorSeed ?? name) % chart.length]!;

  return (
    <View
      testID={testID}
      className={['items-center justify-center', SIZE_CLASSES[size], SHAPE_CLASSES[shape]].join(' ')}
      style={{ backgroundColor: withAlpha(baseColor, 0.12) }}
    >
      <Text variant={TEXT_VARIANT[size]} style={{ color: baseColor }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
