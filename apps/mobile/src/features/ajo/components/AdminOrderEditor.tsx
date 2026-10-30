import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextInput } from 'react-native';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { OrderDTO } from '@/types/api/ajo';
import { ordinal } from '../format';
import { useAjoAction } from '../mutations';
import { usePeople } from '../queries';

type Place = { membershipId: number; shareNo: number; name: string };

/**
 * The admin places every share by hand: move people up and down, write the reason, save. First in the list is paid first. It starts from the
 * current order if there is one, otherwise from the approved people in the order they joined. Needs the permission to approve payouts.
 */
export function AdminOrderEditor({ groupId, order, rerun }: { groupId: number; order: OrderDTO; rerun: boolean }) {
  const { color } = useThemeTokens();
  const people = usePeople(groupId);
  const [places, setPlaces] = useState<Place[]>([]);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const save = useAjoAction((body: { order: { membershipId: number; shareNo: number }[]; reason: string }) => ajoApi.setOrder(groupId, body));

  useEffect(() => {
    const active = (people.data ?? []).filter((p) => p.status === 'ACTIVE');
    const known = new Map(order.slots.map((s) => [`${s.membershipId}:${s.shareNo}`, s.position]));
    const all: Place[] = active.flatMap((p) => Array.from({ length: p.shares }, (_, i) => ({ membershipId: p.membershipId, shareNo: i + 1, name: p.shares > 1 ? `${p.name} (share ${i + 1})` : p.name })));
    all.sort((a, b) => (known.get(`${a.membershipId}:${a.shareNo}`) ?? 1e6 + a.membershipId) - (known.get(`${b.membershipId}:${b.shareNo}`) ?? 1e6 + b.membershipId));
    setPlaces(all);
  }, [people.data, order.slots]);

  const move = (index: number, by: number) =>
    setPlaces((list) => {
      const next = [...list];
      const target = index + by;
      if (target < 0 || target >= next.length) return list;
      const held = next[index];
      const other = next[target];
      if (!held || !other) return list;
      next[index] = other;
      next[target] = held;
      return next;
    });

  const submit = async () => {
    if (places.length < 2) return setProblem('A rotating pot needs at least 2 shares before the order can be set.');
    if (reason.trim().length < 10) return setProblem('Write the reason or basis for this order, at least 10 characters.');
    setProblem(null);
    try {
      await save.mutateAsync({ order: places.map(({ membershipId, shareNo }) => ({ membershipId, shareNo })), reason: reason.trim() });
      toast.success(rerun ? 'The order was set again.' : 'The order was set.');
      setReason('');
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not set the order.');
    }
  };

  return (
    <Card testID="ajo-admin-order-editor">
      <View className="gap-3">
        <Text variant="h3">{rerun ? 'Set the order again' : 'Set the payout order'}</Text>
        <Text variant="body" tone="secondary">
          You place every share, first in the list is paid first. Every member sees the order, that you set it, and the reason you give.
        </Text>
        {order.pendingPeople > 0 ? (
          <Text variant="caption" tone="warning">
            {order.pendingPeople} {order.pendingPeople === 1 ? 'person has' : 'people have'} joined but {order.pendingPeople === 1 ? 'is' : 'are'} not approved yet, so they are not in this list. Approve everyone first, then set the order once.
          </Text>
        ) : null}
        <View className="gap-2">
          {places.map((p, i) => (
            <View key={`${p.membershipId}:${p.shareNo}`} className="flex-row items-center justify-between gap-2" testID={`ajo-place-${i + 1}`}>
              <View className="flex-1 flex-row items-center gap-3">
                <Text variant="h3">{ordinal(i + 1)}</Text>
                <Text variant="body" className="flex-1">
                  {p.name}
                </Text>
              </View>
              <View className="flex-row gap-1">
                <IconButton icon={ArrowUp} accessibilityLabel={`Move ${p.name} up`} onPress={() => move(i, -1)} disabled={i === 0} testID={`ajo-place-up-${i + 1}`} />
                <IconButton icon={ArrowDown} accessibilityLabel={`Move ${p.name} down`} onPress={() => move(i, 1)} disabled={i === places.length - 1} testID={`ajo-place-down-${i + 1}`} />
              </View>
            </View>
          ))}
        </View>
        <View className="gap-1">
          <Text variant="label">Reason or basis for this order</Text>
          <Text variant="caption" tone="tertiary">
            For example “agreed at the 12 Nov meeting: by need, then date joined”. Members can read this.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={1000}
            placeholderTextColor={color.textTertiary}
            style={{ minHeight: 72, borderWidth: 1, borderColor: color.borderStrong, borderRadius: 12, padding: 12, color: color.text }}
            testID="ajo-order-reason"
          />
        </View>
        {problem ? (
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        ) : null}
        <Button loading={save.isPending} onPress={() => void submit()} testID="ajo-order-save">
          {rerun ? 'Save the new order' : 'Save the order'}
        </Button>
      </View>
    </Card>
  );
}
