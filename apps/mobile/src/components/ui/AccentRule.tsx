import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useThemeTokens } from '@/providers/ThemeProvider';

export type AccentRuleProps = {
  /** Rule width in dp. Default 64 — the auth-screen standard. */
  width?: number;
};

/** ui-registry.md "Premium auth surface" — the forest-green-to-gold divider that sits under a
 * hero title. Purely decorative, so it is hidden from assistive tech. */
export function AccentRule({ width = 64 }: AccentRuleProps) {
  const { color } = useThemeTokens();
  const id = `accent-rule-${useId()}`;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ alignSelf: 'center', width, height: 3, borderRadius: 2, overflow: 'hidden' }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color.ctaGradientFrom} />
            <Stop offset="1" stopColor={color.ctaGradientTo} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
