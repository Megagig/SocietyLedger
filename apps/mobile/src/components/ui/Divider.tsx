import { StyleSheet, View } from 'react-native';

import { cn } from '@/lib/cn';

export type DividerProps = {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
};

// ui-tokens.md §5 `--border-hairline` — StyleSheet.hairlineWidth isn't expressible as a
// NativeWind className (it resolves to a platform-specific sub-pixel value at runtime).
export function Divider({ orientation = 'horizontal', className }: DividerProps) {
  const sizeStyle = orientation === 'horizontal' ? { height: StyleSheet.hairlineWidth } : { width: StyleSheet.hairlineWidth };

  return <View className={cn('bg-border', orientation === 'horizontal' ? 'w-full' : 'h-full', className)} style={sizeStyle} />;
}
