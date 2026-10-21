import { View, type ViewProps } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';

export type ScreenHeaderProps = {
  title: string;
  /** Large `h1` style for tab roots; `h3` for detail/modal headers (ui-rules.md §2, §5.9). */
  large?: boolean;
  onBack?: () => void;
  backLabel?: string;
  /** Up to 2 IconButtons (ui-rules.md §5.9). */
  rightActions?: ViewProps['children'];
  /** A text button (e.g. "Cancel") for modal headers — the Screen skeleton's "Cancel / New member / Save" row. */
  leftAction?: ViewProps['children'];
  /** The caller toggles this once the screen has scrolled — ScreenHeader stays presentational and never reads scroll state itself (architecture.md §4 layer rule: components/** are props in/out only). */
  showDivider?: boolean;
};

export function ScreenHeader({ title, large = false, onBack, backLabel, rightActions, leftAction, showDivider = false }: ScreenHeaderProps) {
  return (
    <View
      className={cn('h-[52px] flex-row items-center bg-bg px-4', showDivider && 'border-b border-border')}
    >
      <View className="flex-row items-center gap-1">
        {onBack ? <IconButton icon={ChevronLeft} onPress={onBack} accessibilityLabel={backLabel ?? 'Back'} /> : leftAction}
      </View>
      <View className="flex-1 px-2">
        <Text variant={large ? 'h1' : 'h3'} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View className="flex-row items-center gap-1">{rightActions}</View>
    </View>
  );
}
