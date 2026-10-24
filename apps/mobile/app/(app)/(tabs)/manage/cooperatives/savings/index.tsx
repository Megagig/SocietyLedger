import { useRouter } from 'expo-router';
import { PiggyBank, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { StatTile } from '@/components/ui/StatTile';
import { AccountRow } from '@/features/coopManage/components/Rows';
import { COOP_MODULE, COOP_SAVINGS_ACCESS, useAccounts, useCoopDashboard } from '@/features/coopManage/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';
import type { OfficerSavingsAccountDTO } from '@/types/api/coopManage';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Dormant', value: 'DORMANT' },
  { label: 'Closed', value: 'CLOSED' },
];

/** project-overview.md §6.9 CP2 — every member's savings account: search, filter, open a new one, and see its balance. */
export default function SavingsAccountsScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(COOP_SAVINGS_ACCESS, COOP_MODULE);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const term = search.trim();
  const query = useAccounts({ status: status || undefined, search: term || undefined });
  const summary = useCoopDashboard().data?.savingsSummary;
  const accounts = useMemo(() => query.data?.pages.flatMap((p) => p.accounts) ?? [], [query.data]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/cooperatives/savings/${path}` as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Savings accounts" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const filtered = status !== '' || term !== '';

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Savings accounts" onBack={back} docsKey="CP2" rightActions={<IconButton icon={Plus} accessibilityLabel="Open an account" onPress={() => go('open')} testID="savings-open" />} />

      <View className="gap-3 pb-3">
        {summary ? (
          <View className="flex-row gap-2">
            <StatTile label="Saved" value={formatMoney(summary.totalBalance)} tone="success" />
            <StatTile label="In this month" value={formatMoney(summary.totalDepositsThisMonth)} tone="info" />
            <StatTile label="Out this month" value={formatMoney(summary.totalWithdrawalsThisMonth)} tone="warning" />
          </View>
        ) : null}
        <SearchField value={search} onChangeText={setSearch} placeholder="Search member or account number" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map((s) => (
            <FilterChip key={s.value || 'all'} label={s.label} active={status === s.value} onPress={() => setStatus(status === s.value ? '' : s.value)} />
          ))}
        </ScrollView>
      </View>

      <PagedList
        query={query}
        items={accounts}
        keyOf={(a) => String(a.id)}
        renderItem={(a: OfficerSavingsAccountDTO, i, n) => <AccountRow item={a} position={positionOf(i, n)} onPress={(account) => go(String(account.id))} />}
        empty={
          <EmptyState
            icon={PiggyBank}
            title={filtered ? 'No accounts match' : 'No savings accounts yet'}
            description={filtered ? 'Try clearing a filter or a different search.' : 'Open an account for a member, then record their deposits here.'}
            actionLabel={!filtered ? 'Open an account' : undefined}
            onAction={!filtered ? () => go('open') : undefined}
          />
        }
      />
    </Screen>
  );
}
