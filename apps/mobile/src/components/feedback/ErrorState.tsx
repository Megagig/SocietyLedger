import { View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

/** ui-rules.md §5.11 — plain words, "Try again" button, no apologies. */
export function ErrorState({ title = "We couldn't load this.", description, onRetry }: ErrorStateProps) {
  const { color } = useThemeTokens();
  return (
    <View className="items-center gap-3 px-8 py-12">
      <TriangleAlert size={48} color={color.danger} strokeWidth={1.5} />
      <Text variant="h3" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="secondary" align="center">
          {description}
        </Text>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" onPress={onRetry}>
          Try again
        </Button>
      ) : null}
    </View>
  );
}
