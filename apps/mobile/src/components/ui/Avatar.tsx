import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type AvatarSize = 32 | 40 | 64 | 96;
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
  /** The member's photo. Use the small `thumbUrl` for lists and the full `photoUrl` for profile screens. Null or a failed load shows initials. */
  imageUrl?: string | null;
  testID?: string;
};

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

/** The photo is drawn at exact pixel sizes, never percentages: percentage sizes inside a ScrollView are unreliable on Android (see Screen.tsx) and a photo that cannot be laid out can leave the whole screen blank. */
const RADIUS: Record<AvatarShape, (size: number) => number> = { circle: (size) => size / 2, square: () => 6 };

const SIZE_CLASSES: Record<AvatarSize, string> = { 32: 'h-8 w-8', 40: 'h-10 w-10', 64: 'h-16 w-16', 96: 'h-24 w-24' };
const TEXT_VARIANT: Record<AvatarSize, 'caption' | 'body-strong' | 'h3' | 'h2'> = { 32: 'caption', 40: 'body-strong', 64: 'h3', 96: 'h2' };
const SHAPE_CLASSES: Record<AvatarShape, string> = { circle: 'rounded-full', square: 'rounded-md' };

export function Avatar({ name, size = 40, shape = 'circle', colorSeed, tintColor, imageUrl, testID }: AvatarProps) {
  const { chart } = useThemeTokens();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!imageUrl && imageUrl !== failedUrl;
  const baseColor = tintColor ?? chart[hashSeed(colorSeed ?? name) % chart.length]!;

  return (
    <View
      testID={testID}
      className={['items-center justify-center overflow-hidden', SIZE_CLASSES[size], SHAPE_CLASSES[shape]].join(' ')}
      style={{ backgroundColor: withAlpha(baseColor, 0.12) }}
    >
      {showImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: RADIUS[shape](size) }}
          contentFit="cover"
          cachePolicy="disk"
          accessibilityLabel={name}
          onError={() => setFailedUrl(imageUrl ?? null)}
          testID={testID ? `${testID}-image` : undefined}
        />
      ) : (
        <Text variant={TEXT_VARIANT[size]} style={{ color: baseColor }}>
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}
