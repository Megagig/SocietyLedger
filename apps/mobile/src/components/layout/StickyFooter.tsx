import { Platform, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

export type StickyFooterProps = {
  children: ViewProps['children'];
};

// ui-tokens.md §6/§3 — elevation-1 (iOS shadow / Android elevation), 16dp padding + safe area
// bottom inset (tokens.layout.stickyFooterPadding), top hairline, surface fill.
export function StickyFooter({ children }: StickyFooterProps) {
  const insets = useSafeAreaInsets();
  const elevation1 = tokens.elevation[1];

  return (
    <View
      className="w-full flex-row gap-3 border-t border-border bg-surface px-4 pt-3"
      style={{
        paddingBottom: insets.bottom + 16,
        ...Platform.select({
          ios: {
            shadowColor: elevation1.shadowColor,
            shadowOpacity: elevation1.shadowOpacity,
            shadowRadius: elevation1.shadowRadius,
            shadowOffset: elevation1.shadowOffset,
          },
          android: { elevation: elevation1.android },
        }),
      }}
    >
      {children}
    </View>
  );
}
