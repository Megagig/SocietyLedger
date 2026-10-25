import { useId } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useThemeTokens } from '@/providers/ThemeProvider';

export type HeroBadgeProps = {
  icon: LucideIcon;
  /** Accessible name. Omit for a purely decorative badge beside a visible title. */
  accessibilityLabel?: string;
};

/** ui-registry.md "Premium auth surface" — the gold-rimmed arch that opens a status or auth
 * screen. Shrinks itself on short devices so the screen's actions stay reachable. */
export function HeroBadge({ icon: Icon, accessibilityLabel }: HeroBadgeProps) {
  const { color } = useThemeTokens();
  const { height } = useWindowDimensions();
  const id = `hero-badge-${useId()}`;

  const compact = height < 760;
  const width = compact ? 66 : 78;
  const badgeHeight = compact ? 78 : 92;

  return (
    <View
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={{
        alignSelf: 'center',
        width,
        height: badgeHeight,
        borderTopLeftRadius: width / 2,
        borderTopRightRadius: width / 2,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        borderWidth: 1.5,
        borderColor: color.accent,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={color.primary} />
            <Stop offset="1" stopColor={color.ctaGradientFrom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <Icon size={compact ? 29 : 33} color={color.accent} strokeWidth={1.5} />
    </View>
  );
}
