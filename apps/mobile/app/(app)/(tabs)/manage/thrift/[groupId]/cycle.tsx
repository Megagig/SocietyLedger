import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { useRef } from 'react';
import { View } from 'react-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { AjoActionSheet } from '@/features/ajo/components/AjoActionSheet';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { formatDay, formatKobo } from '@/features/ajo/format';
import { AJO_STAFF_ACCESS, useGroupCycle } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';

/**
 * The running cycle of a collector-thrift scheme (spec §16.5): who continues, who withdraws, and who has said nothing (and so withdraws).
 * When the cycle is over and every saver who is leaving has been paid, the admin starts the next one.
 */
export default function GroupCycleScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoWrite();
  const { approvePayout } = useAjoCan();
  const q = useGroupCycle(groupId);
  const startSheet = useRef<BottomSheetModal>(null);

  return (
    <AjoScreen title="Savings cycle" access={AJO_STAFF_ACCESS} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {q.isPending ? (
        <AjoLoading rows={3} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <View className="gap-4" testID="ajo-cycle-screen">
          <View className="gap-1">
            <Text variant="h2">Cycle {q.data.cycleNo}</Text>
            <Text variant="caption" tone="secondary">
              {formatDay(q.data.startsOn)}
              {q.data.endsOn ? ` to ${formatDay(q.data.endsOn)}` : ''}. Savers are asked from {q.data.promptOpensOn ? formatDay(q.data.promptOpensOn) : 'three days before the end'} whether to withdraw or continue. If someone does not answer, their savings are paid out to them.
            </Text>
          </View>

          <View className="flex-row gap-3">
            <StatTile label="Continuing" value={String(q.data.counts.continuing)} tone="success" />
            <StatTile label="Withdrawing" value={String(q.data.counts.withdrawing)} tone="info" />
            <StatTile label="No answer" value={String(q.data.counts.noAnswer)} tone="warning" />
          </View>

          {q.data.people.length === 0 ? (
            <EmptyState icon={RefreshCw} title="No savers in this cycle." />
          ) : (
            q.data.people.map((p) => (
              <Card key={p.membershipId} testID={`ajo-cycle-person-${p.membershipId}`}>
                <View className="gap-1">
                  <Text variant="body-strong">{p.name}</Text>
                  <Text variant="caption" tone="secondary">
                    Saves {formatKobo(p.amountKobo)} each time · saved so far {formatKobo(p.savedKobo)}
                  </Text>
                  <Text variant="body">
                    {p.effectiveChoice === 'CONTINUE' ? 'Continuing' : 'Withdrawing'}
                    {p.choice === 'PENDING' ? ' (no answer yet)' : p.decidedVia === 'officer' ? ' (recorded by an officer)' : ''}
                    {p.effectiveChoice === 'CONTINUE' && p.nextAmountKobo ? `, ${formatKobo(p.nextAmountKobo)} each time next cycle` : ''}
                  </Text>
                </View>
              </Card>
            ))
          )}

          {canWrite && approvePayout ? (
            <Card>
              <View className="gap-3">
                <Text variant="body">
                  {q.data.canStartNext
                    ? "The cycle is over. Starting the next cycle takes each continuing saver's collector fee (one of their contributions) from their savings, carries the rest forward, and closes the places of everyone who withdrew. Savers who are withdrawing must have been paid first."
                    : q.data.cycleOver
                      ? 'Nobody is continuing, so there is no next cycle. Pay everyone out and complete the group instead.'
                      : 'The next cycle can be started once this one is over.'}
                </Text>
                <Button disabled={!q.data.canStartNext} onPress={() => startSheet.current?.present()} testID="ajo-cycle-start-next">
                  Start the next cycle
                </Button>
              </View>
            </Card>
          ) : null}

          <AjoActionSheet
            ref={startSheet}
            title="Start the next cycle"
            summary={`${q.data.counts.continuing} continuing and ${q.data.counts.withdrawing} withdrawing. Everyone who is withdrawing will be taken out of the group.`}
            confirmLabel="Start the next cycle"
            onConfirm={() => ajoApi.startNextCycle(groupId)}
            successMessage="The next cycle has started."
            testID="ajo-cycle-start-sheet"
          />
        </View>
      )}
    </AjoScreen>
  );
}
