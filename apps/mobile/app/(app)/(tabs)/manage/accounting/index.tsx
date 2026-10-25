import { useRouter } from 'expo-router';
import { BookOpen, CalendarRange, FileBarChart, Landmark, ListTree, PiggyBank, RefreshCw, RefreshCcw } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconCircle } from '@/components/ui/IconCircle';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { SummaryHero } from '@/components/ui/SummaryHero';
import { Text } from '@/components/ui/Text';
import { EntryRow, PlanBar, SyncErrorRow } from '@/features/accounting/components/Rows';
import { TrendChart } from '@/features/accounting/components/TrendChart';
import { ACCOUNTING_APPROVE_ACCESS, ACCOUNTING_EDIT_ACCESS, ledgerHref, monthRange } from '@/features/accounting/labels';
import { useRunSync } from '@/features/accounting/mutations';
import { useAccountingAccess, useAccountingDashboard, useSyncErrors, useSyncStatus } from '@/features/accounting/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';

/** project-overview.md §6.9 AC1 — the books at a glance: cash, what is owned and owed, the last six months, and what needs an officer. */
export default function AccountingDashboardScreen() {
  const router = useRouter();
  const allowed = useAccountingAccess();
  const canSync = useCan(ACCOUNTING_EDIT_ACCESS);
  const canApprove = useCan(ACCOUNTING_APPROVE_ACCESS);
  const dashboard = useAccountingDashboard();
  const sync = useRunSync();
  const syncStatus = useSyncStatus().data;
  const syncErrors = useSyncErrors().data ?? [];
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/accounting/${path}` as never);
  // The big figures open the entries behind them: what stood in each account up to now, or this year's statement
  const toNow = () => ({ to: new Date().toISOString(), datesLabel: 'Up to now' });
  const openCash = () => router.push(ledgerHref({ scope: 'cash', title: 'Cash and bank', ...toNow() }) as never);
  const openOwned = () => router.push(ledgerHref({ scope: 'ASSET', title: 'What is owned', ...toNow() }) as never);
  const openOwed = () => router.push(ledgerHref({ scope: 'LIABILITY', title: 'What is owed', ...toNow() }) as never);
  const openSurplus = () => router.push('/(app)/(tabs)/manage/accounting/statements?view=income&period=this_year' as never);
  const openMonth = (month: string) => {
    const range = monthRange(month);
    if (range) router.push(`/(app)/(tabs)/manage/accounting/statements?view=income&period=custom&startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}` as never);
  };

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Accounting" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const data = dashboard.data;
  const unsynced = syncStatus?.overall.unsynced ?? 0;

  const runSync = () =>
    sync.mutate(undefined, {
      onSuccess: ({ synced, failed }) => (failed > 0 ? toast.error(`${synced} entered in the books, ${failed} could not be entered`) : toast.success(synced === 0 ? 'Nothing was missing' : `${synced} entered in the books`)),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not catch up the books. Try again.'),
    });

  return (
    <Screen edges={['top']} refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()}>
      <ScreenHeader title="Accounting" onBack={back} docsKey="AC1" />

      {dashboard.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={170} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : dashboard.isError || !data ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <SummaryHero
            icon={Landmark}
            eyebrow="Cash and bank"
            stats={[
              { label: 'Owned', value: formatMoney(data.quickStats.totalAssets), onPress: openOwned },
              { label: 'Owed', value: formatMoney(data.quickStats.totalLiabilities), onPress: openOwed },
              { label: 'Surplus this year', value: formatMoney(data.quickStats.netIncome), onPress: openSurplus },
            ]}
            onPress={openCash}
            testID="accounting-hero"
          >
            <Money value={data.quickStats.cashBalance} size="display" tone="onPassbook" />
          </SummaryHero>

          {data.pendingApprovals > 0 || unsynced > 0 ? (
            <Section title="Needs attention">
              <ListGroup>
                {data.pendingApprovals > 0 ? (
                  <ListItem
                    leading={<IconCircle icon={BookOpen} tone="warning" />}
                    title="Entries waiting for approval"
                    meta={canApprove ? 'Open them to approve or reject' : 'An officer who can approve needs to look at them'}
                    trailing={<Badge tone="warning">{String(data.pendingApprovals)}</Badge>}
                    showChevron
                    onPress={() => router.push({ pathname: '/(app)/(tabs)/manage/accounting/journal', params: { status: 'PENDING_APPROVAL' } } as never)}
                    testID="accounting-pending"
                  />
                ) : null}
                {unsynced > 0 ? (
                  <ListItem
                    leading={<IconCircle icon={RefreshCw} tone="warning" />}
                    title="Not in the books yet"
                    meta={`${unsynced} ${unsynced === 1 ? 'record' : 'records'} from payments, welfare or savings`}
                    onPress={() => go('sync')}
                    trailing={
                      canSync ? (
                        <Button variant="soft" size="sm" loading={sync.isPending} onPress={runSync} testID="accounting-sync">
                          Catch up
                        </Button>
                      ) : undefined
                    }
                    testID="accounting-unsynced"
                  />
                ) : null}
              </ListGroup>
            </Section>
          ) : null}

          {syncErrors.length > 0 ? (
            <Section title="Could not be entered">
              <View testID="sync-errors">
                {syncErrors.slice(0, 5).map((e, i, all) => (
                  <SyncErrorRow key={e.id} item={e} position={positionOf(i, all.length)} />
                ))}
              </View>
              {syncErrors.length > 5 ? (
                <Text variant="caption" tone="secondary">
                  and {syncErrors.length - 5} more
                </Text>
              ) : null}
            </Section>
          ) : null}

          <Section title="Last six months">
            <TrendChart points={data.monthlyTrend} onSelectMonth={openMonth} />
          </Section>

          {data.budgetStatus ? (
            <Section title="Spending against the budget">
              <Pressable
                disabled={!data.budgetStatus.budgetId}
                onPress={() => router.push({ pathname: '/(app)/(tabs)/manage/accounting/budgets/[id]', params: { id: String(data.budgetStatus?.budgetId) } } as never)}
                accessibilityRole="button"
                accessibilityLabel="Spending against the budget. Opens the budget."
                className="gap-2 rounded-lg border border-border bg-surface p-4 dark:border-transparent"
                testID="accounting-budget"
              >
                <PlanBar
                  label="Spending against the budget"
                  actual={data.budgetStatus.totalSpent}
                  budget={data.budgetStatus.totalBudget}
                  percent={data.budgetStatus.percentUsed}
                  over={data.budgetStatus.percentUsed > 100}
                />
              </Pressable>
            </Section>
          ) : null}

          <Section title="The books">
            <ListGroup>
              <ListItem leading={<IconCircle icon={BookOpen} tone="primary" />} title="Journal entries" meta="Write, approve and post entries" showChevron onPress={() => go('journal')} testID="accounting-journal" />
              <ListItem leading={<IconCircle icon={ListTree} tone="primary" />} title="Chart of accounts" meta="Every account and what it holds" showChevron onPress={() => go('accounts')} testID="accounting-accounts" />
              <ListItem leading={<IconCircle icon={FileBarChart} tone="primary" />} title="Financial statements" meta="Income, balance sheet and cash flow" showChevron onPress={() => go('statements')} testID="accounting-statements" />
              <ListItem leading={<IconCircle icon={PiggyBank} tone="primary" />} title="Budgets" meta="Plan the year and see how you are doing" showChevron onPress={() => go('budgets')} testID="accounting-budgets" />
              <ListItem leading={<IconCircle icon={RefreshCcw} tone={unsynced > 0 ? 'warning' : 'primary'} />} title="Sync status" meta="What has reached the books, kind by kind" showChevron onPress={() => go('sync')} testID="accounting-sync-status" />
              <ListItem leading={<IconCircle icon={CalendarRange} tone="primary" />} title="Accounting periods" meta="Close a month or a year once it is settled" showChevron onPress={() => go('periods')} testID="accounting-periods" />
            </ListGroup>
          </Section>

          <Section title="Latest entries" onSeeAll={() => go('journal')}>
            {data.recentEntries.length === 0 ? (
              <Text variant="body" tone="secondary">
                No entries yet.
              </Text>
            ) : (
              <View>
                {data.recentEntries.map((entry, i) => (
                  <EntryRow key={entry.id} item={entry} position={positionOf(i, data.recentEntries.length)} onPress={(item) => router.push({ pathname: '/(app)/(tabs)/manage/accounting/journal/[id]', params: { id: String(item.id) } } as never)} />
                ))}
              </View>
            )}
          </Section>
        </View>
      )}
    </Screen>
  );
}
