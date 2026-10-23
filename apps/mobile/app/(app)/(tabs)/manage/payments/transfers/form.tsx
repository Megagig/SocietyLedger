import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

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
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { MemberPickerField } from '@/features/members/components/MemberPickerField';
import { buildTransferFormSchema, emptyTransferValues, toTransferPayload, transferToFormValues, type TransferFormValues } from '@/features/nigerianPayments/bankSchemas';
import { formatAccountNumber } from '@/features/nigerianPayments/labels';
import { useRecordTransfer, useUpdateTransfer } from '@/features/nigerianPayments/mutations';
import { TRANSFERS_RECORD_ACCESS, useBankAccounts, useNigerianBanks, useTransfer } from '@/features/nigerianPayments/queries';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 PY6 — record a bank transfer that landed in the account, or edit a waiting one with `?id=`. */
export default function TransferFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;

  const canRecord = useCan(TRANSFERS_RECORD_ACCESS);
  const canPickMember = useCan('MEMBER_VIEW');
  const accountsQuery = useBankAccounts('active');
  const banksQuery = useNigerianBanks();
  const transferQuery = useTransfer(editId ?? NaN);
  const record = useRecordTransfer();
  const update = useUpdateTransfer(editId ?? 0);

  const accounts = accountsQuery.data ?? [];
  const requireAccount = accounts.length > 0;
  const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];
  const schema = useMemo(() => buildTransferFormSchema({ requireAccount }), [requireAccount]);

  const { control, handleSubmit, reset } = useForm<TransferFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyTransferValues(null),
    mode: 'onTouched',
  });

  // Pre-select the default receiving account for a new transfer once the accounts have loaded.
  useEffect(() => {
    if (!isEdit && defaultAccount) reset({ ...emptyTransferValues(defaultAccount.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the default account first becomes known
  }, [defaultAccount?.id, isEdit, reset]);

  const transfer = transferQuery.data;
  useEffect(() => {
    if (transfer) reset(transferToFormValues(transfer));
  }, [transfer, reset]);

  const back = () => router.back();
  const title = isEdit ? 'Edit transfer' : 'Record transfer';

  if (!canRecord) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if ((isEdit && transferQuery.isPending) || accountsQuery.isPending || banksQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (banksQuery.isError || (isEdit && (transferQuery.isError || !transfer))) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={banksQuery.error ?? transferQuery.error} onRetry={() => { void banksQuery.refetch(); void transferQuery.refetch(); }} />
      </Screen>
    );
  }

  if (isEdit && transfer && transfer.status !== 'PENDING') {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState title="This transfer can't be edited." description="It was already verified, rejected or matched." />
      </Screen>
    );
  }

  const bankOptions = (banksQuery.data ?? []).map((bank) => ({ label: bank.name, value: bank.name }));
  const accountOptions = accounts.map((account) => ({
    label: `${account.bankName} · ${formatAccountNumber(account.accountNumber)}${account.isDefault ? ' (default)' : ''}`,
    value: String(account.id),
  }));

  const onError = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the transfer. Try again.');

  const onSubmit = (values: TransferFormValues) => {
    const payload = toTransferPayload(values);
    if (isEdit) {
      update.mutate(payload, {
        onSuccess: () => {
          toast.success('Transfer updated');
          router.back();
        },
        onError,
      });
      return;
    }
    record.mutate(payload, {
      onSuccess: (created) => {
        toast.success('Transfer recorded');
        router.replace(`/(app)/(tabs)/manage/payments/transfers/${created.id}` as never);
      },
      onError,
    });
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="PY6" />

      <View className="gap-6 pb-6">
        {accounts.length === 0 ? (
          <Text variant="body" tone="warning">
            You haven’t added a bank account yet. Add one under Payments → Bank accounts so transfers can be tied to it.
          </Text>
        ) : null}

        <Section title="The money">
          <View className="gap-4">
            <AmountField control={control} name="amount" label="Amount" presets={[5000, 10000, 20000, 50000]} />
            <TextField control={control} name="reference" label="Reference" helper="The bank’s transfer reference. It can’t repeat." autoCapitalize="characters" testID="transfer-reference" />
            <DateField control={control} name="transferDate" label="Transfer date" maximumDate={new Date()} />
            {accounts.length > 0 ? <SelectSheet control={control} name="bankAccountId" label="Received into" options={accountOptions} placeholder="Choose the account" /> : null}
          </View>
        </Section>

        <Section title="Who sent it">
          <View className="gap-4">
            {canPickMember ? <MemberPickerField control={control} name="member" label="Member (optional)" helper="Leave empty if you don’t know who sent it." testID="transfer-member-picker" /> : null}
            <SelectSheet control={control} name="senderBankName" label="Sender’s bank" options={bankOptions} placeholder="Choose the bank" />
            <TextField control={control} name="senderAccountName" label="Sender’s account name (optional)" autoCapitalize="words" />
            <TextField control={control} name="senderAccountNumber" label="Sender’s account number (optional)" keyboardType="number-pad" maxLength={10} />
          </View>
        </Section>

        <Section title="More details">
          <View className="gap-4">
            <TextField control={control} name="narration" label="Narration (optional)" helper="What the bank shows for the transfer." />
            <TextField control={control} name="notes" label="Notes (optional)" multiline />
          </View>
        </Section>
      </View>

      <StickyFooter>
        <Button variant="primary" loading={record.isPending || update.isPending} onPress={() => { handleSubmit(onSubmit)(); }} testID="transfer-save">
          {isEdit ? 'Save changes' : 'Record transfer'}
        </Button>
      </StickyFooter>
    </Screen>
  );
}
