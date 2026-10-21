import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type ScreenProps = {
  children: ViewProps['children'];
  /** Default true — a ScrollView with the screen gutter baked in. Pass false for screens that manage their own scrolling (e.g. a FlashList child). */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Wraps content in KeyboardAvoidingView — code-standards.md §8. */
  keyboard?: boolean;
  /** Which safe-area edges this Screen applies itself (ui-rules.md §2 — top is usually the native header's job, bottom usually the tab bar's/StickyFooter's; defaults to neither here, since most routes already get one of those). Pass `['top']` for a screen with no native header, `['bottom']` for one with no tab bar/StickyFooter below it. */
  edges?: Edge[];
  className?: string;
};

export function Screen({ children, scroll = true, refreshing, onRefresh, keyboard = false, edges = [], className }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { color } = useThemeTokens();

  const insetStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  // ui-rules.md §2 — 16dp gutter, content max width 560dp centred on tablets.
  const contentClassName = cn('w-full max-w-[560px] self-center px-4', className);

  const content = scroll ? (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName={contentClassName}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={color.primary} /> : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View className={cn('flex-1 bg-bg', contentClassName)}>{children}</View>
  );

  return (
    <View className="flex-1 bg-bg" style={insetStyle}>
      {keyboard ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
}
