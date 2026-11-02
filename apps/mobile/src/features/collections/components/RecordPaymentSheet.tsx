import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Check } from 'lucide-react-native';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { DateField } from '@/components/forms/DateField';
import { FieldInput } from '@/components/forms/FieldInput';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { PAYMENT_METHOD_OPTIONS } from '@/features/finance/labels';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { PaymentSource, RecordedPaymentDTO } from '@/types/api/collections';
import { amountProblem, KIND_LABELS, paymentFailure } from '../labels';
import { useOpenCharges, useRecordPayments } from '../queries';

export type RecordPaymentTarget = {
  /** The member's database id (not the member number). */
  memberId: number;
  /** Shown instead of the member's name, for an anonymous donor. */
  memberLabel?: string;
  /** The one debt the officer chose. Left out, every open debt is ticked at its full balance (the Member Ledger). */
  preselectTransactionId?: number;
};

type FormValues = { method: string; paymentDate: string; notes: string };

type Props = {
  target: RecordPaymentTarget | null;
  source: PaymentSource;
  /** Called once the payments are saved, so the screen behind can refresh. */
  onRecorded?: () => void;
};

/**
 * Record a payment an officer has received. It lists everything the member still owes; the officer ticks what this payment settles and can
 * change an amount to a part payment. Everything ticked is saved together or not at all, and each debt gets its own receipt.
 */
