import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type TickRowProps = {
  label: string;
  meta?: string;
  checked: boolean;
  onToggle: () => void;
  testID?: string;
};

/** A tappable row with a tick box, for picking several people or payments from a list. */
export function TickRow({ label, meta, checked, onToggle, testID }: TickRowProps) {
  const { color } = useThemeTokens();
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} testID={testID} className="min-h-[48px] flex-row items-center gap-3 rounded-lg bg-surface-sunken px-3 py-2">
      <View className={['h-6 w-6 items-center justify-center rounded-sm border', checked ? 'border-primary bg-primary' : 'border-border-strong bg-surface'].join(' ')}>
        {checked ? <Check size={16} color={color.textInverse} strokeWidth={2.5} /> : null}
      </View>
      <View className="flex-1">
        <Text variant="body">{label}</Text>
        {meta ? (
          <Text variant="caption" tone="tertiary">
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
