import { freshnessLabelFor } from '@societyledger/query';

import { Text } from '@/components/ui/Text';
import { useIsOnline } from '@/hooks/useIsOnline';

export type FreshnessNoteProps = {
  query: { isFetching: boolean; data: unknown; dataUpdatedAt: number };
};

/**
 * A quiet line under a heading when saved data is on screen: "Updating…" while the app checks the server, and "Offline · last updated 10:42"
 * when it cannot. Nothing is drawn when the data is fresh or there is none yet (the screen shows its own skeleton then). Same words as the web.
 */
export function FreshnessNote({ query }: FreshnessNoteProps) {
  const label = freshnessLabelFor(query, useIsOnline());
  if (!label) return null;
  return (
    <Text variant="micro" tone="tertiary" testID="freshness-note" accessibilityLabel={label}>
      {label}
    </Text>
  );
}
