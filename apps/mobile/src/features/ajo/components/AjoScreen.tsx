import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useCan } from '@/hooks/useCan';
import type { PermissionAlias } from '@/lib/permissions';
import { tokens } from '@/theme/tokens';
import { AjoGate } from './AjoGate';

export type AjoScreenProps = {
  title: string;
  /** Who may open this screen. Without it the Ajo gate alone decides. The server checks every request again. */
  access?: PermissionAlias[];
  children: ReactNode;
  onBack?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Right-hand header actions. */
  rightActions?: ReactNode;
  /** The screen manages its own scrolling or has a sticky footer: pass false. */
  scroll?: boolean;
  keyboard?: boolean;
  docsKey?: string;
};

/**
 * The frame every Ajo screen shares: header with a back button, the permission check, and the Ajo gate that draws the loading,
 * locked, not-allowed and read-only states. Screens put their content inside.
 */
export function AjoScreen({ title, access, children, onBack, refreshing, onRefresh, rightActions, scroll = true, keyboard, docsKey }: AjoScreenProps) {
  const router = useRouter();
  const allowed = useCan(access ?? ['AJO_VIEW_OWN', 'AJO_COLLECT', 'AJO_MANAGE', 'AJO_RECONCILE', 'AJO_APPROVE_PAYOUT', 'AJO_REPORTS']);
  const back = onBack ?? (router.canGoBack() ? () => router.back() : undefined);

  return (
    <Screen edges={['top']} scroll={scroll} refreshing={refreshing} onRefresh={onRefresh} keyboard={keyboard}>
      <ScreenHeader title={title} onBack={back} rightActions={rightActions} docsKey={docsKey} />
      {allowed ? (
        <AjoGate>
          <View className="gap-5" style={{ paddingBottom: tokens.layout.tabBarHeight + 24 }}>
            {children}
          </View>
        </AjoGate>
      ) : (
        <NoPermission />
      )}
    </Screen>
  );
}
