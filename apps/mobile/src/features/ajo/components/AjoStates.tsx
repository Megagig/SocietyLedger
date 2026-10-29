import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';

/** Placeholder rows while a list loads: skeletons, not a spinner. */
export function AjoLoading({ rows = 3 }: { rows?: number }) {
  return (
    <View className="gap-3" accessibilityState={{ busy: true }} testID="ajo-loading">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} width="100%" height={72} radius="md" />
      ))}
    </View>
  );
}

/** Shown on every Ajo screen once the add-on has lapsed: history stays readable, nothing can be changed. */
export function AjoReadOnlyBanner() {
  return (
    <View className="mb-4 rounded-lg bg-warning-soft px-4 py-3" accessibilityRole="alert" testID="ajo-read-only">
      <Text variant="caption" tone="warning">
        <Text variant="label" tone="warning">
          Read-only.{' '}
        </Text>
        The Ajo add-on has expired. You can still see everything, but nothing can be added or changed until it is renewed.
      </Text>
    </View>
  );
}

/** Collector screens work online only. This replaces the action, never queues it for later. */
export function NeedsInternet() {
  return (
    <View className="mb-4 rounded-lg bg-warning-soft px-4 py-3" accessibilityRole="alert" testID="ajo-needs-internet">
      <Text variant="caption" tone="warning">
        <Text variant="label" tone="warning">
          This needs internet.{' '}
        </Text>
        Collections are recorded straight away, so connect to the internet to record cash or hand it over. Nothing is saved for later.
      </Text>
    </View>
  );
}
