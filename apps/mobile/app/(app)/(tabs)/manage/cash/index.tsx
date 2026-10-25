import { useRouter } from 'expo-router';
import { Banknote, HandCoins, Landmark, ListChecks, Users } from 'lucide-react-native';
import { View } from 'react-native';

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
import { Text } from '@/components/ui/Text';
import { daysWaitingLabel } from '@/features/cash/labels';
import { CASH_ANY_ACCESS, CASH_COLLECT_ACCESS, CASH_LODGE_ACCESS, CASH_VERIFY_ACCESS, useCashOverview } from '@/features/cash/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';

/** project-overview.md §6.9 CA1 — Cash: what the officer holds, what is lodged and waiting, and (for those who watch cash) everyone else's. */
export default function CashOverviewScreen() {
  const router = useRouter();
  const canAny = useCan(CASH_ANY_ACCESS);
  const canCollect = useCan(CASH_COLLECT_ACCESS);
  const canLodge = useCan(CASH_LODGE_ACCESS);
  const canVerify = useCan(CASH_VERIFY_ACCESS);
  const query = useCashOverview();
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/cash/${path}` as never);

  if (!canAny) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Cash" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const overview = query.data;
  const mine = overview?.mine;
  const toVerify = overview?.lodgmentsToVerify ?? 0;

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title="Cash" onBack={back} docsKey="CA1" />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={170} radius="lg" />
          <Skeleton width="100%" height={140} radius="md" />
        </View>
      ) : query.isError || !overview ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          {mine ? (
            <SummaryHero
              icon={Banknote}
              eyebrow="Cash in your hand"
              caption={mine.inHand > 0 || mine.awaitingCheck > 0 ? undefined : 'You are not holding any collected cash.'}
              stats={[
                { label: 'Ready to lodge', value: formatMoney(mine.readyToLodge) },
                { label: 'On open collections', value: formatMoney(mine.inOpenCollections) },
                { label: 'Lodged, awaiting check', value: formatMoney(mine.awaitingCheck) },
              ]}
              testID="cash-position"
            >
              <Money value={mine.inHand} size="display" tone="onPassbook" />
            </SummaryHero>
          ) : null}

          {mine?.overdue ? (
            <View className="flex-row gap-3 rounded-lg bg-warning-soft p-4" testID="cash-overdue">
              <View className="flex-1 gap-1">
                <Text variant="label" tone="warning">
                  Lodge this cash
                </Text>
                <Text variant="body">
                  {`${formatMoney(mine.readyToLodge)} was collected and closed ${daysWaitingLabel(mine.daysUnlodged)} and is not lodged yet. Your association expects cash to be lodged within ${overview.dueDays} ${overview.dueDays === 1 ? 'day' : 'days'}.`}
                </Text>
              </View>
            </View>
          ) : null}

          <Section title="Cash">
            <ListGroup>
              {canCollect ? (
                <ListItem
                  leading={<IconCircle icon={HandCoins} tone="primary" />}
                  title="Collections"
                  meta="Cash you collect from members at meetings"
                  showChevron
                  onPress={() => go('collections')}
                  testID="cash-collections"
                />
              ) : null}
              {canLodge ? (
                <ListItem
                  leading={<IconCircle icon={Landmark} tone={mine && mine.readyToLodge > 0 ? 'warning' : 'info'} />}
                  title="Lodge cash"
                  meta="Pay collected cash into the bank and record the slip"
                  trailing={mine && mine.readyToLodge > 0 ? <Badge tone="warning">{formatMoney(mine.readyToLodge)}</Badge> : undefined}
                  showChevron
                  onPress={() => go('lodge')}
                  testID="cash-lodge"
                />
              ) : null}
              <ListItem
                leading={<IconCircle icon={ListChecks} tone={canVerify && toVerify > 0 ? 'warning' : 'primary'} />}
                title="Lodgments"
                meta={canVerify ? 'Check lodgments against the bank statement' : 'Cash you have paid into the bank'}
                trailing={canVerify && toVerify > 0 ? <Badge tone="warning">{`${toVerify} waiting`}</Badge> : undefined}
                showChevron
                onPress={() => go('lodgments')}
                testID="cash-lodgments"
              />
            </ListGroup>
          </Section>

          {overview.totals ? (
            <Section title={`Every officer · ${formatMoney(overview.totals.inHand)} in hand`}>
              {overview.officers.length === 0 ? (
                <Text variant="body" tone="secondary">
                  No officer is holding collected cash right now.
                </Text>
              ) : (
                <ListGroup>
                  {overview.officers.map((p) => (
                    <ListItem
                      key={p.officer.id}
                      leading={<IconCircle icon={Users} tone={p.overdue ? 'warning' : 'primary'} />}
                      title={p.officer.name}
                      meta={
                        p.overdue
                          ? `Closed ${daysWaitingLabel(p.daysUnlodged)} · not lodged`
                          : p.awaitingCheck > 0
                            ? `${formatMoney(p.awaitingCheck)} lodged, awaiting check`
                            : 'Holding collected cash'
                      }
                      trailing={<Money value={p.inHand} size="body-strong" tone={p.overdue ? 'danger' : 'default'} />}
                      testID={`cash-officer-${p.officer.id}`}
                    />
                  ))}
                </ListGroup>
              )}
            </Section>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
