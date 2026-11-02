import { useLocalSearchParams, useRouter } from 'expo-router';

import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { CashbookView } from '@/features/coopEnhanced/components/CashbookView';
import { COOP_MODULE } from '@/features/coopEnhanced/queries';
import { COOP_SAVINGS_ACCESS } from '@/features/coopManage/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';

/** An officer opening one member's cashbook: the same statement the member sees on their own page. Needs the savings-manage permission. */
export default function MemberCashbookScreen() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const allowed = useModuleAccess(COOP_SAVINGS_ACCESS, COOP_MODULE);
  const id = Number(memberId);

  if (!allowed || !id) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Member cashbook" onBack={() => router.back()} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Member cashbook" onBack={() => router.back()} />
      <CashbookView memberId={id} filename={`member-${id}-cashbook`} />
    </Screen>
  );
}
