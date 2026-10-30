import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { SectionCard } from '@/components/layout/SectionCard';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import { ordinal } from '../format';
import { ajoKeys } from '../queries';
import { AjoStatusBadge } from './AjoStatusBadge';
import { OrderTransparencyCard } from './OrderTransparencyCard';

/**
 * The payout order for one of my rotating pots: where everyone stands, who collects when, and how it was decided (method, who, when, the
 * seed and a button to check a random draw, or the admin's reason). Visible to every member of the pot whether or not the Circle board is on.
 */
export function PayoutOrderCard({ groupId }: { groupId: number }) {
  const tenant = useTenantKey();
  const order = useQuery({ queryKey: [...ajoKeys.all(tenant), 'order-view', groupId], queryFn: () => ajoApi.order(groupId), enabled: groupId > 0 });
  if (!order.data) return null;
  const data = order.data;
  return (
    <View className="gap-3" testID="ajo-payout-order-card">
      <OrderTransparencyCard groupId={groupId} order={data} />
      {data.drawn && data.slots.length > 0 ? (
        <SectionCard title="The payout order">
          {data.slots.map((s) => (
            <View key={s.slotId} className="flex-row items-center justify-between gap-3 px-4 py-3" testID={`ajo-order-slot-${s.slotId}`}>
              <View className="flex-1 flex-row items-center gap-3">
                <Text variant="h3">{ordinal(s.position)}</Text>
                <Text variant="body" className="flex-1">
                  {s.name}
                  {s.shareNo > 1 ? ` (share ${s.shareNo})` : ''}
                  {s.mine ? ' · you' : ''}
                </Text>
              </View>
              {s.paid ? <AjoStatusBadge status="PAID" label="Collected" /> : null}
            </View>
          ))}
        </SectionCard>
      ) : null}
    </View>
  );
}
