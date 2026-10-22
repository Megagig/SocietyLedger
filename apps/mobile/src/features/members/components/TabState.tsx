import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

export type TabStateProps = {
  isPending: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  children: ReactNode;
};

/** Loading skeleton, error with retry, or the tab's content — the three states every member detail tab shares (ui-rules.md §5.11). */
export function TabState({ isPending, isError, error, onRetry, children }: TabStateProps) {
  if (isPending) {
    return (
      <View className="gap-3">
        <Skeleton width="100%" height={72} radius="lg" />
        <Skeleton width="100%" height={160} radius="md" />
      </View>
    );
  }
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  return <>{children}</>;
}
