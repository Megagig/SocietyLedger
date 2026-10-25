import { View } from 'react-native';

import { cn } from '@/lib/cn';
import { Text } from './Text';

export type StatTileTone = 'info' | 'success' | 'accent' | 'primary' | 'warning';

const TONE_CLASSES: Record<StatTileTone, { container: string; value: string }> = {
  info: { container: 'bg-info-soft', value: 'text-info' },
  success: { container: 'bg-success-soft', value: 'text-success' },
  accent: { container: 'bg-accent-soft', value: 'text-accent-text' },
  primary: { container: 'bg-primary-soft', value: 'text-on-primary-soft' },
  warning: { container: 'bg-warning-soft', value: 'text-warning' },
};

export type StatTileProps = {
  label: string;
  value: string;
  tone?: StatTileTone;
  testID?: string;
};

/** ui-registry.md — tinted metric tile (the web "My Meetings"/"My Voting" StatCard). Three fit one row on phone width. */
export function StatTile({ label, value, tone = 'info', testID }: StatTileProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <View testID={testID} className={cn('min-w-[96px] flex-1 gap-1 rounded-lg p-3', classes.container)}>
      <Text variant="caption" tone="secondary" numberOfLines={2}>
        {label}
      </Text>
      <Text variant="h2" className={classes.value}>
        {value}
      </Text>
    </View>
  );
}
