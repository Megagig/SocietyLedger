import { memo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Divider } from '@/components/ui/Divider';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type RowPosition = 'first' | 'middle' | 'last' | 'only';

export function positionOf(index: number, count: number): RowPosition {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/**
 * A tappable row that, rendered one per list item, still reads as one grouped surface with hairline separators (ui-rules.md §5.3) —
 * the same shell `ChargeRow` uses. The row's content is passed in.
 */
function GroupedRowBase({
  position,
  onPress,
  accessibilityLabel,
  testID,
  minHeight = 72,
  children,
}: {
  position: RowPosition;
  onPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
  minHeight?: number;
  children: ReactNode;
}) {
  const { color } = useThemeTokens();
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')}>
      {isFirst ? null : <Divider />}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        android_ripple={onPress ? { color: `${color.primary}1F` } : undefined}
        className="flex-row items-center px-4 py-3"
        style={{ minHeight }}
        testID={testID}
      >
        <View className="flex-1">{children}</View>
        {onPress ? <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} style={{ marginLeft: 8 }} /> : null}
      </Pressable>
    </View>
  );
}

export const GroupedRow = memo(GroupedRowBase);
