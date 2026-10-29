import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { AmountField } from '@/components/forms/AmountField';
import { Checkbox } from '@/components/forms/Checkbox';
import { TextField } from '@/components/forms/TextField';
import { ErrorState } from '@/components/feedback/ErrorState';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { HandoverDTO } from '@/types/api/ajo';
import { formatKobo, nairaToKoboString } from '../format';
import { useAjoAction } from '../mutations';
import { ajoKeys } from '../queries';
import { MIN_SELF_NOTE, reconcileSchema, type ReconcileValues } from '../schemas';
import { AjoLoading } from './AjoStates';
import { TickRow } from './TickRow';

export type ReconcileSheetHandle = { open: (handover: HandoverDTO) => void };

/**
 * Reconciling a handover: the officer counts the cash and ticks the payments that were really there. Each ticked payment is confirmed;
 * anything left unticked is marked missing and stays unconfirmed. A collector's difference is never written off silently.
 */
export const ReconcileSheet = forwardRef<ReconcileSheetHandle>(function ReconcileSheet(_props, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const tenant = useTenantKey();
  const [handover, setHandover] = useState<HandoverDTO | null>(null);
  // Everything starts ticked, so the officer unticks what was not there. `null` means "not touched yet".
  const [unticked, setUnticked] = useState<Set<number>>(new Set());
  const [needsOwn, setNeedsOwn] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<ReconcileValues>({ resolver: zodResolver(reconcileSchema), defaultValues: { counted: '', note: '', own: false } });
  const own = useWatch({ control, name: 'own' });
  const note = useWatch({ control, name: 'note' }) ?? '';
  const detail = useQuery({ queryKey: ajoKeys.staff(tenant, 'handover', handover?.id), queryFn: () => ajoApi.handover(handover?.id ?? 0), enabled: handover !== null });
  const reconcile = useAjoAction((input: { id: number; body: Parameters<typeof ajoApi.reconcileHandover>[1] }) => ajoApi.reconcileHandover(input.id, input.body));
  const payments = detail.data?.payments ?? [];
  const received = payments.filter((p) => !unticked.has(p.contributionId));
  const tickedKobo = received.reduce((sum, p) => sum + BigInt(p.amountKobo), BigInt(0));

  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        setHandover(next);
        setUnticked(new Set());
        sheet.current?.present();
      },
    }),
    [],
  );

  const submit = handleSubmit(async (values) => {
    if (!handover) return;
    setProblem(null);
    try {
      await reconcile.mutateAsync({
        id: handover.id,
        body: { countedKobo: nairaToKoboString(values.counted) ?? '0', receivedContributionIds: received.map((p) => p.contributionId), note: (values.note ?? '').trim() || undefined, confirmOwn: values.own || undefined },
      });
      toast.success('The handover was reconciled.');
      sheet.current?.dismiss();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SELF_CONFIRM_NEEDS_NOTE') setNeedsOwn(error.message);
      else setProblem(error instanceof ApiError ? error.message : 'Could not reconcile the handover.');
    }
  });

  return (
    <BottomSheet
      ref={sheet}
      title="Reconcile this handover"
      snapPoints={['92%']}
      onDismiss={() => {
        reset();
        setHandover(null);
        setNeedsOwn(null);
        setProblem(null);
      }}
    >
      {handover ? (
        <View className="gap-4 pb-6">
          <Text variant="body" tone="secondary">
            The collector says they handed over {formatKobo(handover.handedOverKobo)} from {formatKobo(handover.collectedKobo)} collected. Count the cash, then tick the payments that were really in it.
          </Text>
          <AmountField control={control} name="counted" label="Cash you counted" testID="ajo-reconcile-counted" />
          {detail.isPending ? (
            <AjoLoading rows={2} />
          ) : detail.isError ? (
            <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
          ) : payments.length === 0 ? (
            <Text variant="caption" tone="tertiary">
              No payments are attached to this handover.
            </Text>
          ) : (
            <View className="gap-2">
              {payments.map((p) => (
                <TickRow
                  key={p.contributionId}
                  label={`${p.name} · ${formatKobo(p.amountKobo)}`}
                  meta={p.reference ?? undefined}
                  checked={!unticked.has(p.contributionId)}
                  onToggle={() =>
                    setUnticked((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.contributionId)) next.delete(p.contributionId);
                      else next.add(p.contributionId);
                      return next;
                    })
                  }
                  testID={`ajo-reconcile-tick-${p.contributionId}`}
                />
              ))}
            </View>
          )}
          <Text variant="caption" tone="tertiary">
            Ticked payments add up to {formatKobo(tickedKobo)}.
          </Text>
          <TextField control={control} name="note" label="Note (optional)" multiline />
          {needsOwn ? (
            <View className="gap-2 rounded-md bg-warning-soft p-3">
              <Text variant="caption" tone="warning">
                {needsOwn}
              </Text>
              <Checkbox control={control} name="own" label="I am the only person who can reconcile here, and I counted it myself." testID="ajo-reconcile-own" />
            </View>
          ) : null}
          {problem ? (
            <Text variant="body" tone="danger">
              {problem}
            </Text>
          ) : null}
          <View className="flex-row gap-3">
            <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
              Cancel
            </Button>
            <Button fullWidth loading={reconcile.isPending} disabled={needsOwn !== null && (!own || note.trim().length < MIN_SELF_NOTE)} onPress={() => void submit()} testID="ajo-reconcile-submit">
              Reconcile
            </Button>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
});
