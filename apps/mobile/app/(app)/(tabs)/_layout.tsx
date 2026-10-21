import { Briefcase, Home, User, Users, Wallet } from 'lucide-react-native';
import { Tabs } from 'expo-router/tabs';

import { MANAGE_TAB_PERMISSIONS } from '@/lib/permissions';
import { TabBar } from '@/components/layout/TabBar';
import { useCan } from '@/hooks/useCan';

/**
 * project-overview.md §5.1 — 5 permission-aware bottom tabs, custom `TabBar` (library-docs.md's
 * Expo Router note). `Tabs` imported from `expo-router/tabs`, not the root `expo-router` export —
 * that export is deprecated in this SDK (`@deprecated Use 'expo-router/js-tabs' instead`,
 * confirmed by reading `expo-router`'s own `exports.d.ts`); `/tabs` and `/js-tabs` resolve to the
 * same file, `/tabs` is just the shorter alias.
 */
export default function TabsLayout() {
  const canManage = useCan(MANAGE_TAB_PERMISSIONS);

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="money" options={{ title: 'Money', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
          // Community's sub-screens are drill-downs from a hub: coming back to the tab should land on the hub.
          popToTopOnBlur: true,
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: 'Manage',
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
          href: canManage ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
