import { Pressable, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { cn } from '@/lib/cn';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

/**
 * ui-rules.md §5.8 — height 64 + safe area, `surface` background with a top hairline. Icon 24 +
 * `micro` label. Active: icon + label `primary`, with a 32×4 `primary` pill above the icon (no
 * filled background blob). Inactive: `text-secondary`.
 *
 * `state.routes`/`descriptors` arrive already filtered to visible tabs — Expo Router's
 * `useVisibleTabsWithRedirect` (driving the Manage tab's `href`-conditional visibility in
 * `(tabs)/_layout.tsx`) excludes hidden routes before they ever reach this component, so no
 * manual hidden-tab filtering is needed here.
 */
export function TabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const { color } = useThemeTokens();

  return (
    <View className="flex-row border-t border-border bg-surface" style={{ paddingBottom: insets.bottom, height: 64 + insets.bottom }}>
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options ?? {};
        const focused = index === state.index;
        const label = (typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title) ?? route.name;
        const tone = focused ? color.primary : color.textSecondary;

        return (
          <Pressable
            key={route.key}
            onPress={() => navigateToTab(route.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            hitSlop={4}
            className="flex-1 items-center justify-center gap-1"
          >
            <View className={cn('h-1 w-8 rounded-full', focused && 'bg-primary')} />
            {options.tabBarIcon?.({ focused, color: tone, size: 24 })}
            <Text variant="micro" tone={focused ? 'primary' : 'secondary'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
