import { View } from 'react-native';

import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import type { MoneyValue } from '@/types/api/common';

export type FactRowProps = {
  label: string;
  /** Plain text value. Empty values render as an en dash so a missing field is visible, not a gap. */
  value?: string | null;
  /** An amount — rendered through `Money` (tabular figures, ₦). Wins over `value`. */
  amount?: MoneyValue;
  /** Colours an overdue / owing amount (ui-rules.md §4: danger only for status). */
  danger?: boolean;
  testID?: string;
};

/** A label on the left and its value on the right — the dense key/value row officer detail screens stack inside a `ListGroup`. */
export function FactRow({ label, value, amount, danger = false, testID }: FactRowProps) {
  return (
    <View className="min-h-[48px] flex-row items-center justify-between gap-4 px-4 py-3" testID={testID}>
      <Text variant="body" tone="secondary" className="flex-shrink-0">
        {label}
      </Text>
      <View className="flex-1 items-end">
        {amount !== undefined ? (
          <Money value={amount} size="body-strong" tone={danger ? 'danger' : 'default'} />
        ) : (
          <Text variant="body" align="right" numberOfLines={3}>
            {value && value.trim() ? value : '–'}
          </Text>
        )}
      </View>
    </View>
  );
}
