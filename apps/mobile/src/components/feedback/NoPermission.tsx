import { View } from 'react-native';
import { router } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type NoPermissionProps = {
  /** Defaults to `router.replace('/')` — overridable so this stays a plain presentational component for tests/stories. */
  onGoHome?: () => void;
};

/** ui-rules.md §5.11 — only reachable via deep link. */
export function NoPermission({ onGoHome }: NoPermissionProps) {
  const { color } = useThemeTokens();
  return (
    <View className="items-center gap-3 px-8 py-12">
      <ShieldAlert size={48} color={color.textTertiary} strokeWidth={1.5} />
      <Text variant="h3" align="center">
        You don&apos;t have access to this page.
      </Text>
      <Button variant="primary" onPress={onGoHome ?? (() => router.replace('/'))}>
        Go home
      </Button>
    </View>
  );
}
