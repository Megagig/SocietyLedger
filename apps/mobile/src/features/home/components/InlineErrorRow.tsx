import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { t } from '@/lib/i18n';

export type InlineErrorRowProps = {
  title: string;
  onRetry: () => void;
};

/** A compact error affordance for H1's secondary/preview widgets (meeting, vote, payments,
 * announcements) — a full `ErrorState` (ui-rules.md §5.11) is sized for a whole screen; these
 * sections are small pieces of a dashboard, not the screen's only content. */
export function InlineErrorRow({ title, onRetry }: InlineErrorRowProps) {
  return (
    <View className="flex-row items-center justify-between rounded-lg bg-surface-sunken px-4 py-3">
      <Text variant="body" tone="secondary">
        {title}
      </Text>
      <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
        <Text variant="label" tone="primary">
          {t('common.tryAgain')}
        </Text>
      </Pressable>
    </View>
  );
}
