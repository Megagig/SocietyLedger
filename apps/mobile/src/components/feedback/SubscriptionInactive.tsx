import { View } from 'react-native';
import { CreditCard } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

/** ui-rules.md §5.11 — explains the state + admin guidance; read-only cached data still shown where available (the caller's job, not this component's). */
export function SubscriptionInactive() {
  const { color } = useThemeTokens();
  return (
    <View className="items-center gap-3 px-8 py-12">
      <CreditCard size={48} color={color.textTertiary} strokeWidth={1.5} />
      <Text variant="h3" align="center">
        Your association&apos;s subscription has ended.
      </Text>
      <Text variant="body" tone="secondary" align="center">
        Ask your association admin to renew it on the website.
      </Text>
    </View>
  );
}
