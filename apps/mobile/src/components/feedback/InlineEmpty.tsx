import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type InlineEmptyProps = {
  icon: LucideIcon;
  message: string;
};

/** ui-registry.md — compact empty state for use *inside* a card (icon in a sunken circle + one line), unlike the full-screen `EmptyState`. */
export function InlineEmpty({ icon: Icon, message }: InlineEmptyProps) {
  const { color } = useThemeTokens();
  return (
    <View className="items-center gap-2 py-6">
      <View className="h-[48px] w-[48px] items-center justify-center rounded-full bg-surface-sunken">
        <Icon size={24} color={color.textTertiary} strokeWidth={1.5} />
      </View>
      <Text variant="body" tone="secondary" align="center">
        {message}
      </Text>
    </View>
  );
}
