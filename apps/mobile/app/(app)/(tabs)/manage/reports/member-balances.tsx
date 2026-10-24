import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { GroupedRow, positionOf, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { DrillFigure } from '@/features/reports/components/Drill';
import { OptionDropdown } from '@/features/reports/components/OptionDropdown';
import { chargesHref } from '@/features/reports/drill';
import { MEMBER_FILTER_OPTIONS } from '@/features/reports/labels';
import { useMemberBalances, useReportsAccess } from '@/features/reports/queries';
import { formatDate } from '@/lib/dates';
import type { MemberBalanceDTO } from '@/types/api/reports';

type Sort = 'balance' | 'name' | 'lastPayment';
const SORTS: { label: string; value: Sort }[] = [
  { label: 'Owes most', value: 'balance' },
  { label: 'Name', value: 'name' },
  { label: 'Paid longest ago', value: 'lastPayment' },
];

function MemberRow({ item, position, onPress }: { item: MemberBalanceDTO; position: RowPosition; onPress: (m: MemberBalanceDTO) => void }) {
  const owes = Number(item.balance) > 0;
  return (
    <GroupedRow position={position} onPress={() => onPress(item)} accessibilityLabel={`${item.firstName} ${item.lastName}, owes ${item.balance}`} testID={`balance-row-${item.memberId}`} minHeight={76}>
      <View className="gap-1">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" numberOfLines={1}>{`${item.firstName} ${item.lastName}`}</Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {item.memberNumber}
            </Text>
          </View>
          <View className="items-end gap-1">
            <Money value={item.balance} size="body-strong" tone={owes ? 'warning' : 'default'} />
            {item.overdueTransactions > 0 ? <StatusChip status="overdue" label={`${item.overdueTransactions} overdue`} /> : null}
          </View>
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {item.lastPaymentDate ? `Last paid ${formatDate(item.lastPaymentDate, 'long')}` : 'Has not paid yet'}
        </Text>
      </View>
    </GroupedRow>
  );
}

/**
 * project-overview.md §6.9 RP3 — Member balances: what each active member has been charged, paid and still owes. A member opens the
 * charges they owe; the figures at the top open every charge that is owed, or overdue.
 */
export default function MemberBalancesScreen() {
  const router = useRouter();
  const allowed = useReportsAccess();
  const [status, setStatus] = useState<'all' | 'with_balance' | 'overdue'>('with_balance');
  const [sort, setSort] = useState<Sort>('balance');
  const [search, setSearch] = useState('');
  const query = useMemberBalances({ status, sortBy: sort, sortOrder: sort === 'name' || sort === 'lastPayment' ? 'asc' : 'desc', search: search.trim() || undefined });
  const members = useMemo(() => query.data?.pages.flatMap((p) => p.members) ?? [], [query.data]);
  const totals = query.data?.pages[0]?.totals;
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Member balances" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Member balances" onBack={back} docsKey="RP3" />

      <View className="gap-3 pb-3">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search name, ID or email" />
        <View className="flex-row gap-3">
          <OptionDropdown label="Show" value={status} options={MEMBER_FILTER_OPTIONS} onChange={setStatus} testID="rp3-show" />
          <OptionDropdown label="Sort by" value={sort} options={SORTS} onChange={setSort} testID="rp3-sort" />
        </View>
      </View>

      <PagedList
        query={query}
        items={members}
        keyOf={(m) => String(m.memberId)}
        skeletonHeight={76}
        header={
          totals ? (
            <View className="mb-3 gap-3" testID="rp3-totals">
              <View className="flex-row gap-3">
                <DrillFigure
                  label="Still owed by the members shown"
                  value={Number(totals.balance)}
                  tone="warning"
                  caption={`${totals.memberCount.toLocaleString('en-NG')} members in this list`}
                  onPress={search.trim() || status === 'overdue' ? undefined : () => router.push(chargesHref({ scope: 'owing' }, 'Everything still owed') as never)}
                  testID="rp3-owed"
                />
                <DrillFigure
                  label="Overdue charges"
                  value={totals.overdueCharges}
                  format="count"
                  caption="Past their due date"
                  onPress={() => router.push(chargesHref({ scope: 'overdue' }, 'Overdue charges') as never)}
                  testID="rp3-overdue"
                />
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-0.5 rounded-lg border border-border bg-surface p-3 dark:border-transparent">
                  <Text variant="caption" tone="secondary">Charged</Text>
                  <Money value={totals.totalDues} size="body-strong" />
                </View>
                <View className="flex-1 gap-0.5 rounded-lg border border-border bg-surface p-3 dark:border-transparent">
                  <Text variant="caption" tone="secondary">Paid</Text>
                  <Money value={totals.totalPaid} size="body-strong" tone="success" />
                </View>
              </View>
            </View>
          ) : undefined
        }
        renderItem={(m: MemberBalanceDTO, i, n) => (
          <MemberRow
            item={m}
            position={positionOf(i, n)}
            onPress={(item) => router.push(chargesHref({ scope: 'owing', memberId: item.memberId }, `${item.firstName} ${item.lastName}`) as never)}
          />
        )}
        empty={<EmptyState icon={Users} title="No members here" description={search || status !== 'all' ? 'Try another filter.' : 'There are no members to show.'} />}
      />
    </Screen>
  );
}
