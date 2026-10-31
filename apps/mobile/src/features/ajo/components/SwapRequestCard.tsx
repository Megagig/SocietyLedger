import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import { ordinal } from '../format';
import { useAjoAction } from '../mutations';
import { ajoKeys } from '../queries';

const schema = z.object({ mine: z.string().optional(), other: z.string().min(1, 'Choose the place you want to swap with.'), reason: z.string().trim().max(300).optional() });
type Values = z.infer<typeof schema>;

/** A rotating-pot member asks to swap places with someone else, before the first payout. An admin decides. */
export function SwapRequestCard({ groupId }: { groupId: number }) {
  const tenant = useTenantKey();
  const order = useQuery({ queryKey: [...ajoKeys.all(tenant), 'order', groupId], queryFn: () => ajoApi.order(groupId), retry: false });
  const request = useAjoAction((body: { slotAId: number; slotBId: number; reason?: string }) => ajoApi.requestSwap(groupId, body));
  const { control, handleSubmit, reset } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { mine: '', other: '', reason: '' } });
  const [problem, setProblem] = useState<string | null>(null);

  const slots = useMemo(() => order.data?.slots ?? [], [order.data]);
  const mySlots = useMemo(() => slots.filter((s) => s.mine), [slots]);
  const otherOptions = useMemo(() => slots.filter((s) => !s.mine).map((s) => ({ value: String(s.slotId), label: `${ordinal(s.position)} · ${s.name}` })), [slots]);
  const myOptions = useMemo(() => mySlots.map((s) => ({ value: String(s.slotId), label: ordinal(s.position) })), [mySlots]);

  if (order.isPending || order.isError || !order.data?.drawn || mySlots.length === 0) return null;
  const nobodyPaid = slots.every((s) => !s.paid);

  const submit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      await request.mutateAsync({ slotAId: Number(values.mine || mySlots[0]!.slotId), slotBId: Number(values.other), reason: values.reason?.trim() || undefined });
      toast.success('Your request was sent. An admin will decide.');
      reset();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'We could not send your request.');
    }
  });

  return (
    <Card testID="ajo-swap-card">
      <View className="gap-3">
        <Text variant="h3">Your place in the order</Text>
        <Text variant="body" tone="secondary">
          You collect {mySlots.map((s) => ordinal(s.position)).join(' and ')}.{' '}
          {nobodyPaid ? 'Until the first payout you can ask to swap with someone; an admin decides.' : 'The first payout has been made, so places can no longer be swapped. In a real emergency, speak to an admin.'}
        </Text>
        {nobodyPaid ? (
          <>
            {mySlots.length > 1 ? <SelectSheet control={control} name="mine" label="Your place" options={myOptions} placeholder={ordinal(mySlots[0]!.position)} /> : null}
            <SelectSheet control={control} name="other" label="Swap with" options={otherOptions} placeholder="Choose…" testID="ajo-swap-other" />
            <TextField control={control} name="reason" label="Why (optional)" multiline />
            {problem ? (
              <Text variant="body" tone="danger">
                {problem}
              </Text>
            ) : null}
            <Button variant="secondary" loading={request.isPending} onPress={() => void submit()} testID="ajo-swap-send">
              Ask to swap
            </Button>
          </>
        ) : null}
      </View>
    </Card>
  );
}
