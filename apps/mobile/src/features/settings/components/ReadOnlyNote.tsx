import { View } from 'react-native';

import { Text } from '@/components/ui/Text';

/** Shown above a settings form the person may read but not change (`settings.view` without `settings.edit`). */
export function ReadOnlyNote() {
  return (
    <View className="pb-4" testID="settings-read-only">
      <Text variant="caption" tone="secondary">
        You can look at these settings but not change them. Ask an officer who manages settings.
      </Text>
    </View>
  );
}
