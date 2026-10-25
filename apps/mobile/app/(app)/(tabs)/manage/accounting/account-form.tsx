import { zodResolver } from '@hookform/resolvers/zod';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ACCOUNT_SUBTYPE_OPTIONS, ACCOUNT_TYPE_HINTS, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_OPTIONS, ACCOUNTING_CREATE_ACCESS, ACCOUNTING_DELETE_ACCESS, ACCOUNTING_EDIT_ACCESS, NORMAL_BALANCE_OPTIONS, parentChange } from '@/features/accounting/labels';
import { useCreateAccount, useDeleteAccount, useUpdateAccount } from '@/features/accounting/mutations';
import { useAccountingAccess, useAccounts } from '@/features/accounting/queries';
import { accountFormSchema, toAccountPayload, type AccountFormValues } from '@/features/accounting/schemas';
import { useCan } from '@/hooks/useCan';
import type { AccountType } from '@/types/api/accounting';

/** project-overview.md §6.9 AC2 — add an account, or change one: its name, where it sits, and whether it is in use. */
export default function AccountFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const allowed = useAccountingAccess();
  const canCreate = useCan(ACCOUNTING_CREATE_ACCESS);
  const canEdit = useCan(ACCOUNTING_EDIT_ACCESS);
  const canDelete = useCan(ACCOUNTING_DELETE_ACCESS);
  const query = useAccounts(false);
  const account = query.data?.find((a) => a.id === editId);
  const create = useCreateAccount();
  const update = useUpdateAccount(editId ?? 0);
  const remove = useDeleteAccount(editId ?? 0);
  const deleteRef = useRef<BottomSheetModal>(null);
  const { control, handleSubmit, reset } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { code: '', name: '', type: 'EXPENSE', subType: '', normalBalance: '', description: '', parentId: '', isActive: true },
    mode: 'onTouched',
  });
  const type = useWatch({ control, name: 'type' }) as AccountType;
  const back = () => router.back();
  const title = isEdit ? 'Edit account' : 'Add an account';

  useEffect(() => {
    if (account) reset({ code: account.code, name: account.name, type: account.type, subType: account.subType ?? '', normalBalance: '', description: account.description ?? '', parentId: account.parentId ? String(account.parentId) : '', isActive: account.isActive });
  }, [account, reset]);

  // Where the statements show it: the groups that belong to this kind of account
  const subTypeOptions = useMemo(() => [{ label: 'None', value: '' }, ...ACCOUNT_SUBTYPE_OPTIONS[type]], [type]);

  // Only accounts of the same kind can be a parent, and never the account itself
  const parentOptions = useMemo(
    () => [{ label: 'None, a top-level account', value: '' }, ...(query.data ?? []).filter((a) => a.type === type && a.id !== editId).map((a) => ({ label: `${a.code} ${a.name}`, value: String(a.id) }))],
    [query.data, type, editId],
  );

  if (!allowed || !(isEdit ? canEdit : canCreate)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }
  if (isEdit && query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} docsKey="AC2" />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }
  if (isEdit && (query.isError || !account)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} docsKey="AC2" />
        <ErrorState error={query.error} title={query.isError ? undefined : 'Account not found'} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const fail = (fallback: string) => (error: unknown) => toast.error(error instanceof ApiError ? error.message : fallback);
  const done = (message: string) => ({
    onSuccess: () => {
      toast.success(message);
      router.back();
    },
    onError: fail('Could not save the account. Try again.'),
  });
  const submit = (values: AccountFormValues) => {
    if (isEdit) {
      // Choosing "None" takes the account out from under its parent (null); leaving it alone sends nothing
      const parentId = parentChange(values.parentId, account?.parentId ?? null);
      update.mutate({ name: values.name.trim(), ...(values.subType ? { subType: values.subType } : {}), description: values.description.trim(), isActive: values.isActive, ...(parentId !== undefined ? { parentId } : {}) }, done('Account saved'));
    } else {
      create.mutate(toAccountPayload(values), done('Account added'));
    }
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="AC2" />

      <View className="gap-6 pb-6">
        <Section title="The account">
          <View className="gap-4">
            {isEdit ? (
              <View className="gap-0.5">
                <Text variant="label" tone="secondary">
                  {account?.code} · {account ? ACCOUNT_TYPE_LABELS[account.type].replace(/s$/, '') : ''}
                </Text>
                {account?.isSystemAccount ? (
                  <Text variant="caption" tone="secondary">
                    A built-in account. Its code and kind cannot change, and it stays switched on.
                  </Text>
                ) : null}
              </View>
            ) : (
              <>
                <TextField control={control} name="code" label="Code" placeholder="5140" helper="Letters, numbers, dots or dashes. Each code is used once." testID="account-code" />
                <SelectSheet control={control} name="type" label="Kind of account" options={ACCOUNT_TYPE_OPTIONS} />
                <Text variant="caption" tone="secondary">
                  {ACCOUNT_TYPE_HINTS[type]}
                </Text>
              </>
            )}
            <TextField control={control} name="name" label="Name" placeholder="Hall hire" autoCapitalize="words" testID="account-name" />
            <SelectSheet control={control} name="subType" label="Group on the statements" options={subTypeOptions} placeholder="None" helper="Decides where it shows, such as current or fixed assets." />
            {isEdit ? null : <SelectSheet control={control} name="normalBalance" label="Grows with" options={NORMAL_BALANCE_OPTIONS} placeholder="Follows the kind of account" helper="Leave it unless this is a contra account, such as accumulated depreciation." />}
            <TextField control={control} name="description" label="What is it for? (optional)" autoCapitalize="sentences" multiline />
            <SelectSheet control={control} name="parentId" label="Sits under" options={parentOptions} placeholder="None" helper="Group related accounts under one heading." />
            {isEdit && !account?.isSystemAccount ? <Switch control={control} name="isActive" label="In use" helper="Switch off an account you no longer post to. Its past entries stay." testID="account-active" /> : null}
          </View>
        </Section>

        {isEdit && canDelete && account && !account.isSystemAccount ? (
          <Button variant="danger-ghost" fullWidth loading={remove.isPending} onPress={() => deleteRef.current?.present()} testID="account-delete">
            Delete account
          </Button>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button
            variant="primary"
            fullWidth
            loading={create.isPending || update.isPending}
            onPress={() => {
              void handleSubmit(submit)();
            }}
            testID="account-save"
          >
            {isEdit ? 'Save changes' : 'Add account'}
          </Button>
        </View>
      </StickyFooter>

      <ConfirmSheet
        ref={deleteRef}
        title="Delete this account?"
        description="An account with past entries is switched off instead, so its history stays. An account with sub-accounts or in a budget cannot be deleted."
        confirmLabel="Delete account"
        onConfirm={() => {
          deleteRef.current?.dismiss();
          remove.mutate(undefined, done('Account removed'));
        }}
      />
    </Screen>
  );
}
