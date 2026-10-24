import { useRouter } from 'expo-router';
import { PiggyBank, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { OptionDropdown } from '@/components/forms/OptionDropdown';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { BudgetRow } from '@/features/accounting/components/Rows';
import { ACCOUNTING_CREATE_ACCESS, BUDGET_STATUS_LABELS } from '@/features/accounting/labels';
import { useAccountingAccess, useBudgetsInfinite } from '@/features/accounting/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useCan } from '@/hooks/useCan';
import type { BudgetDTO, BudgetStatus } from '@/types/api/accounting';

const STATUS_OPTIONS: { label: string; value: BudgetStatus | 'ALL' }[] = [
  { label: 'All budgets', value: 'ALL' },
  ...(['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED'] as BudgetStatus[]).map((value) => ({ label: BUDGET_STATUS_LABELS[value], value })),
];

const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [{ label: 'All years', value: 'ALL' }, ...[THIS_YEAR + 1, THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2, THIS_YEAR - 3].map((y) => ({ label: String(y), value: String(y) }))];

/** project-overview.md §6.9 AC6 — the association's budgets by year. Tap one to see how the money is doing against the plan. */
export default function BudgetsScreen() {
  const router = useRouter();
  const allowed = useAccountingAccess();
  const canCreate = useCan(ACCOUNTING_CREATE_ACCESS);
  const [status, setStatus] = useState<BudgetStatus | 'ALL'>('ALL');
  const [year, setYear] = useState('ALL');
  const query = useBudgetsInfinite(status, year === 'ALL' ? undefined : Number(year));
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.budgets) ?? [], [query.data]);
  const back = () => router.back();
  const openForm = () => router.push('/(app)/(tabs)/manage/accounting/budgets/form' as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Budgets" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Budgets" onBack={back} docsKey="AC6" rightActions={canCreate ? <IconButton icon={Plus} accessibilityLabel="Plan a budget" onPress={openForm} testID="budgets-new" /> : undefined} />
      <View className="flex-row gap-3 pb-3">
        <OptionDropdown label="Show" value={status} options={STATUS_OPTIONS} onChange={(v) => setStatus(v as BudgetStatus | 'ALL')} testID="budgets-status" />
        <OptionDropdown label="Year" value={year} options={YEAR_OPTIONS} onChange={setYear} testID="budgets-year" />
      </View>
      <PagedList
        query={query}
        items={items}
        keyOf={(b) => String(b.id)}
        skeletonHeight={72}
        renderItem={(b: BudgetDTO, i, n) => <BudgetRow item={b} position={positionOf(i, n)} onPress={(item) => router.push({ pathname: '/(app)/(tabs)/manage/accounting/budgets/[id]', params: { id: String(item.id) } } as never)} />}
        empty={
          <EmptyState
            icon={PiggyBank}
            title={status === 'ALL' && year === 'ALL' ? 'No budgets yet' : 'No budgets here'}
            description={status === 'ALL' && year === 'ALL' ? 'A budget plans the year’s income and spending, line by line, so you can see how you are doing.' : 'Try another filter.'}
            actionLabel={canCreate && status === 'ALL' && year === 'ALL' ? 'Plan a budget' : undefined}
            onAction={canCreate && status === 'ALL' && year === 'ALL' ? openForm : undefined}
          />
        }
      />
    </Screen>
  );
}
