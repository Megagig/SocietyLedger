import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Receipt } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { OptionDropdown } from '@/components/forms/OptionDropdown';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { ACCOUNTING_CREATE_ACCESS } from '@/features/accounting/labels';
import { useAccountingAccess } from '@/features/accounting/queries';
import { ExpenseRow } from '@/features/expenses/components/ExpenseParts';
import { EXPENSE_FILTER_OPTIONS } from '@/features/expenses/labels';
import { useExpensesInfinite } from '@/features/expenses/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useCan } from '@/hooks/useCan';
import type { ExpenseDTO, ExpenseStatus } from '@/types/api/expenses';

const STATUSES = EXPENSE_FILTER_OPTIONS.map((o) => o.value);

/** project-overview.md §6.9 — every expense voucher, newest first, by where it stands. Tap one to read it, approve it or void it. */
export default function ExpensesListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const allowed = useAccountingAccess();
  const canCreate = useCan(ACCOUNTING_CREATE_ACCESS);
  const [status, setStatus] = useState<ExpenseStatus | 'ALL'>(STATUSES.includes(params.status as ExpenseStatus) ? (params.status as ExpenseStatus) : 'ALL');
  const [search, setSearch] = useState('');
  const query = useExpensesInfinite(status, search.trim());
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.vouchers) ?? [], [query.data]);
  const totals = query.data?.pages[0]?.totals;
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Expenses" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const filtered = status !== 'ALL' || search.trim() !== '';

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Expenses"
        onBack={back}
        docsKey="AC7"
        rightActions={canCreate ? <IconButton icon={Plus} accessibilityLabel="Record an expense" onPress={() => router.push('/(app)/(tabs)/manage/accounting/expenses/form' as never)} testID="expense-new" /> : undefined}
      />
      <View className="gap-3 pb-3">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search by payee, number or description" testID="expense-search" />
        <View className="flex-row">
          <OptionDropdown label="Show" value={status} options={EXPENSE_FILTER_OPTIONS.map((o) => ({ label: o.label, value: o.value }))} onChange={(v) => setStatus(v as ExpenseStatus | 'ALL')} testID="expense-status" />
        </View>
      </View>
      <PagedList
        query={query}
        items={items}
        keyOf={(e) => String(e.id)}
        skeletonHeight={84}
        header={
          totals ? (
            <View className="mb-3 flex-row justify-between gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="expense-totals">
              <View className="gap-0.5">
                <Text variant="caption" tone="secondary">
                  {`Approved (${totals.approvedCount})`}
                </Text>
                <Money value={totals.approvedAmount} size="body-strong" />
              </View>
              <View className="items-end gap-0.5">
                <Text variant="caption" tone="secondary">
                  Waiting for approval
                </Text>
                <Text variant="body-strong">{String(totals.waitingForApproval)}</Text>
              </View>
            </View>
          ) : undefined
        }
        renderItem={(e: ExpenseDTO, i, n) => (
          <ExpenseRow item={e} position={positionOf(i, n)} onPress={(item) => router.push({ pathname: '/(app)/(tabs)/manage/accounting/expenses/[id]', params: { id: String(item.id) } } as never)} />
        )}
        empty={
          <EmptyState
            icon={Receipt}
            title={filtered ? 'No expenses match' : 'No expenses yet'}
            description={filtered ? 'Try another word or another status.' : 'Record spending once it is paid, with the receipt. A second officer approves it, and then it is in the books.'}
            actionLabel={!filtered && canCreate ? 'Record an expense' : undefined}
            onAction={!filtered && canCreate ? () => router.push('/(app)/(tabs)/manage/accounting/expenses/form' as never) : undefined}
          />
        }
      />
    </Screen>
  );
}
