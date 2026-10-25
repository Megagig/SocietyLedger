import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

export type CardProps = {
  children?: ViewProps['children'];
  noPadding?: boolean;
  className?: string;
  testID?: string;
};

// ui-rules.md §5.4 — surface, radius lg, 1dp border (light) / no border (dark, surface alone
// reads against bg), padding 16, never a shadow. `dark:border-transparent` relies on NativeWind
// v4's plain `@media (prefers-color-scheme: dark)` mechanism (confirmed library-docs.md, F1.2).
export function Card({ children, noPadding = false, className, testID }: CardProps) {
  return (
    <View
      testID={testID}
      className={cn('bg-surface rounded-lg border border-border dark:border-transparent', noPadding ? '' : 'p-4', className)}
    >
      {children}
    </View>
  );
}
