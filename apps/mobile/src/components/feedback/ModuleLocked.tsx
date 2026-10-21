import { View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type ModuleLockedProps = {
  moduleName: string;
};

/** ui-rules.md §5.11 — no upgrade/purchase button (rule #16: no in-app selling of subscriptions). */
export function ModuleLocked({ moduleName }: ModuleLockedProps) {
  const { color } = useThemeTokens();
  return (
    <View className="items-center gap-3 px-8 py-12">
      <Lock size={48} color={color.textTertiary} strokeWidth={1.5} />
      <Text variant="h3" align="center">
        {moduleName} isn&apos;t part of your association&apos;s plan.
      </Text>
      <Text variant="body" tone="secondary" align="center">
        Your association admin can add it from the website.
      </Text>
    </View>
  );
}
