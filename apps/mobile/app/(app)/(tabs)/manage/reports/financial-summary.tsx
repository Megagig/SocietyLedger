import { useRouter } from 'expo-router';
import { useState } from 'react';
import { PieChart } from 'react-native-gifted-charts';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DrillFigure } from '@/features/reports/components/Drill';
import { PeriodPicker } from '@/features/reports/components/PeriodPicker';
import { chargesHref, paymentsHref } from '@/features/reports/drill';
import { CATEGORY_TYPE_LABELS, defaultPeriod, percentLabel, rangeParams, type PeriodState } from '@/features/reports/labels';
import { useFinancialSummary, useReportsAccess } from '@/features/reports/queries';
import { formatMoney } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';

/**
 * project-overview.md §6.9 RP2 — Financial summary: the money that came in during a period, and how much of what was charged in it
 * has been paid. Every figure opens the payments or charges that add up to it.
 */
export default function FinancialSummaryScreen() {
  const router = useRouter();
  const { chart, color } = useThemeTokens();
  const allowed = useReportsAccess();
  const [period, setPeriod] = useState<PeriodState>(defaultPeriod());
  const query = useFinancialSummary(rangeParams(period));
  const data = query.data;
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Financial summary" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const range = data ? { startDate: data.period.startDate, endDate: data.period.endDate } : undefined;
  const received = Number(data?.income.total ?? 0);
  const comparison = data?.comparison?.changes.income;
  const slices = (data?.income.byCategory ?? []).filter((c) => Number(c.amount) > 0);

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <ScreenHeader title="Financial summary" onBack={back} docsKey="RP2" />

      <View className="gap-6 pb-8">
        <PeriodPicker value={period} onChange={setPeriod} />

        {query.isPending && rangeParams(period) ? (
          <View className="gap-3">
            <Skeleton width="100%" height={96} radius="md" />
            <Skeleton width="100%" height={96} radius="md" />
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : data && range ? (
          <>
            <Text variant="caption" tone="secondary">
              {data.period.label}
            </Text>

            <Section title="Money received">
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <DrillFigure
                    label="Received in this period"
                    value={received}
                    caption={`${(data.received?.paymentCount ?? 0).toLocaleString('en-NG')} payments`}
                    tone="success"
                    onPress={() => router.push(paymentsHref(range, 'Money received') as never)}
                    testID="rp2-received"
                  />
                </View>
                {comparison ? (
                  <Text variant="caption" tone="secondary" testID="rp2-compare">
                    {`${comparison.percentage >= 0 ? 'Up' : 'Down'} ${percentLabel(Math.abs(comparison.percentage))} on the period before (${formatMoney(data.comparison!.previousPeriod.income)})`}
                  </Text>
                ) : null}
              </View>
            </Section>

            <Section title="Charges raised in this period">
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <DrillFigure
                    label="Charged"
                    value={Number(data.collections.expected)}
                    caption={`${(data.raised?.chargeCount ?? 0).toLocaleString('en-NG')} charges`}
                    onPress={() => router.push(chargesHref({ scope: 'raised', ...range }, 'Charges raised') as never)}
                    testID="rp2-raised"
                  />
                  <DrillFigure
                    label="Paid so far"
                    value={Number(data.collections.collected)}
                    tone="success"
                    onPress={() => router.push(chargesHref({ scope: 'raised', ...range }, 'Paid so far, charge by charge') as never)}
                    testID="rp2-paid"
                  />
                </View>
                <View className="flex-row gap-3">
                  <DrillFigure
                    label="Still owed"
                    value={Number(data.collections.outstanding)}
                    tone="warning"
                    onPress={() => router.push(chargesHref({ scope: 'raised', ...range, owingOnly: true }, 'Still owed') as never)}
                    testID="rp2-owed"
                  />
                  <View className="min-w-[140px] flex-1 justify-center gap-1 rounded-lg border border-border bg-surface p-3 dark:border-transparent">
                    <Text variant="caption" tone="secondary">
                      Collection rate
                    </Text>
                    <Text variant="h3">{percentLabel(data.collections.collectionRate)}</Text>
                    <Text variant="caption" tone="tertiary">
                      of what was charged
                    </Text>
                  </View>
                </View>
              </View>
            </Section>

            <Section title="Where it came from">
              {slices.length === 0 ? (
                <Text variant="body" tone="secondary">
                  No money came in during this period.
                </Text>
              ) : (
                <View className="gap-3">
                  <View className="items-center rounded-lg border border-border bg-surface p-4 dark:border-transparent">
                    <PieChart
                      data={slices.map((s, i) => ({ value: Number(s.amount), color: chart[i % chart.length] }))}
                      donut
                      innerRadius={46}
                      radius={74}
                      innerCircleColor={color.surface}
                      centerLabelComponent={() => (
                        <View className="items-center">
                          <Text variant="caption" tone="secondary">
                            Received
                          </Text>
                          <Money value={received} size="label" />
                        </View>
                      )}
                    />
                  </View>
                  <ListGroup>
                    {slices.map((s, i) => (
                      <ListItem
                        key={s.categoryId}
                        leading={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: chart[i % chart.length] }} />}
                        title={s.categoryName}
                        meta={`${CATEGORY_TYPE_LABELS[s.categoryType] ?? s.categoryType} · ${s.transactionCount} ${s.transactionCount === 1 ? 'payment' : 'payments'} · ${percentLabel((Number(s.amount) / received) * 100)}`}
                        trailing={<Money value={s.amount} size="body-strong" />}
                        showChevron
                        onPress={() => router.push(paymentsHref({ ...range, categoryId: s.categoryId }, s.categoryName) as never)}
                        testID={`rp2-category-${s.categoryId}`}
                      />
                    ))}
                  </ListGroup>
                </View>
              )}
            </Section>

            <Text variant="caption" tone="tertiary">
              Spending is kept in Accounting, not here. Penalties paid by members count as money received.
            </Text>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
