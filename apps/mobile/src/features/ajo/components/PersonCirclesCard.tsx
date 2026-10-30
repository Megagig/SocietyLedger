import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { ajoApi } from '@/api/endpoints/ajo';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import { formatDay, MODEL_LABEL } from '../format';
import { ajoKeys } from '../queries';
import { useAjoNav } from '../useAjoNav';
import { AjoMoney } from './AjoMoney';
import { AjoStatusBadge } from './AjoStatusBadge';

/**
 * Every circle one person is, or was, in: the circle, their place in it, and what they owe. For officers, on the person's page.
 * Renders nothing when the person is in no circle, or when the viewer does not run circles.
 */
export function PersonCirclesCard({ memberId }: { memberId: number }) {
  const nav = useAjoNav();
  const router = useRouter();
  const tenant = useTenantKey();
  const circles = useQuery({ queryKey: ajoKeys.staff(tenant, 'person-circles', memberId), queryFn: () => ajoApi.personCircles(memberId), enabled: nav.staff && memberId > 0, retry: false });
  if (!nav.staff || !circles.data || circles.data.length === 0) return null;
  return (
    <SectionCard title="Circles">
      {circles.data.map((c) => (
        <View key={c.membershipId} className="gap-1 px-4 py-3" testID={`ajo-person-circle-${c.membershipId}`}>
          <View className="flex-row items-center justify-between gap-2">
            <Text variant="body-strong">{c.group.name}</Text>
            <AjoStatusBadge status={c.status} />
          </View>
          <Text variant="caption" tone="tertiary">
            {MODEL_LABEL[c.group.model] ?? c.group.model} · started {formatDay(c.group.startDate)}
            {c.payoutPositions.length > 0 ? ` · payout position ${c.payoutPositions.join(', ')}` : ''}
          </Text>
          {Number(c.totalOwedKobo) > 0 ? (
            <Text variant="caption" tone="danger">
              Owes <AjoMoney kobo={c.totalOwedKobo} />
            </Text>
          ) : null}
          <View className="flex-row pt-1">
            <Button size="sm" variant="secondary" onPress={() => router.push(`/(app)/(tabs)/manage/thrift/${c.group.id}/members` as never)}>
              Open the circle
            </Button>
          </View>
        </View>
      ))}
    </SectionCard>
  );
}
