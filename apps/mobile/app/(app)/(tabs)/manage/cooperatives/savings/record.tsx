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
import { availabilityLine, SAVINGS_METHOD_OPTIONS } from '@/features/coopManage/labels';
import { useRecordSavings } from '@/features/coopManage/mutations';
import { COOP_MODULE, COOP_SAVINGS_ACCESS, useAccount } from '@/features/coopManage/queries';
import { buildRecordSavingsSchema, toRecordSavingsPayload, type RecordSavingsValues } from '@/features/coopManage/schemas';
import { useMemberCooperative } from '@/features/members/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';

/**
 * project-overview.md §6.9 CP2 — record money an officer took in or paid out on a member's savings account. A withdrawal can't be more
 * than is available (savings held against a loan can't leave) and can't take the account below zero.
 */
export default function RecordSavingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const id = Number(params.id);
  const type = params.type === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'DEPOSIT';
  const allowed = useModuleAccess(COOP_SAVINGS_ACCESS, COOP_MODULE);
  const query = useAccount(id);
  const account = query.data;
  const profile = useMemberCooperative(account?.memberId ?? NaN, account !== undefined);
  const record = useRecordSavings();
  const held = profile.data ? Number(profile.data.lockedSavings) : 0;
  const available = account ? Math.max(0, Math.min(Number(account.balance), profile.data ? Number(profile.data.availableSavings) : Number(account.balance))) : 0;
  const schema = useMemo(() => buildRecordSavingsSchema(type, available), [type, available]);
  const { control, handleSubmit } = useForm<RecordSavingsValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', paymentMethod: 'CASH', reference: '', notes: '' },
    mode: 'onTouched',
  });
  const back = () => router.back();
  const title = type === 'DEPOSIT' ? 'Record a deposit' : 'Record a withdrawal';

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={90} radius="lg" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (query.isError || !account) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const submit = (values: RecordSavingsValues) =>
    record.mutate(toRecordSavingsPayload(values, id, type), {
      onSuccess: () => {
        toast.success(type === 'DEPOSIT' ? `Added ${formatMoney(values.amount.replace(/,/g, ''))} to the account` : `Took ${formatMoney(values.amount.replace(/,/g, ''))} out of the account`);
        router.back();
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : 'Could not record it. Try again.');
        void query.refetch();
      },
    });

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="CP2" />

      <View className="gap-6 pb-6">
        <View className="items-center gap-1 pt-1">
          <Text variant="body" tone="secondary">
            {`${account.memberName} · ${account.accountNumber}`}
          </Text>
          <Money value={account.balance} size="h1" />
          <Text variant="caption" tone="secondary">
            {type === 'WITHDRAWAL' ? availabilityLine(available, held) : 'current balance'}
          </Text>
        </View>

        <Section title={type === 'DEPOSIT' ? 'Money received' : 'Money paid out'}>
          <View className="gap-4">
            <AmountField control={control} name="amount" label="Amount" presets={[1000, 5000, 10000, 50000]} />
            <SelectSheet control={control} name="paymentMethod" label="How" options={SAVINGS_METHOD_OPTIONS} placeholder="Choose how" />
            <TextField control={control} name="reference" label="Reference (optional)" />
            <TextField control={control} name="notes" label="Note (optional)" multiline />
          </View>
        </Section>

        <Text variant="caption" tone="secondary">
          {type === 'DEPOSIT' ? 'Only record money you have actually received. The balance goes up straight away.' : 'The balance goes down straight away. It can’t be undone from here.'}
        </Text>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={record.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="savings-record-save">
            {type === 'DEPOSIT' ? 'Record deposit' : 'Record withdrawal'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
