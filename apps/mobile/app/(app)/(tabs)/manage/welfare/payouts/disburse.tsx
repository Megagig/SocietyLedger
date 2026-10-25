import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
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
import { isOwnRequest } from '@/features/coopManage/labels';
import { PAYMENT_METHOD_OPTIONS } from '@/features/finance/labels';
import { payoutCanDisburse } from '@/features/welfareManage/labels';
import { useDisbursePayout } from '@/features/welfareManage/mutations';
import { usePayoutById, WELFARE_MODULE, WELFARE_PAYOUT_ACCESS } from '@/features/welfareManage/queries';
import { disburseSchema, type DisburseValues } from '@/features/welfareManage/schemas';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';

/**
 * project-overview.md §6.9 WF4 — pay an approved request out, once. The money leaves the fund in the same step, and only if the fund
 * still holds it; the officer records how it was paid.
 */
export default function DisbursePayoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess(WELFARE_PAYOUT_ACCESS, WELFARE_MODULE);
  const ownMemberId = useMemberId();
  const lookup = usePayoutById(id);
  const request = lookup.request;
  const disburse = useDisbursePayout(id);
  const { control, handleSubmit } = useForm<DisburseValues>({ resolver: zodResolver(disburseSchema), defaultValues: { method: 'cash', reference: '', notes: '' }, mode: 'onTouched' });
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay out" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (lookup.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Pay out" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={90} radius="lg" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (!request || lookup.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay out" onBack={back} />
        <ErrorState error={lookup.error} onRetry={() => lookup.refetch()} />
      </Screen>
    );
  }

  if (!payoutCanDisburse(request.status)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay out" onBack={back} />
        <ErrorState title={request.status === 'DISBURSED' ? 'This has already been paid out.' : "This can't be paid out yet."} description="Only an approved request can be paid out, and only once." />
      </Screen>
    );
  }

  if (isOwnRequest(request.memberId, ownMemberId)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay out" onBack={back} />
        <ErrorState title="This is your own request." description="Another officer needs to pay it out." />
      </Screen>
    );
  }

  const amount = request.approvedAmount ?? request.amount;

  const submit = (values: DisburseValues) =>
    disburse.mutate(
      { disbursementMethod: values.method, disbursementReference: values.reference.trim() || undefined, notes: values.notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`Paid out ${formatMoney(amount)} from ${request.fund.name}`);
          router.back();
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'Could not pay it out. Try again.');
          void lookup.refetch();
        },
      },
    );

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Pay out" onBack={back} docsKey="WF4" />

      <View className="gap-6 pb-6">
        <View className="items-center gap-1 pt-1">
          <Text variant="body" tone="secondary">
            {`${request.member.firstName} ${request.member.lastName} · ${request.fund.name}`}
          </Text>
          <Money value={amount} size="h1" />
          <Text variant="caption" tone="secondary">
            approved to pay out
          </Text>
        </View>

        <Section title="How it is paid">
          <View className="gap-4">
            <SelectSheet control={control} name="method" label="Method" options={PAYMENT_METHOD_OPTIONS} placeholder="Choose how" testID="payout-method" />
            <TextField control={control} name="reference" label="Reference (optional)" />
            <TextField control={control} name="notes" label="Note (optional)" multiline />
          </View>
        </Section>

        <Text variant="caption" tone="secondary">
          The amount leaves the fund now, and this can&apos;t be done twice. If the fund no longer holds enough, nothing is paid out.
        </Text>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={disburse.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="payout-save">
            Pay out
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
