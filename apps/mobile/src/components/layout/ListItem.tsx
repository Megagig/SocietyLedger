import { Children, Fragment } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Divider } from '@/components/ui/Divider';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type ListItemProps = {
  /** An icon pre-wrapped in its own 36dp circle, or an Avatar — ListItem doesn't compose that itself (ui-rules.md §5.3). */
  leading?: ViewProps['children'];
  title: string;
  meta?: string;
  trailing?: ViewProps['children'];
  showChevron?: boolean;
  onPress?: () => void;
  compact?: boolean;
  disabled?: boolean;
  testID?: string;
};

// ui-rules.md §5.3 — the workhorse row. Min height 56 (compact 48), 16/12 padding. Interactive
// rows get an android_ripple tinted `primary/12` (ui-rules.md §5.2 — ripple is for rows only).
export function ListItem({
  leading,
  title,
  meta,
  trailing,
  showChevron = false,
  onPress,
  compact = false,
  disabled = false,
  testID,
}: ListItemProps) {
  const { color } = useThemeTokens();

  const row = (
    <View className={['flex-row items-center px-4 py-3', compact ? 'min-h-[48px]' : 'min-h-[56px]'].join(' ')}>
      {leading ? <View className="mr-3">{leading}</View> : null}
      <View className="flex-1">
        <Text variant="body-lg" numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? <View className="ml-3 items-end">{trailing}</View> : null}
      {showChevron ? <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} style={{ marginLeft: 8 }} /> : null}
    </View>
  );

  if (!onPress) {
    return <View testID={testID}>{row}</View>;
  }

  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      android_ripple={{ color: `${color.primary}1F` }}
      className={disabled ? 'opacity-40' : undefined}
    >
      {row}
    </Pressable>
  );
}

export type ListGroupProps = {
  children: ViewProps['children'];
  testID?: string;
};

// Grouped rows on a surface with hairline separators (ui-rules.md §5.3) — the "ledger rows,
// not card soup" pattern (ui-rules.md §1 rule #2). Simplification: dividers are full-width, not
// inset to each row's text start — no real screen exists yet to validate per-row leading-icon
// widths against; revisit if a future feature needs the exact inset.
export function ListGroup({ children, testID }: ListGroupProps) {
  const items = Children.toArray(children).filter(Boolean);

  return (
    <View testID={testID} className="overflow-hidden rounded-md border border-border bg-surface dark:border-transparent">
      {items.map((child, index) => (
        <Fragment key={index}>
          {child}
          {index < items.length - 1 ? <Divider /> : null}
        </Fragment>
      ))}
    </View>
  );
}
