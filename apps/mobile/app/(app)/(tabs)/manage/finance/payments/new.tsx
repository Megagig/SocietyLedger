import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { PAYMENT_METHOD_OPTIONS } from '@/features/finance/labels';
import { useRecordPayment } from '@/features/finance/mutations';
import { PAYMENT_RECORD_ACCESS, useCharge, useMemberOpenCharges } from '@/features/finance/queries';
import { isManualMethod, paymentAmountProblem, paymentFormSchema, parseAmount } from '@/features/finance/schemas';
import { MemberPickerField } from '@/features/members/components/MemberPickerField';
import { useCan } from '@/hooks/useCan';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';

const formSchema = paymentFormSchema.extend({ member: z.object({ id: z.number(), name: z.string() }).nullable() });
type FormValues = z.infer<typeof formSchema>;

/**
 * project-overview.md §6.9 FN5 — record money a member paid you directly: choose the member, the charge it is for, then the amount,
 * how it was paid and when. Opened from a charge (`?transactionId=`), the member and charge are already chosen.
 */
export default function RecordPaymentScreen() {
  const router = useRouter();
  const { color } = useThemeTokens();
  const params = useLocalSearchParams<{ transactionId?: string }>();
  const presetId = params.transactionId ? Number(params.transactionId) : undefined;
  const canPay = useCan(PAYMENT_RECORD_ACCESS);
  const record = useRecordPayment();
  const preset = useCharge(presetId ?? NaN);
  const [chargeId, setChargeId] = useState<number | null>(presetId ?? null);
  const { control, handleSubmit, setValue } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { member: null, amount: '', method: 'cash', paymentDate: new Date().toISOString(), notes: '' },
    mode: 'onTouched',
  });
  const member = useWatch({ control, name: 'member' });
  const amountText = useWatch({ control, name: 'amount' });
  const openCharges = useMemberOpenCharges(member?.id ?? null);
  const back = () => router.back();

  const charges = openCharges.data ?? [];
  const selected = charges.find((c) => c.id === chargeId) ?? (preset.data && preset.data.id === chargeId ? preset.data : null);
  const balance = selected ? Number(selected.balance) : 0;
  const tooMuch = selected ? paymentAmountProblem(amountText ?? '', balance) : null;

  // Opened from a charge: choose its member and charge, and offer the balance.
  useEffect(() => {
    const c = preset.data;
    if (!c) return;
    setValue('member', { id: c.member.id, name: `${c.member.firstName} ${c.member.lastName}`.trim() });
    setValue('amount', String(Number(c.balance)));
  }, [preset.data, setValue]);

  if (!canPay) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Record a payment" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (presetId !== undefined && preset.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Record a payment" onBack={back} />
        <Skeleton width="100%" height={120} radius="md" />
      </Screen>
    );
  }

  if (presetId !== undefined && preset.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Record a payment" onBack={back} />
        <ErrorState error={preset.error} onRetry={() => preset.refetch()} />
      </Screen>
    );
  }

  const choose = (id: number, owed: number) => {
    setChargeId(id);
    setValue('amount', String(owed));
  };

  const onSubmit = (values: FormValues) => {
    if (!selected || !isManualMethod(values.method)) return;
    const amount = parseAmount(values.amount);
    if (amount === null || tooMuch) return;
    record.mutate(
      { transactionId: selected.id, amountPaid: amount, paymentMethod: values.method, paymentDate: values.paymentDate, notes: values.notes.trim() || null },
      {
        onSuccess: (result) => {
          toast.success(Number(result.remainingBalance) > 0 ? 'Payment recorded — part paid' : 'Payment recorded — paid in full');
          router.replace(`/(app)/(tabs)/manage/finance/transactions/${selected.id}` as never);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not record the payment. Try again.'),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Record a payment" onBack={back} docsKey="FN5" />

      <View className="gap-6 pb-6">
        <Section title="Who paid">
          <MemberPickerField
            control={control}
            name="member"
            label="Member"
            helper={presetId ? undefined : 'Search by name, member ID, email or phone.'}
            testID="payment-member"
          />
        </Section>

        {member ? (
          <Section title="Which charge">
            {openCharges.isPending && !preset.data ? (
              <Skeleton width="100%" height={72} radius="md" />
            ) : openCharges.isError ? (
              <ErrorState error={openCharges.error} onRetry={() => openCharges.refetch()} />
            ) : charges.length === 0 && !selected ? (
              <Text variant="body" tone="secondary">
                This member has nothing outstanding to pay.
              </Text>
            ) : (
              <View className="gap-2">
                {(selected && !charges.some((c) => c.id === selected.id) ? [selected as never, ...charges] : charges).map((c: (typeof charges)[number]) => {
                  const on = chargeId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => choose(c.id, Number(c.balance))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      className={cn('flex-row items-center justify-between gap-3 rounded-md border p-3', on ? 'border-primary bg-primary-soft' : 'border-border bg-surface')}
                      testID={`payment-charge-${c.id}`}
                    >
                      <View className="flex-1">
                        <Text variant="body-strong" numberOfLines={1}>
                          {c.category.name}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          {c.dueDate ? `Due ${formatDate(c.dueDate, 'long')}` : `Created ${formatDate(c.createdAt, 'long')}`}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Money value={c.balance} size="body-strong" tone={on ? 'primary' : 'default'} />
                        <Text variant="caption" tone="secondary">
                          left to pay
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Section>
        ) : null}

        {selected ? (
          <Section title="The payment">
            <View className="gap-4">
              <AmountField control={control} name="amount" label="Amount received" helper={`${selected.category.name} — up to ₦${balance.toLocaleString('en-NG')}.`} presets={balance > 0 ? [balance] : undefined} />
              {tooMuch ? (
                <Text variant="caption" tone="danger">
                  {tooMuch}
                </Text>
              ) : null}
              <SelectSheet control={control} name="method" label="How it was paid" options={PAYMENT_METHOD_OPTIONS} placeholder="Choose the method" />
              <DateField control={control} name="paymentDate" label="Date paid" maximumDate={new Date()} />
              <TextField control={control} name="notes" label="Note (optional)" multiline />
              <Text variant="caption" tone="secondary" style={{ color: color.textSecondary }}>
                The member is told, and their balance and statement update straight away.
              </Text>
            </View>
          </Section>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={record.isPending} disabled={!selected || !!tooMuch} onPress={() => { void handleSubmit(onSubmit)(); }} testID="payment-save">
            Record payment
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
