import { useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { ajoApi } from '@/api/endpoints/ajo';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { AjoActionSheet } from '@/features/ajo/components/AjoActionSheet';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoMoney } from '@/features/ajo/components/AjoMoney';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AssignCollectorSheet, type AssignCollectorSheetHandle } from '@/features/ajo/components/AssignCollectorSheet';
import { formatDay } from '@/features/ajo/format';
import { useCollectorCandidates, useCollectors, usePeople } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';

/** THO8: which collector looks after which contributors, and their daily targets. A person has one collector at a time. */
export default function CircleCollectorsScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoWrite();
  const { manage } = useAjoCan();
  const assignments = useCollectors(groupId);
  const everyone = usePeople(groupId);
  const candidates = useCollectorCandidates();
  const assignSheet = useRef<AssignCollectorSheetHandle>(null);
  const removeSheet = useRef<BottomSheetModal>(null);
  const [removing, setRemoving] = useState<{ membershipId: number; name: string } | null>(null);
  const can = manage && canWrite;
  const [now] = useState(() => Date.now());

  const collectorName = (userId: number) => candidates.data?.find((c) => c.userId === userId)?.name ?? `User ${userId}`;
  const current = (assignments.data ?? []).filter((a) => !a.endsOn || new Date(a.endsOn).getTime() >= now);
  const byPerson = new Map(current.map((a) => [a.membershipId, a]));
  const eligible = (everyone.data ?? []).filter((p) => p.status === 'ACTIVE' || p.status === 'PENDING');

  return (
    <AjoScreen title="Collectors" access={['AJO_MANAGE']} refreshing={assignments.isRefetching} onRefresh={() => void assignments.refetch()}>
      <Text variant="body" tone="secondary">
        Collectors go round and receive cash. They need the collector permission to be listed here. A collector only ever sees the contributors assigned to them.
      </Text>
      {can ? (
        <Button onPress={() => assignSheet.current?.open()} testID="ajo-assign-open">
          Assign contributors
        </Button>
      ) : null}

      {assignments.isPending ? (
        <AjoLoading />
      ) : assignments.isError ? (
        <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} />
      ) : eligible.length === 0 ? (
        <EmptyState icon={Users} title="Nobody is in this circle yet." />
      ) : (
        <View className="gap-3">
          {eligible.map((p) => {
            const a = byPerson.get(p.membershipId);
            return (
              <Card key={p.membershipId} testID={`ajo-collector-row-${p.membershipId}`}>
                <View className="gap-2">
                  <Text variant="h3">{p.name}</Text>
                  <Text variant="body" tone={a ? 'default' : 'tertiary'}>
                    {a ? collectorName(a.collectorUserId) : 'None (pays by transfer)'}
                  </Text>
                  {a ? (
                    <View className="flex-row items-center justify-between">
                      <Text variant="caption" tone="tertiary">
                        Daily target · since {formatDay(a.startsOn)}
                      </Text>
                      {a.dailyTargetKobo ? <AjoMoney kobo={a.dailyTargetKobo} /> : <Text variant="caption">—</Text>}
                    </View>
                  ) : null}
                  {can ? (
                    <View className="flex-row gap-2">
                      <Button size="sm" variant="secondary" onPress={() => assignSheet.current?.open(p.membershipId)}>
                        {a ? 'Change' : 'Assign'}
                      </Button>
                      {a ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            setRemoving({ membershipId: p.membershipId, name: p.name });
                            removeSheet.current?.present();
                          }}
                          testID={`ajo-unassign-${p.membershipId}`}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <AssignCollectorSheet ref={assignSheet} people={eligible} candidates={candidates.data ?? []} />
      <AjoActionSheet
        ref={removeSheet}
        title="Remove collector"
        summary={removing ? `${removing.name} will no longer be assigned to a collector. They can pay by transfer, or you can assign them again.` : undefined}
        confirmLabel="Remove"
        destructive
        onConfirm={() => ajoApi.unassignCollector(removing?.membershipId ?? 0)}
        successMessage="The collector was removed."
        testID="ajo-unassign-sheet"
      />
    </AjoScreen>
  );
}
