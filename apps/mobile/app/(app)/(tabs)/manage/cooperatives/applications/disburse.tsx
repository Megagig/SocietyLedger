import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { applicationCanDisburse, disbursedSummary, DISBURSEMENT_OPTIONS, isOwnRequest } from '@/features/coopManage/labels';
import { useDisburseLoan } from '@/features/coopManage/mutations';
import { COOP_LOANS_ACCESS, COOP_MODULE, useApplication, useMemberOpenAccounts } from '@/features/coopManage/queries';
import { disburseSchema, toDisbursePayload, type DisburseValues } from '@/features/coopManage/schemas';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';
import type { DisbursementMethod } from '@/types/api/coopManage';

/**
 * project-overview.md §6.9 CP4 — pay an approved loan out, once. Credited to savings it goes into one of the borrower's own open
 * accounts; otherwise the officer records how it was paid. The loan, its repayment schedule and (if the product asks) the held
 * savings are created in the same step.
 */
export default function DisburseLoanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess(COOP_LOANS_ACCESS, COOP_MODULE);
  const ownMemberId = useMemberId();
  const query = useApplication(id);
  const application = query.data;
  const accounts = useMemberOpenAccounts(application?.memberId ?? null);
  const disburse = useDisburseLoan(id);
  const { control, handleSubmit } = useForm<DisburseValues>({
    resolver: zodResolver(disburseSchema),
    defaultValues: { method: 'bank_transfer', savingsAccountId: '', reference: '', notes: '' },
    mode: 'onTouched',
  });
  const method = useWatch({ control, name: 'method' });
  const accountOptions = useMemo(() => (accounts.data ?? []).map((a) => ({ value: String(a.id), label: `${a.accountNumber} · ${formatMoney(a.balance)}` })), [accounts.data]);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay out the loan" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Pay out the loan" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={90} radius="lg" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (query.isError || !application) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay out the loan" onBack={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  if (!applicationCanDisburse(application.status)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay out the loan" onBack={back} />
        <ErrorState title={application.status === 'DISBURSED' ? 'This loan has already been paid out.' : "This loan can't be paid out yet."} description="Only an approved application can be paid out, and only once." />
      </Screen>
    );
  }

  if (isOwnRequest(application.memberId, ownMemberId)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pay out the loan" onBack={back} />
        <ErrorState title="This is your own loan." description="Another officer needs to pay it out." />
      </Screen>
    );
  }

  const net = Number(application.amount) - Number(application.processingFee);

  const submit = (values: DisburseValues) =>
    disburse.mutate(toDisbursePayload(values), {
      onSuccess: (loan) => {
        toast.success(disbursedSummary(values.method as DisbursementMethod));
        router.replace(`/(app)/(tabs)/manage/cooperatives/loans/${loan.id}` as never);
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : 'Could not pay the loan out. Try again.');
        void query.refetch();
      },
    });

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Pay out the loan" onBack={back} docsKey="CP4" />

      <View className="gap-6 pb-6">
        <View className="items-center gap-1 pt-1">
          <Text variant="body" tone="secondary">
            {application.memberName}
          </Text>
          <Money value={application.amount} size="h1" />
          <Text variant="caption" tone="secondary">
            {`${formatMoney(net)} to pay out after the ${formatMoney(application.processingFee)} processing fee`}
          </Text>
        </View>

        <Section title="How it is paid out">
          <View className="gap-4">
            <SelectSheet control={control} name="method" label="Method" options={DISBURSEMENT_OPTIONS} placeholder="Choose how" testID="disburse-method" />
            {method === 'savings_credit' ? (
              <SelectSheet
                control={control}
                name="savingsAccountId"
                label="Savings account to credit"
                options={accountOptions}
                placeholder={accounts.isPending ? 'Loading accounts…' : accountOptions.length === 0 ? 'This member has no open savings account' : 'Choose an account'}
                testID="disburse-account"
              />
            ) : null}
            <TextField control={control} name="reference" label="Reference (optional)" />
            <TextField control={control} name="notes" label="Note (optional)" multiline />
          </View>
        </Section>

        <Text variant="caption" tone="secondary">
          This starts the repayment schedule and can&apos;t be done twice. If the product holds savings against the loan, that is set up now.
        </Text>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={disburse.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="disburse-save">
            Pay out loan
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
