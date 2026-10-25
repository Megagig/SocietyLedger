import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import type { PermissionAlias } from '@/lib/permissions';
import { useCan } from '@/hooks/useCan';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { AI_MODULE, AI_VIEW_ACCESS } from '@/features/ai/labels';

/** The assistant is for officers who can read the finances, on a plan that includes it. Anyone else sees why, not a broken screen. */
export function AiGate({ title, children, also }: { title: string; children: ReactNode; also?: PermissionAlias }) {
  const router = useRouter();
  const permitted = useCan(AI_VIEW_ACCESS);
  const alsoPermitted = useCan(also ?? AI_VIEW_ACCESS);
  const off = useModuleDisabled(AI_MODULE);
  if (off) return <ModuleLockedScreen title={title} moduleName="AI assistant" onBack={() => router.back()} />;
  if (!permitted || !alsoPermitted) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={() => router.back()} />
        <NoPermission />
      </Screen>
    );
  }
  return <>{children}</>;
}
