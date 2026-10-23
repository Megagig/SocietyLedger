import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { Landmark, Plus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { BankAccountRow } from '@/features/nigerianPayments/components/BankAccountRow';
import { useRemoveBankAccount, useUpdateBankAccount } from '@/features/nigerianPayments/mutations';
import { BANK_ACCOUNTS_EDIT_ACCESS, BANK_ACCOUNTS_VIEW_ACCESS, useBankAccounts } from '@/features/nigerianPayments/queries';
import { useCan } from '@/hooks/useCan';
import type { BankAccountDTO } from '@/types/api/bankManage';

/**
 * project-overview.md §6.9 PY7 — the association's bank accounts. The active ones are exactly what members are shown when they pay
 * (default first), on the web and in the app, so keep them right.
 */
export default function BankAccountsScreen() {
  const router = useRouter();
  const canView = useCan(BANK_ACCOUNTS_VIEW_ACCESS);
  const canEdit = useCan(BANK_ACCOUNTS_EDIT_ACCESS);
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState<BankAccountDTO | null>(null);
  const actionsRef = useRef<BottomSheetModal>(null);
  const removeRef = useRef<BottomSheetModal>(null);

  const active = useBankAccounts('active');
  const inactive = useBankAccounts('inactive', showInactive);
  const update = useUpdateBankAccount();
  const remove = useRemoveBankAccount();
  const back = () => router.back();

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Bank accounts" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const onError = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not update the account. Try again.');
  const openActions = (account: BankAccountDTO) => {
    setSelected(account);
    actionsRef.current?.present();
  };
  const closeActions = () => actionsRef.current?.dismiss();

  const makeDefault = (account: BankAccountDTO) =>
    update.mutate(
      { id: account.id, payload: { isDefault: true } },
      {
        onSuccess: () => {
          closeActions();
          toast.success(`${account.bankName} is now the default account`);
        },
        onError,
      },
    );

  const reactivate = (account: BankAccountDTO) =>
    update.mutate(
      { id: account.id, payload: { isActive: true } },
      {
        onSuccess: () => {
          closeActions();
          toast.success('Account reactivated');
        },
        onError,
      },
    );

  const confirmRemove = () => {
    if (!selected) return;
    remove.mutate(selected.id, {
      onSuccess: ({ outcome, newDefaultId }) => {
        removeRef.current?.dismiss();
        toast.success(outcome === 'deactivated' ? 'Account deactivated. Its transfers and statements are kept.' : 'Account deleted');
        if (newDefaultId) toast.info('Another account is now the default.');
      },
      onError: (error) => {
        removeRef.current?.dismiss();
        onError(error);
      },
    });
  };

  const accounts = active.data ?? [];
  const retired = inactive.data ?? [];
  const goToForm = (id?: number) => router.push((id ? `/(app)/(tabs)/manage/payments/bank-accounts/form?id=${id}` : '/(app)/(tabs)/manage/payments/bank-accounts/form') as never);

  return (
    <Screen edges={['top']} refreshing={active.isRefetching} onRefresh={() => active.refetch()}>
      <ScreenHeader
        title="Bank accounts"
        onBack={back}
        docsKey="PY7"
        rightActions={canEdit ? <IconButton icon={Plus} accessibilityLabel="Add a bank account" onPress={() => goToForm()} testID="bank-account-add" /> : undefined}
      />

      <View className="gap-6 pb-8">
        <Text variant="body" tone="secondary">
          Members see these accounts when they pay by bank transfer — the default first. Keep the bank, number and name exactly as your bank has them.
        </Text>

        {active.isPending ? (
          <View className="gap-3">
            <Skeleton width="100%" height={72} radius="md" />
            <Skeleton width="100%" height={72} radius="md" />
          </View>
        ) : active.isError ? (
          <ErrorState error={active.error} onRetry={() => active.refetch()} />
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No bank account yet"
            description="Add the account members should pay into. Until you do, they have nowhere to send a transfer."
            actionLabel={canEdit ? 'Add a bank account' : undefined}
            onAction={canEdit ? () => goToForm() : undefined}
          />
        ) : (
          <Section title="Accounts members pay into">
            <ListGroup>
              {accounts.map((account) => (
                <BankAccountRow key={account.id} account={account} onPress={canEdit ? openActions : undefined} />
              ))}
            </ListGroup>
          </Section>
        )}

        <View className="items-start">
          <FilterChip label={showInactive ? 'Hide inactive accounts' : 'Show inactive accounts'} active={showInactive} onPress={() => setShowInactive((value) => !value)} />
        </View>
        {showInactive ? (
          inactive.isPending ? (
            <Skeleton width="100%" height={72} radius="md" />
          ) : retired.length === 0 ? (
            <Text variant="caption" tone="secondary">
              No inactive accounts.
            </Text>
          ) : (
            <Section title="Inactive">
              <ListGroup>
                {retired.map((account) => (
                  <BankAccountRow key={account.id} account={account} onPress={canEdit ? openActions : undefined} />
                ))}
              </ListGroup>
            </Section>
          )
        ) : null}
      </View>

      <BottomSheet ref={actionsRef} title={selected?.bankName ?? 'Bank account'} onDismiss={() => undefined}>
        {selected ? (
          <View className="gap-3 pb-6">
            <Text variant="caption" tone="secondary">
              {selected.accountName}
            </Text>
            <Button variant="secondary" onPress={() => { closeActions(); goToForm(selected.id); }} testID="bank-account-edit">
              Edit account
            </Button>
            {selected.isActive && !selected.isDefault ? (
              <Button variant="soft" loading={update.isPending} onPress={() => makeDefault(selected)} testID="bank-account-default">
                Make default
              </Button>
            ) : null}
            {!selected.isActive ? (
              <Button variant="soft" loading={update.isPending} onPress={() => reactivate(selected)} testID="bank-account-reactivate">
                Reactivate
              </Button>
            ) : null}
            <Button variant="danger-ghost" onPress={() => { closeActions(); removeRef.current?.present(); }} testID="bank-account-remove">
              {selected.isActive ? 'Remove account' : 'Delete account'}
            </Button>
          </View>
        ) : null}
      </BottomSheet>

      <ConfirmSheet
        ref={removeRef}
        title="Remove this account?"
        description={
          selected?.isDefault
            ? 'Members will no longer be told to pay into it, and another account becomes the default. An account with transfers or statements is kept as inactive.'
            : 'Members will no longer be told to pay into it. An account with transfers or statements is kept as inactive.'
        }
        confirmLabel="Remove account"
        onConfirm={confirmRemove}
      />
    </Screen>
  );
}
