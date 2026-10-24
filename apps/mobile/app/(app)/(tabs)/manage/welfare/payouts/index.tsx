import { useRouter } from 'expo-router';
import { HandHeart } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { PayoutRow } from '@/features/welfareManage/components/Rows';
import { PAYOUT_FILTERS } from '@/features/welfareManage/labels';
import { useAdminPayouts, WELFARE_MODULE, WELFARE_PAYOUT_ACCESS } from '@/features/welfareManage/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { OfficerPayoutDTO, PayoutStatus } from '@/types/api/welfareManage';

/** project-overview.md §6.9 WF4 — payout requests: the ones waiting for a decision first, then the approved ones to pay out. */
export default function PayoutsScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(WELFARE_PAYOUT_ACCESS, WELFARE_MODULE);
  const [status, setStatus] = useState<PayoutStatus | ''>('PENDING');
  const query = useAdminPayouts({ status: status || undefined });
  const requests = useMemo(() => query.data?.pages.flatMap((p) => p.requests) ?? [], [query.data]);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Payout requests" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Payout requests" onBack={back} docsKey="WF4" />

      <View className="pb-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PAYOUT_FILTERS.map((f) => (
            <FilterChip key={f.label} label={f.label} active={status === f.value} onPress={() => setStatus(f.value)} />
          ))}
        </ScrollView>
      </View>

      <PagedList
        query={query}
        items={requests}
        keyOf={(r) => String(r.id)}
        skeletonHeight={84}
        renderItem={(r: OfficerPayoutDTO, i, n) => (
          <PayoutRow item={r} position={positionOf(i, n)} onPress={(request) => router.push(`/(app)/(tabs)/manage/welfare/payouts/${request.id}` as never)} />
        )}
        empty={
          <EmptyState
            icon={HandHeart}
            title={status === 'PENDING' ? 'Nothing waiting' : 'No requests here'}
            description={status === 'PENDING' ? 'When a member asks a welfare fund for help, the request shows up here for you to decide.' : 'Try another filter.'}
          />
        }
      />
    </Screen>
  );
}
