import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
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
import { loanCanTakeRepayment, REPAYMENT_METHOD_OPTIONS } from '@/features/coopManage/labels';
import { useRecordRepayment } from '@/features/coopManage/mutations';
import { COOP_LOANS_ACCESS, COOP_MODULE, useLoan } from '@/features/coopManage/queries';
import { buildRepaymentSchema, type RepaymentValues } from '@/features/coopManage/schemas';
import { parseAmount } from '@/features/finance/schemas';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';

/** project-overview.md §6.9 CP5 — record a repayment a member made without a request. It can't be more than is still owed. */
export default function RecordRepaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess(COOP_LOANS_ACCESS, COOP_MODULE);
  const query = useLoan(id);
  const loan = query.data;
  const outstanding = loan ? Number(loan.outstandingBalance) : 0;
  const record = useRecordRepayment();
  const schema = useMemo(() => buildRepaymentSchema(outstanding), [outstanding]);
  const { control, handleSubmit } = useForm<RepaymentValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', paymentMethod: 'cash', reference: '', notes: '' },
    mode: 'onTouched',
  });
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Record a repayment" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Record a repayment" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={90} radius="lg" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (query.isError || !loan) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Record a repayment" onBack={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  if (!loanCanTakeRepayment(loan.status)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Record a repayment" onBack={back} />
        <ErrorState title="Nothing to repay." description="This loan is not active, so no repayment can be recorded on it." />
      </Screen>
    );
  }

  const submit = (values: RepaymentValues) =>
    record.mutate(
      { loanId: id, amount: parseAmount(values.amount) ?? 0, paymentMethod: values.paymentMethod, reference: values.reference.trim() || undefined, notes: values.notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`Recorded ${formatMoney(values.amount.replace(/,/g, ''))} against ${loan.memberName}'s loan`);
          router.back();
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'Could not record the repayment. Try again.');
          void query.refetch();
        },
      },
    );

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Record a repayment" onBack={back} docsKey="CP5" />

      <View className="gap-6 pb-6">
        <View className="items-center gap-1 pt-1">
          <Text variant="body" tone="secondary">
            {`${loan.memberName} · ${loan.loanNumber}`}
          </Text>
          <Money value={loan.outstandingBalance} size="h1" />
          <Text variant="caption" tone="secondary">
            still owed
          </Text>
        </View>

        <Section title="Money received">
          <View className="gap-4">
            <AmountField
              control={control}
              name="amount"
              label="Amount"
              helper={loan.nextPaymentAmount ? `Next payment: ${formatMoney(loan.nextPaymentAmount)}` : undefined}
              presets={loan.nextPaymentAmount ? [Number(loan.nextPaymentAmount)] : undefined}
            />
            <SelectSheet control={control} name="paymentMethod" label="How it was paid" options={REPAYMENT_METHOD_OPTIONS} placeholder="Choose how" />
            <TextField control={control} name="reference" label="Reference (optional)" />
            <TextField control={control} name="notes" label="Note (optional)" multiline />
          </View>
        </Section>

        <Text variant="caption" tone="secondary">
          Only record money you have actually received. It is put against the oldest unpaid instalment first, and can&apos;t be more than is owed.
        </Text>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={record.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="repay-save">
            Record repayment
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
