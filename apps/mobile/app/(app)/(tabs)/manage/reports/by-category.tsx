import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/FilterChip';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { PeriodPicker } from '@/features/reports/components/PeriodPicker';
import { chargeHref, chargesHref } from '@/features/reports/drill';
import { CATEGORY_TYPE_LABELS, CHARGE_STATUS_LABELS, chargeStatusKey, defaultPeriod, percentLabel, rangeParams, STATUS_FILTER_ORDER, type PeriodState } from '@/features/reports/labels';
import { useCategoryReport, useReportsAccess } from '@/features/reports/queries';
import type { ChargeCategoryType } from '@/types/api/reports';

const TYPES: { label: string; value: ChargeCategoryType | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Dues', value: 'due' },
  { label: 'Levies', value: 'levy' },
  { label: 'Donations', value: 'donation' },
  { label: 'Penalties', value: 'penalty' },
];

/**
 * project-overview.md §6.9 RP6 — By category: for each kind of charge, how much was charged, paid and is owed, and how many charges
 * are in each state. Every count opens those charges; every recent charge opens the charge.
 */
export default function ByCategoryScreen() {
  const router = useRouter();
  const allowed = useReportsAccess();
  const [period, setPeriod] = useState<PeriodState>(defaultPeriod('this_year'));
  const [type, setType] = useState<ChargeCategoryType | ''>('');
  const query = useCategoryReport(rangeParams(period), type);
  const data = query.data;
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="By category" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const range = data ? { startDate: data.period.startDate, endDate: data.period.endDate } : undefined;

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <ScreenHeader title="By category" onBack={back} docsKey="RP6" />

      <View className="gap-6 pb-8">
        <PeriodPicker value={period} onChange={setPeriod} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TYPES.map((t) => (
            <FilterChip key={t.value} label={t.label} active={type === t.value} onPress={() => setType(t.value)} />
          ))}
        </ScrollView>

        {query.isPending && rangeParams(period) ? (
          <View className="gap-3">
            <Skeleton width="100%" height={180} radius="md" />
            <Skeleton width="100%" height={180} radius="md" />
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : data && range ? (
          <>
            <Text variant="caption" tone="secondary">
              {data.period.label}
            </Text>
            {data.categories.filter((c) => c.statistics.transactionCount > 0 || Number(c.byStatus.waived?.count ?? 0) > 0).length === 0 ? (
              <Text variant="body" tone="secondary">
                Nothing was charged in this period.
              </Text>
            ) : null}
            {data.categories
              .filter((c) => c.statistics.transactionCount > 0 || Number(c.byStatus.waived?.count ?? 0) > 0)
              .map((c) => {
                const open = (status?: (typeof STATUS_FILTER_ORDER)[number], title?: string) =>
                  router.push(chargesHref({ scope: 'raised', ...range, categoryId: c.categoryId, status }, title ?? c.categoryName) as never);
                return (
                  <Card key={c.categoryId} testID={`rp6-category-${c.categoryId}`}>
                    <View className="gap-3">
                      <Pressable onPress={() => open()} accessibilityRole="button" accessibilityLabel={`${c.categoryName}. Opens every charge.`} className="gap-1">
                        <View className="flex-row items-center justify-between gap-3">
                          <Text variant="h3" className="flex-1" numberOfLines={1}>
                            {c.categoryName}
                          </Text>
                          <Text variant="label" tone="primary">
                            {percentLabel(c.statistics.collectionRate)}
                          </Text>
                        </View>
                        <Text variant="caption" tone="secondary">
                          {`${CATEGORY_TYPE_LABELS[c.categoryType] ?? c.categoryType} · ${c.statistics.transactionCount} charges · ${c.statistics.memberCount} members`}
                        </Text>
                      </Pressable>
                      <ProgressBar percent={c.statistics.collectionRate} tone="success" label="Collected" />
                      <View className="flex-row justify-between gap-3">
                        <View className="gap-0.5">
                          <Text variant="caption" tone="secondary">Charged</Text>
                          <Money value={c.statistics.totalExpected} size="body-strong" />
                        </View>
                        <View className="gap-0.5">
                          <Text variant="caption" tone="secondary">Paid</Text>
                          <Money value={c.statistics.totalCollected} size="body-strong" tone="success" />
                        </View>
                        <View className="gap-0.5">
                          <Text variant="caption" tone="secondary">Owed</Text>
                          <Money value={c.statistics.totalOutstanding} size="body-strong" tone={Number(c.statistics.totalOutstanding) > 0 ? 'warning' : 'default'} />
                        </View>
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        {STATUS_FILTER_ORDER.map((status) => {
                          const row = c.byStatus[status];
                          if (!row || Number(row.count) === 0) return null;
                          return (
                            <Pressable
                              key={status}
                              onPress={() => open(status, `${c.categoryName}: ${CHARGE_STATUS_LABELS[status]}`)}
                              accessibilityRole="button"
                              accessibilityLabel={`${row.count} ${CHARGE_STATUS_LABELS[status]}. Opens them.`}
                              className="flex-row items-center gap-1.5"
                              testID={`rp6-${c.categoryId}-${status}`}
                            >
                              <StatusChip status={chargeStatusKey(status)} label={`${CHARGE_STATUS_LABELS[status]} ${row.count}`} />
                            </Pressable>
                          );
                        })}
                      </View>
                      {c.recentTransactions.length > 0 ? (
                        <View className="gap-1">
                          <Text variant="label">Latest charges</Text>
                          {c.recentTransactions.map((t) => (
                            <Pressable key={t.id} onPress={() => router.push(chargeHref(t.id) as never)} accessibilityRole="button" className="flex-row items-center justify-between gap-3 py-1.5" testID={`rp6-charge-${t.id}`}>
                              <View className="flex-1">
                                <Text variant="body" numberOfLines={1}>{t.memberName}</Text>
                                <Text variant="caption" tone="tertiary">{CHARGE_STATUS_LABELS[t.status] ?? t.status}</Text>
                              </View>
                              <Money value={t.balance} size="body" />
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </Card>
                );
              })}
          </>
        ) : null}
      </View>
    </Screen>
  );
}
