import { View } from 'react-native';
import { Hourglass } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { useCan } from '@/hooks/useCan';
import { trialEndingInDays } from '@/features/session/landing';
import { useSessionStore } from '@/stores/session';
import { useThemeTokens } from '@/providers/ThemeProvider';

/**
 * A reminder for officers when the free trial has 3 days or fewer left. It says what happens next and where to renew, with no prices and
 * no pay button (app-store billing rules).
 */
export function TrialEndingBanner() {
  const { color } = useThemeTokens();
  const user = useSessionStore((state) => state.user);
  const days = trialEndingInDays(user);
  const canRenew = useCan('SETTINGS_BILLING');
  if (days === null || (!canRenew && user?.role !== 'admin')) return null;

  return (
    <View className="flex-row items-start gap-3 rounded-lg bg-warning-soft p-3" accessibilityRole="alert" testID="trial-ending-banner">
      <Hourglass size={20} color={color.warning} strokeWidth={1.75} />
      <View className="flex-1 gap-1">
        <Text variant="body-strong" tone="warning">
          {days <= 1 ? 'Your free trial ends today or tomorrow' : `Your free trial ends in ${days} days`}
        </Text>
        <Text variant="caption" tone="secondary">
          After that, you and your members are blocked until a subscription payment is made. Sign in on the web to renew.
        </Text>
      </View>
    </View>
  );
}
