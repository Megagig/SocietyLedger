import { View, type ViewProps } from 'react-native';
import { ChevronLeft, CircleHelp } from 'lucide-react-native';
import { isPlanBillingDocsPath } from '@societyledger/shared';

import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { getDocsPathForScreen, openDocs } from '@/lib/docs';

export type ScreenHeaderProps = {
  title: string;
  /** Large `h1` style for tab roots; `h3` for detail/modal headers (ui-rules.md §2, §5.9). */
  large?: boolean;
  onBack?: () => void;
  backLabel?: string;
  /** Up to 2 IconButtons (ui-rules.md §5.9). */
  rightActions?: ViewProps['children'];
  /** A text button (e.g. "Cancel") for modal headers — the Screen skeleton's "Cancel / New member / Save" row. */
  leftAction?: ViewProps['children'];
  /** The caller toggles this once the screen has scrolled — ScreenHeader stays presentational and never reads scroll state itself (architecture.md §4 layer rule: components/** are props in/out only). */
  showDivider?: boolean;
  /** A screen ID from `DOCS_LINKS` (e.g. `'M15'`). Adds a `?` button that opens that screen's docs page in the in-app browser; renders nothing for an unmapped ID or a plan-billing page (architecture.md §15.4). */
  docsKey?: string;
};

export function ScreenHeader({ title, large = false, onBack, backLabel, rightActions, leftAction, showDivider = false, docsKey }: ScreenHeaderProps) {
  const docsPath = docsKey ? getDocsPathForScreen(docsKey) : undefined;
  const showDocs = !!docsKey && !!docsPath && !isPlanBillingDocsPath(docsPath);

  return (
    <View
      className={cn('h-[52px] flex-row items-center bg-bg', showDivider && 'border-b border-border')}
    >
      <View className="flex-row items-center gap-1">
        {onBack ? <IconButton icon={ChevronLeft} onPress={onBack} accessibilityLabel={backLabel ?? 'Back'} /> : leftAction}
      </View>
      <View className="flex-1 px-2">
        <Text variant={large ? 'h1' : 'h3'} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View className="flex-row items-center gap-1">
        {showDocs ? <IconButton icon={CircleHelp} accessibilityLabel="Help for this screen" onPress={() => void openDocs(docsKey!, 'screen_header')} testID={`docs-help-${docsKey}`} /> : null}
        {rightActions}
      </View>
    </View>
  );
}
