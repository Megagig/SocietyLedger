import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { IconCircle, type IconCircleTone } from '@/components/ui/IconCircle';
import { Text } from '@/components/ui/Text';

export type QuickLinkTileProps = {
  icon: LucideIcon;
  label: string;
  tone?: IconCircleTone;
  onPress: () => void;
  testID?: string;
};

/** A square-ish shortcut: tinted icon circle over a short label. Three fit a phone-width row. */
export function QuickLinkTile({ icon, label, tone = 'primary', onPress, testID }: QuickLinkTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      className="flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-2 py-4 dark:border-transparent"
    >
      <View>
        <IconCircle icon={icon} tone={tone} />
      </View>
      <Text variant="caption" align="center" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}
