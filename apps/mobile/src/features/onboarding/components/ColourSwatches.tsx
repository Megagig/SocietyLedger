import { Pressable, View } from 'react-native';
import { BRAND_COLOUR_PRESETS } from '@societyledger/shared';

import { Text } from '@/components/ui/Text';

/** One-tap brand colours for the setup wizard. The swatch colours are the association's own data (stored as its brand colour), not the app's theme. */
export function ColourSwatches({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <View className="gap-2">
      <Text variant="label">Brand colour</Text>
      <View className="flex-row flex-wrap gap-3">
        {BRAND_COLOUR_PRESETS.map((hex) => {
          const selected = value.trim().toLowerCase() === hex;
          return (
            <Pressable
              key={hex}
              onPress={() => onChange(hex)}
              accessibilityRole="button"
              accessibilityLabel={`Brand colour ${hex}`}
              accessibilityState={{ selected }}
              testID={`swatch-${hex}`}
              hitSlop={6}
              className={selected ? 'h-11 w-11 items-center justify-center rounded-full border-2 border-primary' : 'h-11 w-11 items-center justify-center rounded-full border-2 border-transparent'}
            >
              <View style={{ backgroundColor: hex }} className="h-8 w-8 rounded-full" />
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" tone="secondary">Used behind your initials when there is no logo.</Text>
    </View>
  );
}
