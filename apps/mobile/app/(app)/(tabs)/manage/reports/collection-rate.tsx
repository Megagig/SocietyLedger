import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DrillFigure } from '@/features/reports/components/Drill';
import { PeriodPicker } from '@/features/reports/components/PeriodPicker';
import { chargesHref } from '@/features/reports/drill';
import { CATEGORY_TYPE_LABELS, defaultPeriod, percentLabel, rangeParams, type PeriodState } from '@/features/reports/labels';
import { useCollectionRate, useReportsAccess } from '@/features/reports/queries';
import { formatMoney } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { GroupBy } from '@/types/api/reports';

/**
 * project-overview.md §6.9 RP5 — Collection rate: of what was charged, how much has been paid — over time and by category. Every
 * bar and row opens the charges raised in it.
 */
export default function CollectionRateScreen() {
  const router = useRouter();
  const { chart, color } = useThemeTokens();
  const allowed = useReportsAccess();
  const [period, setPeriod] = useState<PeriodState>(defaultPeriod('this_year'));
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const query = useCollectionRate(rangeParams(period), groupBy);
  const data = query.data;
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Collection rate" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const range = data ? { startDate: data.period.startDate, endDate: data.period.endDate } : undefined;
  const bars = (data?.byMonth ?? []).map((m) => ({
    value: Math.round(m.collectionRate * 10) / 10,
    label: groupBy === 'month' ? m.month.slice(0, 3) : m.month,
    frontColor: chart[0],
    onPress: m.startDate && m.endDate ? () => router.push(chargesHref({ scope: 'raised', startDate: m.startDate, endDate: m.endDate }, `${m.month} ${m.year}`) as never) : undefined,
  }));

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <ScreenHeader title="Collection rate" onBack={back} docsKey="RP5" />

      <View className="gap-6 pb-8">
        <PeriodPicker value={period} onChange={setPeriod} />
        <SegmentedControl
          options={[
            { label: 'By month', value: 'month' },
            { label: 'By quarter', value: 'quarter' },
            { label: 'By year', value: 'year' },
          ]}
          value={groupBy}
          onChange={setGroupBy}
        />

        {query.isPending && rangeParams(period) ? (
          <Skeleton width="100%" height={200} radius="md" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : data && range ? (
          <>
            <Text variant="caption" tone="secondary">
              {data.period.label}
            </Text>
            <View className="gap-3">
              <View className="flex-row gap-3">
                <DrillFigure label="Charged" value={Number(data.overall.expected)} onPress={() => router.push(chargesHref({ scope: 'raised', ...range }, 'Charges raised') as never)} testID="rp5-expected" />
                <DrillFigure label="Paid so far" value={Number(data.overall.collected)} tone="success" onPress={() => router.push(chargesHref({ scope: 'raised', ...range }, 'Paid so far, charge by charge') as never)} testID="rp5-collected" />
              </View>
              <View className="flex-row gap-3">
                <DrillFigure label="Still owed" value={Number(data.overall.outstanding)} tone="warning" onPress={() => router.push(chargesHref({ scope: 'raised', ...range, owingOnly: true }, 'Still owed') as never)} testID="rp5-owed" />
                <View className="min-w-[140px] flex-1 justify-center gap-1 rounded-lg border border-border bg-surface p-3 dark:border-transparent">
                  <Text variant="caption" tone="secondary">
                    Collection rate
                  </Text>
                  <Text variant="h3">{percentLabel(data.overall.collectionRate)}</Text>
                </View>
              </View>
            </View>

            {bars.length > 0 ? (
              <Section title="Over time">
                <View className="gap-3">
                  <View className="overflow-hidden rounded-lg border border-border bg-surface p-4 dark:border-transparent">
                    <BarChart
                      data={bars}
                      barWidth={26}
                      spacing={14}
                      roundedTop
                      hideRules
                      maxValue={100}
                      noOfSections={4}
                      yAxisLabelSuffix="%"
                      xAxisColor={color.border}
                      yAxisColor={color.border}
                      xAxisLabelTextStyle={{ color: color.textSecondary, fontSize: 10 }}
                      yAxisTextStyle={{ color: color.textSecondary, fontSize: 9 }}
                    />
                  </View>
                  <ListGroup>
                    {data.byMonth.map((m) => (
                      <ListItem
                        key={m.key ?? `${m.year}-${m.month}`}
                        title={`${m.month} ${m.year}`}
                        meta={`Paid ${formatMoney(m.collected)} of ${formatMoney(m.expected)}`}
                        trailing={<Text variant="body-strong">{percentLabel(m.collectionRate)}</Text>}
                        showChevron
                        onPress={
                          m.startDate && m.endDate
                            ? () => router.push(chargesHref({ scope: 'raised', startDate: m.startDate, endDate: m.endDate }, `${m.month} ${m.year}`) as never)
                            : undefined
                        }
                        testID={`rp5-group-${m.key ?? m.month}`}
                      />
                    ))}
                  </ListGroup>
                </View>
              </Section>
            ) : (
              <Text variant="body" tone="secondary">
                Nothing was charged in this period.
              </Text>
            )}

            {data.byCategory.length > 0 ? (
              <Section title="By category">
                <ListGroup>
                  {data.byCategory.map((c) => (
                    <ListItem
                      key={c.categoryId}
                      title={c.categoryName}
                      meta={`${CATEGORY_TYPE_LABELS[c.categoryType] ?? c.categoryType} · owed ${formatMoney(Math.max(0, Number(c.expected) - Number(c.collected)))}`}
                      trailing={
                        <View className="items-end">
                          <Text variant="body-strong">{percentLabel(c.collectionRate)}</Text>
                          <Money value={c.collected} size="caption" tone="secondary" />
                        </View>
                      }
                      showChevron
                      onPress={() => router.push(chargesHref({ scope: 'raised', ...range, categoryId: c.categoryId }, c.categoryName) as never)}
                      testID={`rp5-category-${c.categoryId}`}
                    />
                  ))}
                </ListGroup>
              </Section>
            ) : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}
