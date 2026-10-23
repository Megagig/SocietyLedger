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
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { penaltyCanWaive, waiveOutcomeSummary } from '@/features/donationsPenalties/labels';
import { useWaivePenalty } from '@/features/donationsPenalties/mutations';
import { PENALTY_APPROVE_ACCESS } from '@/features/donationsPenalties/queries';
import { buildWaiveSchema, type WaiveFormValues } from '@/features/donationsPenalties/schemas';
import { chargeMemberName } from '@/features/finance/labels';
import { useCharge } from '@/features/finance/queries';
import { parseAmount } from '@/features/finance/schemas';
import { useCan } from '@/hooks/useCan';

/**
 * project-overview.md §6.9 FN11 — waive (forgive) all or part of a penalty. The penalty's amount goes down by what is waived, the
 * member's ledger is credited, and the reason is kept in the waivers history. It can't be more than what is still owed.
 */
export default function WaivePenaltyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const canApprove = useCan(PENALTY_APPROVE_ACCESS);
  const query = useCharge(id);
  const waive = useWaivePenalty(id);
  const charge = query.data;
  const owed = charge ? Math.max(0, Number(charge.balance)) : 0;
  const schema = useMemo(() => buildWaiveSchema(owed), [owed]);
  const { control, handleSubmit } = useForm<WaiveFormValues>({ resolver: zodResolver(schema), values: { amount: owed > 0 ? String(owed) : '', reason: '' }, mode: 'onTouched' });
  const back = () => router.back();

  if (!canApprove) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Waive a penalty" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Waive a penalty" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={90} radius="lg" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (query.isError || !charge) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Waive a penalty" onBack={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  if (!penaltyCanWaive(charge)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Waive a penalty" onBack={back} />
        <ErrorState title="This can't be waived." description="Only a penalty that is still owed can be waived. It may already be paid, waived or voided." />
      </Screen>
    );
  }

  const submit = (values: WaiveFormValues) =>
    waive.mutate(
      { waivedAmount: parseAmount(values.amount) ?? 0, reason: values.reason.trim() },
      {
        onSuccess: (result) => {
          toast.success(waiveOutcomeSummary(result));
          router.back();
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'Could not waive the penalty. Try again.');
          void query.refetch();
        },
      },
    );

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Waive a penalty" onBack={back} docsKey="FN11" />

      <View className="gap-6 pb-6">
        <View className="items-center gap-1 pt-1">
          <Text variant="body" tone="secondary">
            {`${chargeMemberName(charge)} · ${charge.category.name}`}
          </Text>
          <Money value={owed} size="h1" />
          <Text variant="caption" tone="secondary">
            still owed
          </Text>
        </View>

        <Section title="What to forgive">
          <View className="gap-4">
            <AmountField control={control} name="amount" label="Amount to waive" helper="Waiving everything that is owed settles the penalty. A smaller amount lowers it." />
            <TextField control={control} name="reason" label="Reason" placeholder="First offence, hardship, our mistake…" multiline testID="waive-reason" />
          </View>
        </Section>

        <Text variant="caption" tone="secondary">
          The member&apos;s balance goes down straight away and the waiver is kept in the history with your reason. It can&apos;t be undone from here.
        </Text>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={waive.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="waive-save">
            Waive penalty
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
