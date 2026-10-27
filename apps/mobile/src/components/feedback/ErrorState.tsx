import { View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { moduleDisplayName } from '@societyledger/shared';

import { ApiError } from '@/api/errors';
import { AccessState } from '@/components/feedback/AccessState';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type ErrorStateProps = {
  title?: string;
  description?: string;
  /** The failed query's error: when it is a refusal because of the person's role or their association's plan the screen says so plainly, and when it is a network/timeout ApiError the copy says so instead of the generic message. */
  error?: unknown;
  onRetry?: () => void;
};

/** ui-rules.md §5.11 — plain words, "Try again" button, no apologies. A refusal for role or plan reasons is not a failure to load, so it gets its own state. */
export function ErrorState({ title: titleProp, description: descriptionProp, error, onRetry }: ErrorStateProps) {
  const { color } = useThemeTokens();

  if (error instanceof ApiError && error.accessKind) {
    return <AccessState kind={error.accessKind} moduleName={moduleDisplayName(error.module)} onRetry={onRetry} />;
  }

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
