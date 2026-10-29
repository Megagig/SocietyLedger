import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { ListOrdered } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { AjoActionSheet } from '@/features/ajo/components/AjoActionSheet';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { TickRow } from '@/features/ajo/components/TickRow';
import { formatMoment, ordinal } from '@/features/ajo/format';
import { useAjoAction } from '@/features/ajo/mutations';
import { useGroupDetail, useOrder, useSwaps } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';
import type { OrderSlotDTO } from '@/types/api/ajo';

const swapSchema = z
  .object({ a: z.string().min(1, 'Choose the first place.'), b: z.string().min(1, 'Choose the second place.'), reason: z.string().trim().max(300).optional() })
  .refine((v) => v.a !== v.b, { path: ['b'], message: 'Choose two different places.' });
type SwapValues = z.infer<typeof swapSchema>;

/** THO10: the recorded draw, who collects when, and the only two ways it can change: a swap before anyone is paid, or an emergency exception. */
export default function PayoutOrderScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoWrite();
  const { manage, approvePayout } = useAjoCan();
  const group = useGroupDetail(groupId).data;
  const order = useOrder(groupId);
  const swaps = useSwaps(groupId);
  const draw = useAjoAction<void>(() => ajoApi.runDraw(groupId));
  const request = useAjoAction((body: { slotAId: number; slotBId: number; reason?: string }) => ajoApi.requestSwap(groupId, body));
  const decide = useAjoAction((input: { swapId: number; decision: 'APPROVED' | 'REJECTED' }) => ajoApi.decideSwap(input.swapId, { decision: input.decision }));
  const { control, handleSubmit, reset } = useForm<SwapValues>({ resolver: zodResolver(swapSchema), defaultValues: { a: '', b: '', reason: '' } });
  const exceptionSheet = useRef<BottomSheetModal>(null);
  const [exceptionSlot, setExceptionSlot] = useState<OrderSlotDTO | null>(null);
  const [newPosition, setNewPosition] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const data = order.data;
  const can = manage && canWrite;
  const nobodyPaidYet = !!data && data.slots.every((s) => !s.paid);
  const slotName = (slotId: number) => {
    const s = data?.slots.find((x) => x.slotId === slotId);
    return s ? `${s.name} (${ordinal(s.position)})` : `Place ${slotId}`;
  };
  const slotOptions = (data?.slots ?? []).map((s) => ({ value: String(s.slotId), label: `${ordinal(s.position)} · ${s.name}` }));

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setProblem(null);
    try {
      await fn();
      toast.success(success);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  };

  const submitSwap = handleSubmit(async (values) => {
    await run(() => request.mutateAsync({ slotAId: Number(values.a), slotBId: Number(values.b), reason: values.reason?.trim() || undefined }), 'The swap was requested.');
    reset();
  });

  return (
    <AjoScreen title="Payout order" access={['AJO_MANAGE', 'AJO_RECONCILE', 'AJO_APPROVE_PAYOUT']} keyboard refreshing={order.isRefetching} onRefresh={() => void order.refetch()}>
      {problem ? (
        <View className="rounded-md bg-danger-soft p-3" accessibilityRole="alert">
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        </View>
      ) : null}

      {order.isPending ? (
        <AjoLoading />
      ) : order.isError ? (
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      ) : !data ? null : !data.drawn ? (
        <Card testID="ajo-order-undrawn">
          <View className="gap-2">
            <Text variant="h3">The order has not been drawn yet.</Text>
            <Text variant="body" tone="secondary">
              The draw is random, recorded with its seed so anyone can check it later, and it happens once. Do it after everyone has joined and before the circle starts.
            </Text>
            {can && group?.status === 'OPEN' ? (
              <Button loading={draw.isPending} onPress={() => void run(() => draw.mutateAsync(), 'The order was drawn.')} testID="ajo-draw">
                Draw the order
              </Button>
            ) : null}
            {can && group?.status !== 'OPEN' ? (
              <Text variant="caption" tone="tertiary">
                The draw is made while the circle is open for joining.
              </Text>
            ) : null}
          </View>
        </Card>
      ) : (
        <View className="gap-3">
          <Text variant="caption" tone="secondary">
            Drawn {formatMoment(data.drawnAt)}. Seed {data.seed}.
          </Text>
          {data.slots.map((s) => (
            <Card key={s.slotId} testID={`ajo-slot-${s.slotId}`}>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 flex-row items-center gap-3">
                  <Text variant="h3">{ordinal(s.position)}</Text>
                  <Text variant="body" className="flex-1">
                    {s.name}
                    {s.shareNo > 1 ? ` (share ${s.shareNo})` : ''}
                  </Text>
                </View>
                {s.paid ? <AjoStatusBadge status="PAID" label="Collected" /> : null}
              </View>
              {approvePayout && canWrite && group?.status === 'ACTIVE' && !s.paid ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    setExceptionSlot(s);
                    setNewPosition(null);
                    exceptionSheet.current?.present();
                  }}
                  testID={`ajo-exception-${s.slotId}`}
                >
                  Emergency change
                </Button>
              ) : null}
            </Card>
          ))}
          {data.slots.length === 0 ? <EmptyState icon={ListOrdered} title="There are no places yet." /> : null}
        </View>
      )}

      {data?.drawn && can && nobodyPaidYet ? (
        <Card testID="ajo-swap-form">
          <View className="gap-3">
            <Text variant="h3">Swap two places</Text>
            <Text variant="body" tone="secondary">
              Allowed until the first payout is prepared. An admin approves each swap.
            </Text>
            <SelectSheet control={control} name="a" label="First place" options={slotOptions} placeholder="Choose…" testID="ajo-swap-a" />
            <SelectSheet control={control} name="b" label="Second place" options={slotOptions} placeholder="Choose…" testID="ajo-swap-b" />
            <TextField control={control} name="reason" label="Reason (optional)" multiline />
            <Button loading={request.isPending} onPress={() => void submitSwap()} testID="ajo-swap-request">
              Request the swap
            </Button>
          </View>
        </Card>
      ) : null}

      {swaps.data && swaps.data.length > 0 ? (
        <View className="gap-3">
          <Text variant="h2">Swap requests</Text>
          {swaps.data.map((s) => (
            <Card key={s.id} testID={`ajo-swap-${s.id}`}>
              <View className="gap-2">
                <Text variant="body">
                  {slotName(s.slotAId)} ↔ {slotName(s.slotBId)}
                </Text>
                {s.reason ? (
                  <Text variant="caption" tone="tertiary">
                    {s.reason}
                  </Text>
                ) : null}
                <AjoStatusBadge
                  status={s.status === 'PENDING' ? 'PENDING' : s.status === 'APPROVED' ? 'CONFIRMED' : 'REJECTED'}
                  label={s.status === 'PENDING' ? 'Waiting for an admin' : s.status === 'APPROVED' ? 'Approved' : s.status === 'REJECTED' ? 'Turned down' : 'Withdrawn'}
                />
                {s.status === 'PENDING' && approvePayout && canWrite ? (
                  <View className="flex-row gap-2">
                    <Button size="sm" onPress={() => void run(() => decide.mutateAsync({ swapId: s.id, decision: 'APPROVED' }), 'The swap was approved.')} testID={`ajo-swap-approve-${s.id}`}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onPress={() => void run(() => decide.mutateAsync({ swapId: s.id, decision: 'REJECTED' }), 'The swap was turned down.')}>
                      Turn down
                    </Button>
                  </View>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {data && data.history.length > 0 ? (
        <Card>
          <View className="gap-1">
            <Text variant="h3">History of changes</Text>
            {data.history.map((h) => (
              <Text key={h.id} variant="caption" tone="secondary">
                {formatMoment(h.createdAt)} · {h.type.toLowerCase()}
                {h.reason ? ` · ${h.reason}` : ''}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}

      <AjoActionSheet
        ref={exceptionSheet}
        title="Emergency change of place"
        summary={exceptionSlot ? `${exceptionSlot.name} is ${ordinal(exceptionSlot.position)}. Only use this for a real emergency, after the first payout has been made. It is recorded with your reason.` : undefined}
        confirmLabel="Make the change"
        destructive
        reasonMin={10}
        reasonLabel="Why is this needed"
        validate={() => (newPosition ? null : 'Choose the place to move them to.')}
        onConfirm={({ reason }) => ajoApi.exception(groupId, { slotId: exceptionSlot?.slotId ?? 0, newPosition: newPosition ?? 0, reason })}
        successMessage="The place was changed and the reason recorded."
        testID="ajo-exception-sheet"
      >
        <View className="gap-2">
          <Text variant="label" tone="secondary">
            Move to place
          </Text>
          {(data?.slots ?? [])
            .filter((s) => !s.paid && s.slotId !== exceptionSlot?.slotId)
            .map((s) => (
              <TickRow key={s.slotId} label={ordinal(s.position)} checked={newPosition === s.position} onToggle={() => setNewPosition(s.position)} testID={`ajo-exception-to-${s.position}`} />
            ))}
        </View>
      </AjoActionSheet>
    </AjoScreen>
  );
}
