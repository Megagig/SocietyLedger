import { View } from 'react-native';
import { Inbox, type LucideIcon } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** ui-rules.md §5.11 — 48dp icon, title stating the situation, one line on what to do, optional primary action. */
export function EmptyState({ icon: Icon = Inbox, title, description, actionLabel, onAction }: EmptyStateProps) {
  const { color } = useThemeTokens();
  return (
    <View className="items-center gap-3 px-8 py-12">
      <Icon size={48} color={color.textTertiary} strokeWidth={1.5} />
      <Text variant="h3" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="secondary" align="center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="primary" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
