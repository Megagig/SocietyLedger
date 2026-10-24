import { useRouter } from 'expo-router';
import { PiggyBank, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { FundRow } from '@/features/welfareManage/components/Rows';
import { FUND_STATUS_OPTIONS } from '@/features/welfareManage/labels';
import { WELFARE_MANAGE_ACCESS, WELFARE_MODULE, useAdminFunds } from '@/features/welfareManage/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { FundStatus, OfficerFundDTO } from '@/types/api/welfareManage';

/** project-overview.md §6.9 WF2 — every welfare fund: its balance, target and payout rules. */
export default function FundsScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(WELFARE_MANAGE_ACCESS, WELFARE_MODULE);
  const [status, setStatus] = useState<FundStatus | ''>('');
  const query = useAdminFunds({ status: status || undefined });
  const funds = useMemo(() => query.data?.pages.flatMap((p) => p.funds) ?? [], [query.data]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/welfare/funds/${path}` as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Funds" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Funds" onBack={back} docsKey="WF2" rightActions={<IconButton icon={Plus} accessibilityLabel="Add a fund" onPress={() => go('form')} testID="funds-new" />} />

      <View className="pb-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="All" active={status === ''} onPress={() => setStatus('')} />
          {FUND_STATUS_OPTIONS.map((s) => (
            <FilterChip key={s.value} label={s.label} active={status === s.value} onPress={() => setStatus(status === s.value ? '' : s.value)} />
          ))}
        </ScrollView>
      </View>

      <PagedList
        query={query}
        items={funds}
        keyOf={(f) => String(f.id)}
        skeletonHeight={92}
        renderItem={(f: OfficerFundDTO, i, n) => <FundRow item={f} position={positionOf(i, n)} onPress={(fund) => go(`form?id=${fund.id}`)} />}
        empty={
          <EmptyState
            icon={PiggyBank}
            title={status ? 'No funds match' : 'No welfare funds yet'}
            description={status ? 'Try another filter.' : 'A fund is a pot members contribute to and can ask for help from, like a bereavement or medical fund.'}
            actionLabel={!status ? 'Add a fund' : undefined}
            onAction={!status ? () => go('form') : undefined}
          />
        }
      />
    </Screen>
  );
}
