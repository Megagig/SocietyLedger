import { View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';

import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type ErrorStateProps = {
  title?: string;
  description?: string;
  /** The failed query's error — when it's a network/timeout ApiError the copy says so instead of the generic message. */
  error?: unknown;
  onRetry?: () => void;
};

/** ui-rules.md §5.11 — plain words, "Try again" button, no apologies. */
export function ErrorState({ title: titleProp, description: descriptionProp, error, onRetry }: ErrorStateProps) {
  const { color } = useThemeTokens();
  const unreachable = error instanceof ApiError && (error.isNetwork || error.isTimeout);
  const title = titleProp ?? (unreachable ? "Can't reach the server." : "We couldn't load this.");
  const description = descriptionProp ?? (unreachable ? 'Check your internet connection and try again.' : undefined);
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