export const RecordPaymentSheet = forwardRef<BottomSheetModal, Props>(function RecordPaymentSheet({ target, source, onRecorded }, ref) {
  const { color } = useThemeTokens();
  const { height } = useWindowDimensions();
  const memberId = target?.memberId ?? null;
  const charges = useOpenCharges(memberId);
  const record = useRecordPayments();
  const data = charges.data;

  const [picked, setPicked] = useState<Record<number, string>>({});
  const [failure, setFailure] = useState<{ message: string; transactionId?: number } | null>(null);
  const [receipts, setReceipts] = useState<RecordedPaymentDTO[] | null>(null);
  const { control, handleSubmit, reset } = useForm<FormValues>({ defaultValues: { method: 'cash', paymentDate: new Date().toISOString(), notes: '' } });

  // A fresh start for each member or debt chosen.
  const key = `${target?.memberId ?? 'none'}:${target?.preselectTransactionId ?? 'all'}`;
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setPicked({});
    setFailure(null);
    setReceipts(null);
    reset({ method: 'cash', paymentDate: new Date().toISOString(), notes: '' });
  }

  // Tick the right debts once they have loaded.
  useEffect(() => {
    if (!data) return;
    const start: Record<number, string> = {};
    for (const c of data.charges) {
      if (target?.preselectTransactionId === undefined || c.transactionId === target.preselectTransactionId) start[c.transactionId] = String(c.balance);
    }
    setPicked(start);
  }, [data, target?.preselectTransactionId]);

  const lines = useMemo(
    () => Object.entries(picked).map(([id, text]) => ({ transactionId: Number(id), text, charge: data?.charges.find((c) => c.transactionId === Number(id)) })),
    [picked, data],
  );
  const problems = lines.map((l) => (l.charge ? amountProblem(l.text, l.charge.balance) : null));
  const total = lines.reduce((sum, l) => sum + (Number.isFinite(Number(l.text)) ? Number(l.text) : 0), 0);
  const invalid = lines.length === 0 || problems.some(Boolean);
  const canRecord = data?.canRecord !== false;

  const toggle = (transactionId: number, balance: number) =>
    setPicked((current) => {
      const next = { ...current };
      if (transactionId in next) delete next[transactionId];
      else next[transactionId] = String(balance);
      return next;
    });

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const saved = await record.mutateAsync({
        items: lines.map((l) => ({ transactionId: l.transactionId, amountPaid: Math.round(Number(l.text) * 100) / 100 })),
        paymentMethod: values.method,
        paymentDate: values.paymentDate,
        notes: values.notes.trim() || undefined,
        source,
      });
      setReceipts(saved);
      onRecorded?.();
    } catch (error) {
      setFailure(paymentFailure(error));
    }
  });

  const close = () => (ref as React.RefObject<BottomSheetModal | null>)?.current?.dismiss();

  return (
    <BottomSheet ref={ref} title={receipts ? 'Payment recorded' : 'Record payment'} snapPoints={['85%']}>
      {receipts ? (
        <View className="gap-4 pb-4" testID="payment-receipts">
          <View className="flex-row items-center gap-2">
            <Check size={18} color={color.success} />
            <Text variant="body-lg">{receipts.length === 1 ? 'The payment was saved.' : `All ${receipts.length} payments were saved.`}</Text>
          </View>
          <View className="gap-2">
            {receipts.map((r) => (
              <View key={r.paymentId} className="flex-row items-center justify-between gap-3 rounded-md border border-border p-3">
                <View className="flex-1">
                  <Text variant="body">{r.label}</Text>
                  <Text variant="caption" tone="secondary">{`Receipt ${r.receiptNumber}`}</Text>
                </View>
                <View className="items-end">
                  <Money value={r.amountPaid} />
                  {r.transactionStatus === 'paid' ? (
                    <Text variant="caption" tone="secondary">Fully paid</Text>
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <Text variant="caption" tone="secondary">Still owes</Text>
                      <Money value={r.remainingBalance} size="caption" tone="secondary" />
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
          <Button variant="primary" fullWidth onPress={close} testID="payment-done">
            Done
          </Button>
        </View>
      ) : charges.isPending && memberId !== null ? (
        <View className="gap-3 pb-6">
          <Skeleton width="100%" height={64} radius="md" />
          <Skeleton width="100%" height={64} radius="md" />
        </View>
      ) : charges.isError || !data ? (
        <ErrorState error={charges.error} onRetry={() => charges.refetch()} />
      ) : data.charges.length === 0 ? (
        <View className="gap-3 pb-6">
          <Text variant="body" tone="secondary">{`${target?.memberLabel ?? data.member.name} has no unpaid charges.`}</Text>
          <Button variant="secondary" fullWidth onPress={close}>
            Close
          </Button>
        </View>
      ) : (
        <View className="gap-4 pb-2">
          <View>
            <Text variant="body-lg">
              {target?.memberLabel ?? data.member.name}
              {target?.memberLabel ? '' : ` (${data.member.memberNumber})`}
            </Text>
            <View className="flex-row items-center gap-1">
              <Text variant="caption" tone="secondary">Owes</Text>
              <Money value={data.totalOwed} size="caption" tone="secondary" />
              <Text variant="caption" tone="secondary">in total. Tick what this payment settles.</Text>
            </View>
          </View>

          {!canRecord ? (
            <View className="rounded-md bg-warning-soft p-3" accessibilityRole="alert">
              <Text variant="body">{data.reason ?? 'You cannot record this payment.'}</Text>
            </View>
          ) : null}

          <ScrollView style={{ maxHeight: height * 0.4 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            <View className="gap-2">
              {data.charges.map((charge) => {
                const on = charge.transactionId in picked;
                const index = lines.findIndex((l) => l.transactionId === charge.transactionId);
                const problem = index >= 0 ? problems[index] : null;
                const refused = failure?.transactionId === charge.transactionId;
                return (
                  <View key={charge.transactionId} className={cn('gap-2 rounded-md border p-3', refused ? 'border-danger bg-danger-soft' : 'border-border bg-surface')}>
                    <Pressable
                      onPress={() => canRecord && toggle(charge.transactionId, charge.balance)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled: !canRecord }}
                      accessibilityLabel={`${charge.label}, balance ${charge.balance} naira`}
                      className="min-h-[44px] flex-row items-center gap-3"
                      testID={`charge-${charge.transactionId}`}
                    >
                      <View className={cn('h-5 w-5 items-center justify-center rounded-xs border', on ? 'border-primary bg-primary' : 'border-border-strong bg-surface')}>
                        {on ? <Check size={14} color={color.textInverse} strokeWidth={2.5} /> : null}
                      </View>
                      <View className="flex-1">
                        <Text variant="body">{charge.category}</Text>
                        {charge.purpose ? (
                          <Text variant="body-strong" testID={`charge-purpose-${charge.transactionId}`}>{charge.purpose}</Text>
                        ) : null}
                        <Text variant="caption" tone="secondary">
                          {`${KIND_LABELS[charge.kind]}${charge.dueDate ? ` · due ${formatDate(charge.dueDate, 'short')}` : ''}${charge.paid > 0 ? ' · part paid' : ''}`}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text variant="caption" tone="secondary">Balance</Text>
                        <Money value={charge.balance} />
                      </View>
                    </Pressable>
                    {on ? (
                      <View className="gap-1">
                        <Text variant="label">Amount received</Text>
                        <FieldInput
                          value={picked[charge.transactionId]}
                          onChangeText={(text) => setPicked((current) => ({ ...current, [charge.transactionId]: text.replace(/[^0-9.]/g, '') }))}
                          keyboardType="decimal-pad"
                          editable={canRecord}
                          accessibilityLabel={`Amount received for ${charge.label}`}
                          className="h-11 rounded-md border border-border-strong bg-surface px-3 text-text"
                          placeholderTextColor={color.textSecondary}
                          testID={`amount-${charge.transactionId}`}
                        />
                        {problem ? <Text variant="caption" tone="danger">{problem}</Text> : null}
                      </View>
                    ) : null}
                    {refused && failure ? <Text variant="caption" tone="danger">{failure.message}</Text> : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View className="gap-3">
            <SelectSheet control={control} name="method" label="How was it paid?" options={PAYMENT_METHOD_OPTIONS} placeholder="Choose the method" />
            <DateField control={control} name="paymentDate" label="Date received" maximumDate={new Date()} />
            <TextField control={control} name="notes" label="Note (optional)" />
          </View>

          {failure && !failure.transactionId ? (
            <View className="rounded-md bg-danger-soft p-3" accessibilityRole="alert">
              <Text variant="body" tone="danger">{failure.message}</Text>
            </View>
          ) : null}
          {failure?.transactionId ? (
            <View className="rounded-md bg-danger-soft p-3" accessibilityRole="alert">
              <Text variant="body" tone="danger">Nothing was saved. Fix the debt marked above and try again.</Text>
            </View>
          ) : null}

          <View className="flex-row items-center gap-1">
            <Text variant="caption" tone="secondary">Recording</Text>
            <Money value={total} size="caption" tone="secondary" />
            <Text variant="caption" tone="secondary">{`across ${lines.length} ${lines.length === 1 ? 'debt' : 'debts'}`}</Text>
          </View>
          <Button variant="primary" fullWidth loading={record.isPending} disabled={!canRecord || invalid} onPress={() => void submit()} testID="payment-submit">
            Record payment
          </Button>
        </View>
      )}
    </BottomSheet>
  );
});
