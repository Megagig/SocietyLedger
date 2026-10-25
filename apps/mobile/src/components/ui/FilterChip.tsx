import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { cn } from '@/lib/cn';
import { Text } from './Text';

export type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Optional leading icon. */
  children?: ReactNode;
};

/** ui-registry.md — pill used in horizontally scrolling filter rows (type / status / dates). */
export function FilterChip({ label, active, onPress, children }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={cn(
        'h-[36px] flex-row items-center gap-[6px] rounded-full border px-3',
        active ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
      )}
    >
      {children}
      <Text variant="label" tone={active ? 'default' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}
