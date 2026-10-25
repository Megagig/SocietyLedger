import { View, ScrollView, useWindowDimensions, type ViewProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccentRule } from '@/components/ui/AccentRule';
import { HeroBadge } from '@/components/ui/HeroBadge';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/layout/Screen';

export type AuthHeroScreenProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Uppercase brand wordmark above the title. On by default. */
  wordmark?: boolean;
  /** Body content between the description and the actions (cards, fields, notices). */
  children?: ViewProps['children'];
  /** Buttons. Kept inside the centred group so the gap above them stays constant rather than
   * absorbing every spare pixel on tall devices. */
  actions?: ViewProps['children'];
};

/** ui-registry.md "Premium auth surface" — the standard layout for status and auth screens:
 * gold-rimmed hero badge, wordmark, title, accent rule, description, body, actions.
 *
 * The content container deliberately sets no `alignItems`. Centring the cross axis makes Yoga
 * size children to their content, which collapses any percentage-width or `flex: 1` row nested
 * inside (icon-and-text rows lose their text entirely). Children stretch instead, and the pieces
 * that need centring do it themselves via `alignSelf` / `align="center"`.
 *
 * `Screen` is given `scroll={false}` because `flex: 1` has no effect inside a ScrollView's
 * content container — this component owns its own ScrollView so the content centres while it
 * fits and scrolls once it doesn't. */
export function AuthHeroScreen({
  icon,
  title,
  description,
  wordmark = true,
  children,
  actions,
}: AuthHeroScreenProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 760;

  return (
    <Screen edges={['top']} scroll={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <HeroBadge icon={icon} />

        {wordmark ? (
          <Text
            variant="body"
            tone="secondary"
            align="center"
            style={{ letterSpacing: 2, marginTop: 14, fontWeight: '500' }}
          >
            SOCIETY LEDGER
          </Text>
        ) : null}

        <Text variant="h2" align="center" style={{ lineHeight: 32, marginTop: compact ? 16 : 22 }}>
          {title}
        </Text>

        <View style={{ marginTop: 12 }}>
          <AccentRule />
        </View>

        {description ? (
          <Text variant="body" tone="secondary" align="center" style={{ lineHeight: 24, marginTop: 14 }}>
            {description}
          </Text>
        ) : null}

        {children}

        {actions ? (
          <View style={{ marginTop: compact ? 22 : 28, alignSelf: 'stretch', alignItems: 'stretch', gap: 6 }}>
            {actions}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
