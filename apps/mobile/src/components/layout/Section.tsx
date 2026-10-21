import { Pressable, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';
import { Text } from '@/components/ui/Text';

export type SectionProps = {
  title?: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  children: ViewProps['children'];
  className?: string;
};

// ui-rules.md §2/§3 — heading (h3, sentence case) + optional "See all" ghost text button,
// 12dp gap to content. The 24dp gap *between* sections is the parent screen's job (a `gap-6`
// flex container), so Section only owns its own internal heading-to-content spacing.
export function Section({ title, onSeeAll, seeAllLabel = 'See all', children, className }: SectionProps) {
  return (
    <View className={cn('gap-3', className)}>
      {title ? (
        <View className="flex-row items-center justify-between">
          <Text variant="h3">{title}</Text>
          {onSeeAll ? (
            <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
              <Text variant="label" tone="primary">
                {seeAllLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
