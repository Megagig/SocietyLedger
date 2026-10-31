import { CheckCircle2, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { OrderCheckDTO, OrderDTO } from '@/types/api/ajo';
import { formatMoment } from '../format';

/**
 * How the payout order was made, in the open: the method, who made it and when, and then either the seed with a button that runs the draw
 * again and says whether it matches (a random draw), or the reason the admin gave (an admin-set order). Shown to every member of the pot
 * on their circle screen, and to the officers on Payout order, whether or not the Circle board is on.
 */
export function OrderTransparencyCard({ groupId, order }: { groupId: number; order: OrderDTO }) {
  const { color } = useThemeTokens();
  const [check, setCheck] = useState<OrderCheckDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const random = order.method === 'RANDOM_DRAW';

  const verify = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setCheck(await ajoApi.verifyOrder(groupId));
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not check the draw.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card testID="ajo-order-transparency">
      <View className="gap-2">
        <Text variant="h3">How the payout order was decided</Text>
        <Text variant="body" tone="secondary">
          {random ? 'This circle uses an automatic draw. It is random, recorded with its seed, and anyone can check it.' : 'This circle’s admin sets the order by hand and records the reason.'}
        </Text>

        {!order.drawn ? (
          <Text variant="body" tone="secondary">
            {random ? 'The order has not been drawn yet. It is drawn once everyone has joined, before the circle starts.' : 'The admin has not set the order yet.'}
          </Text>
        ) : random ? (
          <View className="gap-2">
            <Text variant="body">
              Drawn {formatMoment(order.drawnAt)}
              {order.madeBy ? ` by ${order.madeBy}` : ''}. Seed {order.seed}
              {order.stale ? ' (out of date: the people changed after this draw)' : ''}.
            </Text>
            <View className="flex-row">
              <Button size="sm" variant="secondary" loading={busy} onPress={() => void verify()} testID="ajo-verify-draw">
                Verify this draw
              </Button>
            </View>
            {check && check.matches === true ? (
              <View className="flex-row items-start gap-2" accessibilityRole="alert" testID="ajo-verify-ok">
                <CheckCircle2 size={18} color={color.success} />
                <Text variant="body" className="flex-1">
                  Matches: running the draw again from the seed gives exactly this order.
                </Text>
              </View>
            ) : null}
            {check && check.matches === false ? (
              <View className="flex-row items-start gap-2" accessibilityRole="alert" testID="ajo-verify-bad">
                <TriangleAlert size={18} color={color.danger} />
                <Text variant="body" tone="danger" className="flex-1">
                  {check.reason}
                </Text>
              </View>
            ) : null}
            {check && check.matches === null ? (
              <Text variant="caption" tone="secondary">
                {check.reason}
              </Text>
            ) : null}
            {problem ? (
              <Text variant="body" tone="danger">
                {problem}
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="gap-2">
            <Text variant="body">
              Set by {order.madeBy ?? 'the admin'} on {formatMoment(order.drawnAt)}
              {order.stale ? ' (out of date: the people changed after this was set)' : ''}.
            </Text>
            <View className="rounded-md bg-surface-sunken p-3">
              <Text variant="body">Reason given: {order.reason}</Text>
            </View>
            <Text variant="caption" tone="tertiary">
              Nothing random backs an order set by hand, so there is no seed to check. The reason above is the basis the group can read.
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}
