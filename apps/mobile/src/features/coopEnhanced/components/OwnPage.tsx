import { useRouter } from 'expo-router';
import { PiggyBank } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import type { PermissionAlias } from '@/lib/permissions';

/**
 * The frame every member cooperative page shares. It answers the three questions before the page's own content: is the cooperatives
 * module on for this plan, does this person have a member profile (the endpoints are keyed on it), and may they see their own cooperative.
 * A page then only has to say what it shows.
 */
export function OwnPage({
  title,
  subject,
  access,
  docsKey,
  refreshing,
  onRefresh,
  keyboard,
  rightActions,
  children,
}: {
  title: string;
  /** What the page shows, for the "needs a member profile" message ("savings", "withdrawals"…). */
  subject: string;
  access: PermissionAlias | PermissionAlias[];
  docsKey?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
  rightActions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const locked = useModuleDisabled('cooperatives');
  const memberId = useMemberId();
  const allowed = useCan(access);
  const back = () => router.back();

  if (locked) return <ModuleLockedScreen title={title} moduleName="Cooperatives" onBack={back} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoMemberProfile subject={subject} />
      </Screen>
    );
  }

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <EmptyState icon={PiggyBank} title="No access" description="You don't have access to this part of your cooperative." />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} refreshing={refreshing} onRefresh={onRefresh} keyboard={keyboard}>
      <ScreenHeader title={title} onBack={back} docsKey={docsKey} rightActions={rightActions} />
      {children}
    </Screen>
  );
}
