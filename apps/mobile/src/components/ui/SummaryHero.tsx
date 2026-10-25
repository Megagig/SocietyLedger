import { useId, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type SummaryHeroStat = { label: string; value: string; /** Opens what makes the figure up. */ onPress?: () => void };

export type SummaryHeroProps = {
  icon: LucideIcon;
  /** Small label above the headline value, e.g. "Guaranteed on active loans". */
  eyebrow: string;
  /** The headline figure — pass a `Money` with `size="display" tone="onPassbook"`. */
  children: ReactNode;
  caption?: string;
  /** Up to three translucent stat pills along the bottom. */
  stats?: SummaryHeroStat[];
  /** Opens what makes the headline figure up. */
  onPress?: () => void;
  testID?: string;
};

/**
 * A deep-green summary panel that opens a screen with one headline figure and a few supporting numbers — the
 * quieter sibling of `Passbook`, which stays reserved for balances (ui-rules.md §5.1). Same palette (passbook green,
 * gold accent) so the two read as one family; no ruled lines or stamp.
 */
export function SummaryHero({ icon: Icon, eyebrow, children, caption, stats, onPress, testID }: SummaryHeroProps) {
  const { color } = useThemeTokens();
  // SVG gradient ids are global; two heroes on one screen would otherwise share definitions.
  const gradientId = `summary-hero-${useId()}`;

  return (
    <View testID={testID} className="overflow-hidden rounded-xl bg-passbook p-5">
      <View className="absolute inset-0" pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`${gradientId}-glow`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color.primary} stopOpacity="0.45" />
              <Stop offset="0.55" stopColor={color.primary} stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id={`${gradientId}-gold`} x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color.passbookStamp} stopOpacity="0.22" />
              <Stop offset="0.5" stopColor={color.passbookStamp} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId}-glow)`} />
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId}-gold)`} />
        </Svg>
      </View>

      <View className="absolute inset-x-0 top-0 h-[2px] bg-passbook-stamp" />

      <View className="flex-row items-start justify-between gap-3">
        <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? `${eyebrow}. Opens the entries.` : undefined} className="flex-1 gap-1">
          <Text variant="label" tone="onPassbookMuted">
            {eyebrow}
          </Text>
          {children}
          {caption ? (
            <Text variant="caption" tone="onPassbookMuted">
              {caption}
            </Text>
          ) : null}
        </Pressable>
        <View className="h-11 w-11 items-center justify-center rounded-full border border-passbook-stamp/40 bg-on-passbook/10">
          <Icon size={22} color={color.passbookStamp} strokeWidth={1.75} />
        </View>
      </View>

      {stats && stats.length > 0 ? (
        <View className="mt-4 flex-row gap-3">
          {stats.slice(0, 3).map((stat) => (
            <Pressable
              key={stat.label}
              disabled={!stat.onPress}
              onPress={stat.onPress}
              accessibilityRole={stat.onPress ? 'button' : undefined}
              accessibilityLabel={stat.onPress ? `${stat.label}. Opens the entries.` : undefined}
              className="flex-1 gap-0.5 rounded-lg bg-on-passbook/10 px-3 py-2"
            >
              <Text variant="h2" tone="onPassbook">
                {stat.value}
              </Text>
              <Text variant="caption" tone="onPassbookMuted" numberOfLines={1}>
                {stat.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
