import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';

export type CoopTileTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const CONTAINER: Record<CoopTileTone, string> = {
  success: 'bg-success-soft',
  info: 'bg-info-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  neutral: 'bg-surface-sunken',
};

const LABEL: Record<CoopTileTone, 'success' | 'info' | 'warning' | 'danger' | 'secondary'> = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  danger: 'danger',
  neutral: 'secondary',
};

/**
 * A labelled figure: the summary tile on the cooperative pages. The tone is meaning (good, information, caution, owed), never decoration.
 * The amount is always shown in full (₦5,000.00); `masked` hides it (the dashboard's Hide button) and tells a screen reader it is hidden.
 */
export function CoopTile({
  label,
  value,
  hint,
  tone = 'neutral',
  masked = false,
  testID,
}: {
  label: string;
  value: string | null | undefined;
  hint?: ReactNode;
  tone?: CoopTileTone;
  masked?: boolean;
  testID?: string;
}) {
  return (
    <View className={`flex-1 gap-1 rounded-lg p-4 ${CONTAINER[tone]}`} testID={testID} accessible accessibilityLabel={masked ? `${label}: amount hidden` : undefined}>
      <Text variant="label" tone={LABEL[tone]} numberOfLines={2}>
        {label}
      </Text>
      {masked ? (
        <Text variant="h2" tone="secondary">
          ₦ ••••••
        </Text>
      ) : value === null || value === undefined ? (
        <Text variant="h2">—</Text>
      ) : (
        <Money value={value} size="h2" />
      )}
      {hint ? (
        typeof hint === 'string' ? (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        ) : (
          hint
        )
      ) : null}
    </View>
  );
}
