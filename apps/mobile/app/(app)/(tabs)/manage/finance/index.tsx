import { useRouter } from 'expo-router';
import { AlertCircle, BellRing, BookOpen, CalendarClock, Gavel, HandCoins, HandHeart, ListChecks, PlusCircle, Rocket, Tags, Wallet } from 'lucide-react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Pressable, View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { SummaryHero } from '@/components/ui/SummaryHero';
import { DrillFigure } from '@/features/reports/components/Drill';
import { chargeHref, chargesHref, paymentsHref } from '@/features/reports/drill';
import { Text } from '@/components/ui/Text';
import { CHARGE_KIND_LABELS, collectionRate, PAYMENT_METHOD_LABELS } from '@/features/finance/labels';
import { CHARGE_CREATE_ACCESS, FINANCE_VIEW_ACCESS, PAYMENT_RECORD_ACCESS, useChargeStats, useFinanceDashboard } from '@/features/finance/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { ChargeKind, ManualPaymentMethod } from '@/types/api/financeManage';

/** project-overview.md §6.9 FN1 — Finance overview: what was collected this month, what is outstanding, billed by kind, the latest payments. */
export default function FinanceOverviewScreen() {
  const router = useRouter();
  const { color, chart } = useThemeTokens();
  const canView = useCan(FINANCE_VIEW_ACCESS);
  const canCreate = useCan(CHARGE_CREATE_ACCESS);
  const canPay = useCan(PAYMENT_RECORD_ACCESS);
  const dashboard = useFinanceDashboard();
  const stats = useChargeStats();
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/finance/${path}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Finance" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const data = dashboard.data;
  const collected = Number(data?.totals.totalCollected ?? 0);
  const outstanding = Number(data?.totals.totalOutstanding ?? 0);
  const rate = collectionRate(collected, Math.max(0, outstanding));
  const byType = Object.entries(stats.data?.byType ?? {})
    .map(([kind, v]) => ({ kind, amount: Number(v.amount), count: v.count }))
    .filter((t) => t.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const typeTotal = byType.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Screen
      edges={['top']}
      refreshing={dashboard.isRefetching}
      onRefresh={() => {
        void dashboard.refetch();
        void stats.refetch();
      }}
    >
      <ScreenHeader title="Finance" onBack={back} docsKey="FN1" />

      {dashboard.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={170} radius="lg" />
          <Skeleton width="100%" height={180} radius="md" />
        </View>
      ) : dashboard.isError || !data ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <SummaryHero
            icon={Wallet}
            eyebrow="Collected this month"
            stats={[
              { label: 'Billed this month', value: formatMoney(data.thisMonth.transactionsAmount) },
              { label: 'Still outstanding', value: formatMoney(Math.max(0, outstanding)) },
              { label: 'Collection rate', value: `${rate}%` },
            ]}
            testID="finance-hero"
          >
            <Money value={data.thisMonth.paymentsAmount} size="display" tone="onPassbook" />
          </SummaryHero>

          {data.overview.overdueTransactions > 0 ? (
            <View className="flex-row items-center gap-3 rounded-lg bg-warning-soft p-4" testID="finance-overdue">
              <AlertCircle size={22} color={color.warning} strokeWidth={1.75} />
              <View className="flex-1">
                <Text variant="body-strong">{`${data.overview.overdueTransactions} overdue ${data.overview.overdueTransactions === 1 ? 'charge' : 'charges'}`}</Text>
                <Text variant="caption" tone="secondary">
                  Members who have missed their due date.
                </Text>
              </View>
              <Pressable onPress={() => go('transactions?status=overdue')} accessibilityRole="button" hitSlop={8} testID="finance-see-overdue">
                <Text variant="label" tone="primary">
                  See them
                </Text>
              </Pressable>
            </View>
          ) : null}

          {data.thisMonth.startDate && data.thisMonth.endDate ? (
            <Section title="This month, opened up">
              <View className="gap-3" testID="finance-drill">
                <View className="flex-row gap-3">
                  <DrillFigure
                    label="Received"
                    value={Number(data.thisMonth.paymentsAmount)}
                    tone="success"
                    caption={`${data.thisMonth.paymentsReceived} payments`}
                    onPress={() => router.push(paymentsHref({ startDate: data.thisMonth.startDate, endDate: data.thisMonth.endDate }, 'Received this month') as never)}
                    testID="finance-received"
                  />
                  <DrillFigure
                    label="Billed"
                    value={Number(data.thisMonth.transactionsAmount)}
                    caption={`${data.thisMonth.transactionsCreated} charges`}
                    onPress={() => router.push(chargesHref({ scope: 'raised', startDate: data.thisMonth.startDate, endDate: data.thisMonth.endDate }, 'Billed this month') as never)}
                    testID="finance-billed"
                  />
                </View>
                <View className="flex-row gap-3">
                  <DrillFigure
                    label="Still owed (all time)"
                    value={Math.max(0, outstanding)}
                    tone="warning"
                    onPress={() => router.push(chargesHref({ scope: 'owing' }, 'Everything still owed') as never)}
                    testID="finance-owed"
                  />
                </View>
              </View>
            </Section>
          ) : null}

          <Section title="Do">
            <ListGroup>
              <ListItem
                leading={<IconCircle icon={ListChecks} tone="primary" />}
                title="Charges"
                meta="Every due, levy and penalty, and what is paid on it"
                trailing={stats.data ? <Badge tone="neutral">{String(stats.data.totalTransactions)}</Badge> : undefined}
                showChevron
                onPress={() => go('transactions')}
                testID="finance-charges"
              />
              <ListItem
                leading={<IconCircle icon={BellRing} tone={data.overview.overdueTransactions > 0 ? 'warning' : 'primary'} />}
                title="Overdue and reminders"
                meta="Who owes, and remind them"
                trailing={data.overview.overdueTransactions > 0 ? <Badge tone="warning">{`${data.overview.overdueTransactions} overdue`}</Badge> : undefined}
                showChevron
                onPress={() => go('overdue')}
                testID="finance-overdue-link"
              />
              <ListItem leading={<IconCircle icon={BookOpen} tone="primary" />} title="Member ledgers" meta="Each member's statement of account" showChevron onPress={() => go('ledgers')} testID="finance-ledgers" />
              {canCreate ? (
                <ListItem leading={<IconCircle icon={PlusCircle} tone="info" />} title="Charge members" meta="One member, or many at once" showChevron onPress={() => go('transactions/new')} testID="finance-new-charge" />
              ) : null}
              {canCreate ? (
                <ListItem leading={<IconCircle icon={CalendarClock} tone="info" />} title="Generate dues" meta="Charge members their dues in one go" showChevron onPress={() => go('dues')} testID="finance-dues" />
              ) : null}
              <ListItem leading={<IconCircle icon={Rocket} tone="primary" />} title="Levies" meta="Campaigns and special contributions" showChevron onPress={() => go('levies')} testID="finance-levies" />
              <ListItem leading={<IconCircle icon={HandHeart} tone="primary" />} title="Donations" meta="Gifts, pledges, funds and receipts" showChevron onPress={() => go('donations')} testID="finance-donations" />
              <ListItem leading={<IconCircle icon={Gavel} tone="primary" />} title="Penalties" meta="Late fees, fines and waivers" showChevron onPress={() => go('penalties')} testID="finance-penalties" />
              <ListItem leading={<IconCircle icon={Tags} tone="primary" />} title="Categories" meta="The kinds of dues, levies, donations and penalties" showChevron onPress={() => go('categories')} testID="finance-categories" />
              {canPay ? (
                <ListItem leading={<IconCircle icon={HandCoins} tone="info" />} title="Record a payment" meta="Money a member paid you directly" showChevron onPress={() => go('payments/new')} testID="finance-new-payment" />
              ) : null}
            </ListGroup>
          </Section>

          <Section title="Billed by kind">
            {stats.isPending ? (
              <Skeleton width="100%" height={150} radius="lg" />
            ) : byType.length === 0 ? (
              <Text variant="body" tone="secondary">
                Nothing has been billed yet.
              </Text>
            ) : (
              <View className="flex-row items-center gap-4 rounded-lg border border-border bg-surface p-4 dark:border-transparent">
                <PieChart
                  data={byType.map((t, i) => ({ value: t.amount, color: chart[i % chart.length] }))}
                  donut
                  innerRadius={40}
                  radius={64}
                  centerLabelComponent={() => (
                    <View className="items-center">
                      <Text variant="caption" tone="secondary">
                        Billed
                      </Text>
                      <Text variant="label">{formatMoney(typeTotal)}</Text>
                    </View>
                  )}
                />
                <View className="flex-1 gap-2">
                  {byType.map((t, i) => (
                    <Pressable
                      key={t.kind}
                      onPress={() => router.push(chargesHref({ scope: 'raised', categoryType: t.kind as ChargeKind }, CHARGE_KIND_LABELS[t.kind as ChargeKind] ?? t.kind) as never)}
                      accessibilityRole="button"
                      accessibilityLabel={`${CHARGE_KIND_LABELS[t.kind as ChargeKind] ?? t.kind}. Opens the charges.`}
                      className="flex-row items-center gap-2"
                      testID={`finance-kind-${t.kind}`}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: chart[i % chart.length] }} />
                      <Text variant="caption" className="flex-1" numberOfLines={1}>
                        {CHARGE_KIND_LABELS[t.kind as ChargeKind] ?? t.kind}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {Math.round((t.amount / typeTotal) * 100)}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </Section>

          <Section title="Latest payments">
            {data.recentPayments.length === 0 ? (
              <Text variant="body" tone="secondary">
                No payments yet.
              </Text>
            ) : (
              <ListGroup>
                {data.recentPayments.map((p) => (
                  <ListItem
                    key={p.id}
                    title={p.transaction.member ? `${p.transaction.member.firstName} ${p.transaction.member.lastName}`.trim() : 'Member'}
                    meta={`${p.transaction.category?.name ?? 'Payment'} · ${PAYMENT_METHOD_LABELS[p.paymentMethod as ManualPaymentMethod] ?? p.paymentMethod ?? 'Method not stated'} · ${formatDate(p.paymentDate, 'short')}`}
                    trailing={<Money value={p.amountPaid} size="body-strong" />}
                    showChevron={!!p.transactionId}
                    onPress={p.transactionId ? () => router.push(chargeHref(p.transactionId as number) as never) : undefined}
                  />
                ))}
              </ListGroup>
            )}
          </Section>
        </View>
      )}
    </Screen>
  );
}
