import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { accountToFormValues, bankAccountFormSchema, emptyBankAccountValues, toAccountPayload, type BankAccountFormValues } from '@/features/nigerianPayments/bankSchemas';
import { useCreateBankAccount, useUpdateBankAccount } from '@/features/nigerianPayments/mutations';
import { BANK_ACCOUNTS_EDIT_ACCESS, useBankAccount, useBankAccounts, useNigerianBanks } from '@/features/nigerianPayments/queries';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 PY7 — add a bank account members can pay into, or edit one with `?id=`. */
export default function BankAccountFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;

  const canEdit = useCan(BANK_ACCOUNTS_EDIT_ACCESS);
  const banksQuery = useNigerianBanks();
  const accountsQuery = useBankAccounts('active');
  const accountQuery = useBankAccount(editId ?? NaN);
  const create = useCreateBankAccount();
  const update = useUpdateBankAccount();

  const isFirstAccount = !isEdit && (accountsQuery.data?.length ?? 0) === 0;
  const { control, handleSubmit, reset } = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: emptyBankAccountValues(false),
    mode: 'onTouched',
  });

  const account = accountQuery.data;
  useEffect(() => {
    if (account) reset(accountToFormValues(account));
  }, [account, reset]);
  useEffect(() => {
    if (!isEdit && accountsQuery.isSuccess) reset(emptyBankAccountValues(isFirstAccount));
  }, [isEdit, isFirstAccount, accountsQuery.isSuccess, reset]);

  const back = () => router.back();
  const title = isEdit ? 'Edit bank account' : 'Add bank account';

  if (!canEdit) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (banksQuery.isPending || accountsQuery.isPending || (isEdit && accountQuery.isPending)) {
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

  if (banksQuery.isError || (isEdit && (accountQuery.isError || !account))) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={banksQuery.error ?? accountQuery.error} onRetry={() => { void banksQuery.refetch(); void accountQuery.refetch(); }} />
      </Screen>
    );
  }

  const bankOptions = (banksQuery.data ?? []).map((bank) => ({ label: bank.name, value: bank.name }));
  // A bank that isn't on the list (an older account) stays selectable so editing doesn't blank it.
  if (account && !bankOptions.some((option) => option.value === account.bankName)) bankOptions.unshift({ label: account.bankName, value: account.bankName });

  const onError = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the account. Try again.');

  const onSubmit = (values: BankAccountFormValues) => {
    const payload = toAccountPayload(values, banksQuery.data ?? []);
    if (isEdit && editId !== undefined) {
      update.mutate(
        { id: editId, payload },
        {
          onSuccess: () => {
            toast.success('Account updated');
            router.back();
          },
          onError,
        },
      );
      return;
    }
    create.mutate(payload, {
      onSuccess: () => {
        toast.success('Account added. Members will now see it when they pay.');
        router.back();
      },
      onError,
    });
  };

  // The default can't be un-set directly (it moves by making another account the default), and the first account is always the default.
  const showDefaultSwitch = !isFirstAccount && !(isEdit && account?.isDefault) && (!isEdit || account?.isActive);

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="PY7" />

      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          Members will see this bank, number and name when they pay by bank transfer, so enter them exactly as your bank has them.
        </Text>
        <SelectSheet control={control} name="bankName" label="Bank" options={bankOptions} placeholder="Choose the bank" />
        <TextField control={control} name="accountNumber" label="Account number" helper="10 digits." keyboardType="number-pad" maxLength={10} testID="bank-account-number" />
        <TextField control={control} name="accountName" label="Account name" autoCapitalize="words" testID="bank-account-name" />
        <TextField control={control} name="description" label="Note for members (optional)" helper="For example, “Use your member ID as the narration”." multiline />
        {showDefaultSwitch ? <Switch control={control} name="isDefault" label="Make this the default account" helper="The default is shown to members first." /> : null}
        {isFirstAccount ? (
          <Text variant="caption" tone="secondary">
            This is your first account, so it will be the default.
          </Text>
        ) : null}
        {isEdit && account?.isDefault ? (
          <Text variant="caption" tone="secondary">
            This is the default account. To change the default, make another account the default.
          </Text>
        ) : null}
      </View>

      <StickyFooter>
        <Button variant="primary" loading={create.isPending || update.isPending} onPress={() => { handleSubmit(onSubmit)(); }} testID="bank-account-save">
          {isEdit ? 'Save changes' : 'Add account'}
        </Button>
      </StickyFooter>
    </Screen>
  );
}
