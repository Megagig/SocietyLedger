import { Users } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/FilterChip';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoMoney } from '@/features/ajo/components/AjoMoney';
import { AjoLoading, NeedsInternet } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { HandoverSheet, type HandoverSheetHandle } from '@/features/ajo/components/HandoverSheet';
import { RecordCashSheet, type RecordCashSheetHandle } from '@/features/ajo/components/RecordCashSheet';
import { formatDay, formatKobo, koboNegative, koboPositive } from '@/features/ajo/format';
import { AJO_COLLECT_ACCESS, useCollectorDay, useMyContributors } from '@/features/ajo/queries';
import { useOnline } from '@/hooks/useOnline';

/** THC1 to THC3: a collector's day. Who to see, record what they paid, then hand the cash over. Online only: nothing is saved for later. */
export default function CollectorTodayScreen() {
  const online = useOnline();
  const { canWrite } = useAjoWrite();
  const mine = useMyContributors();
  const groups = [...new Map((mine.data ?? []).map((c) => [c.groupId, c.groupName])).entries()];
  const [chosen, setChosen] = useState<number | null>(null);
  const groupId = chosen ?? groups[0]?.[0] ?? 0;
  const day = useCollectorDay(groupId);
  const cashSheet = useRef<RecordCashSheetHandle>(null);
  const handoverSheet = useRef<HandoverSheetHandle>(null);

  const people = (mine.data ?? []).filter((c) => c.groupId === groupId);
  const paidToday = new Set((day.data?.payments ?? []).map((p) => p.name));
  const alreadyHanded = !!day.data?.handover;
  const refresh = () => {
    void mine.refetch();
    void day.refetch();
  };

  return (
    <AjoScreen title="Today's collection" access={AJO_COLLECT_ACCESS} refreshing={mine.isRefetching || day.isRefetching} onRefresh={refresh} keyboard>
      {!online ? <NeedsInternet /> : null}

      {mine.isPending ? (
        <AjoLoading />
      ) : mine.isError ? (
        <ErrorState error={mine.error} onRetry={() => mine.refetch()} />
      ) : mine.data.length === 0 ? (
        <EmptyState icon={Users} title="You have no contributors assigned yet." description="An officer assigns the people you collect from." />
      ) : (
        <>
          <Text variant="body" tone="secondary">
            {day.data ? formatDay(day.data.forDate) : ''} · needs an internet connection
          </Text>

          {groups.length > 1 ? (
            <View className="flex-row flex-wrap gap-2">
              {groups.map(([id, name]) => (
                <FilterChip key={id} label={name} active={id === groupId} onPress={() => setChosen(id)} />
              ))}
            </View>
          ) : null}

          {day.isPending ? (
            <AjoLoading rows={2} />
          ) : day.isError ? (
            <ErrorState error={day.error} onRetry={() => day.refetch()} />
          ) : (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <StatTile label="Expected today" value={formatKobo(day.data.expectedKobo)} tone="info" />
                <StatTile label="Collected today" value={formatKobo(day.data.collectedKobo)} tone="success" />
              </View>
              <View className="flex-row gap-3">
                <StatTile label="Carried over" value={formatKobo(day.data.carriedOverKobo)} tone="accent" />
                <StatTile label="Cash in your hand" value={formatKobo(day.data.inHandKobo)} tone="warning" />
              </View>
            </View>
          )}

          <SectionCard title="Your contributors">
            {people.map((c) => {
              const arrears = day.data?.arrears.find((a) => a.membershipId === c.membershipId);
              return (
                <View key={c.assignmentId} className="gap-2 px-4 py-3" testID={`ajo-contributor-${c.membershipId}`}>
                  <View className="flex-row items-center justify-between gap-2">
                    <Text variant="body-strong" className="flex-1">
                      {c.name}
                    </Text>
                    {paidToday.has(c.name) ? <AjoStatusBadge status="CASH_RECEIVED" label="Paid today" /> : null}
                  </View>
                  {arrears && koboPositive(arrears.overdueKobo) ? (
                    <Text variant="caption" tone="danger">
                      Behind by {arrears.overdue}
                    </Text>
                  ) : null}
                  {canWrite && !alreadyHanded ? (
                    <Button size="sm" variant="soft" disabled={!online} onPress={() => cashSheet.current?.open(c)} testID={`ajo-record-cash-${c.membershipId}`}>
                      Record cash
                    </Button>
                  ) : null}
                </View>
              );
            })}
          </SectionCard>

          {day.data && day.data.payments.length > 0 ? (
            <SectionCard title="Recorded today">
              {day.data.payments.map((p) => (
                <View key={p.contributionId} className="flex-row items-center justify-between gap-2 px-4 py-3">
                  <Text variant="body" className="flex-1">
                    {p.name}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </Text>
                  <AjoMoney kobo={p.amountKobo} />
                </View>
              ))}
            </SectionCard>
          ) : null}

          <Card testID="ajo-handover-card">
            <View className="gap-3">
              <Text variant="h3">End of day handover</Text>
              {alreadyHanded ? (
                <View className="gap-1">
                  <View className="flex-row flex-wrap items-center gap-1">
                    <Text variant="body">You handed over</Text>
                    <AjoMoney kobo={day.data?.handedOverKobo} />
                    <Text variant="body">{day.data?.handover?.reconciled ? '. An officer has counted and reconciled it.' : '. An officer still has to count it.'}</Text>
                  </View>
                  {day.data && day.data.differenceKobo !== '0' ? (
                    <View className="flex-row flex-wrap items-center gap-1">
                      <Text variant="body">The difference is</Text>
                      <AjoMoney kobo={day.data.differenceKobo} tone={koboNegative(day.data.differenceKobo) ? 'danger' : 'default'} />
                    </View>
                  ) : null}
                </View>
              ) : canWrite ? (
                <>
                  <Text variant="body" tone="secondary">
                    When you give the cash to the circle, record how much you handed over. If it does not match what you collected, the difference is shown to the officer.
                  </Text>
                  <Button disabled={!day.data || !online} onPress={() => handoverSheet.current?.open()} testID="ajo-handover-open">
                    Hand over cash
                  </Button>
                </>
              ) : (
                <Text variant="body" tone="secondary">
                  Handovers are switched off while the add-on is expired.
                </Text>
              )}
            </View>
          </Card>
        </>
      )}

      <RecordCashSheet ref={cashSheet} groupId={groupId} online={online} />
      <HandoverSheet ref={handoverSheet} groupId={groupId} day={day.data} online={online} />
    </AjoScreen>
  );
}
