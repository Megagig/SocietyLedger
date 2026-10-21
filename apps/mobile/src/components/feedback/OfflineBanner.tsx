import { View } from 'react-native';

import { Text } from '@/components/ui/Text';

export type OfflineBannerProps = {
  lastUpdatedLabel?: string;
};

/** ui-rules.md §5.11 — slim warning-soft banner under the header. Mutations are disabled while offline by the screen/caller (`useOnline()`, F1.6+) — this component only shows the banner. */
export function OfflineBanner({ lastUpdatedLabel }: OfflineBannerProps) {
  return (
    <View className="bg-warning-soft px-4 py-2">
      <Text variant="caption" tone="warning">
        You&apos;re offline.{lastUpdatedLabel ? ` Showing saved data from ${lastUpdatedLabel}.` : ''}
      </Text>
    </View>
  );
}
