import { useRouter } from 'expo-router';
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
import { chargesHref } from '@/features/reports/drill';
import { AGING_LABELS, AGING_ORDER, percentLabel } from '@/features/reports/labels';
import { useAging, useReportsAccess } from '@/features/reports/queries';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';

const SHOWN_MEMBERS = 5;

/**
 * project-overview.md §6.9 RP4 — Aging: how long what is owed has been owed. Each age band opens the charges in it, and each member
 * in a band opens just their charges there.
 */
export default function AgingScreen() {
  const router = useRouter();
  const { chart, color } = useThemeTokens();
  const allowed = useReportsAccess();
  const query = useAging();
  const data = query.data;
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Aging" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const total = Number(data?.summary.totalOutstanding ?? 0);
  const asOfDate = data?.asOfDate;

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <ScreenHeader title="Aging" onBack={back} docsKey="RP4" />

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={96} radius="md" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !data ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="flex-row gap-3">
            <DrillFigure
              label="Total still owed"
              value={total}
              tone="warning"
              caption={`${data.summary.totalMembers.toLocaleString('en-NG')} members · ${data.summary.totalTransactions.toLocaleString('en-NG')} charges`}
              onPress={() => router.push(chargesHref({ scope: 'owing' }, 'Everything still owed') as never)}
              testID="rp4-total"
            />
          </View>

          {total > 0 ? (
            <View className="gap-2" testID="rp4-bar">
              <View className="h-4 flex-row overflow-hidden rounded-full" style={{ backgroundColor: color.surfaceSunken }}>
                {AGING_ORDER.map((key, i) => {
                  const share = (Number(data.buckets[key].amount) / total) * 100;
                  return share > 0 ? <View key={key} style={{ width: `${share}%`, backgroundColor: chart[i % chart.length] }} /> : null;
                })}
              </View>
              <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                {AGING_ORDER.map((key, i) => (
                  <View key={key} className="flex-row items-center gap-1.5">
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: chart[i % chart.length] }} />
                    <Text variant="caption" tone="secondary">
                      {`${AGING_LABELS[key]} ${percentLabel((Number(data.buckets[key].amount) / total) * 100)}`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text variant="body" tone="secondary">
              Nobody owes anything right now.
            </Text>
          )}

          {AGING_ORDER.map((key) => {
            const bucket = data.buckets[key];
            if (bucket.count === 0) return null;
            return (
              <Section key={key} title={AGING_LABELS[key]}>
                <ListGroup>
                  <ListItem
                    title={`${bucket.count.toLocaleString('en-NG')} ${bucket.count === 1 ? 'charge' : 'charges'}`}
                    meta="See every charge in this band"
                    trailing={<Money value={bucket.amount} size="body-strong" tone="warning" />}
                    showChevron
                    onPress={() => router.push(chargesHref({ scope: 'aging', bucket: key, asOfDate }, AGING_LABELS[key]) as never)}
                    testID={`rp4-bucket-${key}`}
                  />
                  {bucket.members.slice(0, SHOWN_MEMBERS).map((m) => (
                    <ListItem
                      key={m.memberId}
                      compact
                      title={m.memberName}
                      meta={m.daysOverdue > 0 ? `Oldest ${formatDate(m.oldestDueDate, 'long')} · ${m.daysOverdue} days late` : 'Not due yet'}
                      trailing={<Money value={m.amount} size="body" />}
                      showChevron
                      onPress={() => router.push(chargesHref({ scope: 'aging', bucket: key, asOfDate, memberId: m.memberId }, m.memberName) as never)}
                      testID={`rp4-member-${key}-${m.memberId}`}
                    />
                  ))}
                </ListGroup>
                {bucket.members.length > SHOWN_MEMBERS ? (
                  <Text variant="caption" tone="tertiary">
                    {`${bucket.members.length - SHOWN_MEMBERS} more members. Open the charges to see them all.`}
                  </Text>
                ) : null}
              </Section>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
