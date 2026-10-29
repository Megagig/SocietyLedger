import { useLocalSearchParams } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/FilterChip';
import { Text } from '@/components/ui/Text';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoMoney } from '@/features/ajo/components/AjoMoney';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { ReconcileSheet, type ReconcileSheetHandle } from '@/features/ajo/components/ReconcileSheet';
import { formatDay, koboNegative } from '@/features/ajo/format';
import { useHandovers } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';

const FILTERS = [
  { value: 'false', label: 'Waiting to be counted' },
  { value: 'true', label: 'Reconciled' },
  { value: '', label: 'All' },
];

/** THO4 (cash side): what collectors have handed over, and which still need counting. */
export default function CircleHandoversScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoWrite();
  const { reconcile } = useAjoCan();
  const [filter, setFilter] = useState('false');
  const handovers = useHandovers(groupId, filter === '' ? undefined : filter === 'true');
  const sheet = useRef<ReconcileSheetHandle>(null);

  return (
    <AjoScreen title="Cash handovers" access={['AJO_MANAGE', 'AJO_RECONCILE']} refreshing={handovers.isRefetching} onRefresh={() => void handovers.refetch()}>
      <Text variant="body" tone="secondary">
        At the end of each day a collector hands over what they collected. You count it and tick what was really there. Only then is the cash confirmed and receipted.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <FilterChip key={f.value} label={f.label} active={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
      </View>

      {handovers.isPending ? (
        <AjoLoading />
      ) : handovers.isError ? (
        <ErrorState error={handovers.error} onRetry={() => handovers.refetch()} />
      ) : handovers.items.length > 0 ? (
        <View className="gap-3">
          {handovers.items.map((h) => (
            <Card key={h.id} testID={`ajo-handover-${h.id}`}>
              <View className="gap-2">
                <View className="flex-row items-start justify-between gap-3">
                  <Text variant="h3">{formatDay(h.forDate)}</Text>
                  <AjoStatusBadge status={h.reconciled ? 'CONFIRMED' : 'PENDING'} label={h.reconciled ? 'Reconciled' : 'Waiting to be counted'} />
                </View>
                {h.note ? (
                  <Text variant="caption" tone="tertiary">
                    {h.note}
                  </Text>
                ) : null}
                <View className="flex-row items-center justify-between">
                  <Text variant="caption" tone="secondary">
                    Collected
                  </Text>
                  <AjoMoney kobo={h.collectedKobo} />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text variant="caption" tone="secondary">
                    Handed over
                  </Text>
                  <AjoMoney kobo={h.handedOverKobo} />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text variant="caption" tone="secondary">
                    Difference
                  </Text>
                  <AjoMoney kobo={h.differenceKobo} tone={h.differenceKobo !== '0' || koboNegative(h.differenceKobo) ? 'danger' : 'default'} />
                </View>
                {reconcile && canWrite && !h.reconciled ? (
                  <Button onPress={() => sheet.current?.open(h)} testID={`ajo-reconcile-${h.id}`}>
                    Count and reconcile
                  </Button>
                ) : null}
              </View>
            </Card>
          ))}
          {handovers.hasMore ? (
            <Button variant="secondary" loading={handovers.isFetchingNextPage} onPress={() => void handovers.fetchNextPage()}>
              Show more
            </Button>
          ) : null}
        </View>
      ) : (
        <EmptyState icon={HandCoins} title="No handovers here." />
      )}

      <ReconcileSheet ref={sheet} />
    </AjoScreen>
  );
}
