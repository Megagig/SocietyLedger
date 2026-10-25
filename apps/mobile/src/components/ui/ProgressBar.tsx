import { View } from 'react-native';

import { cn } from '@/lib/cn';

export type ProgressBarProps = {
  /** 0–100; values outside are clamped. */
  percent: number;
  tone?: 'primary' | 'success';
  /** Spoken to screen readers, e.g. "Levy collected". */
  label?: string;
  testID?: string;
};

/** A thin horizontal progress bar (a levy campaign's collected-vs-target). Track = sunken surface, fill = a theme token. */
export function ProgressBar({ percent, tone = 'primary', label, testID }: ProgressBarProps) {
  const shown = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return (
    <View
      testID={testID}
      className="h-2 overflow-hidden rounded-full bg-surface-sunken"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(shown) }}
    >
      <View className={cn('h-full rounded-full', tone === 'success' ? 'bg-success' : 'bg-primary')} style={{ width: `${shown}%` }} />
    </View>
  );
}
