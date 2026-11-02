import { useRouter } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { AmountField } from '@/components/forms/AmountField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { ErrorState } from '@/components/feedback/ErrorState';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { OwnPage } from '@/features/coopEnhanced/components/OwnPage';
import { useRequestWithdrawal, useWithdrawalSummary } from '@/features/coopEnhanced/queries';
import { formatMoney } from '@/lib/money';
import { COOPERATIVE_WITHDRAW_ACCESS } from '@/lib/permissions';

type FormValues = { accountId: string; amount: string; reason: string };

/** A new withdrawal request. The checks here (balance, this month's limit) save a wasted trip; the server checks them again, and again at final approval. */
export default function NewWithdrawalScreen() {
  const router = useRouter();
  const summary = useWithdrawalSummary();
  const request = useRequestWithdrawal();
  const { control, handleSubmit } = useForm<FormValues>({ defaultValues: { accountId: '', amount: '', reason: '' } });

  const chosenId = useWatch({ control, name: 'accountId' });
  const accounts = summary.data?.accounts ?? [];
  const open = accounts.filter((a) => !a.hasPending);
  const options = open.map((a) => ({ label: `${a.accountTypeName} · ${formatMoney(a.balance)}`, value: String(a.savingsAccountId) }));
  const chosen = accounts.find((a) => String(a.savingsAccountId) === chosenId);

  const onSubmit = (values: FormValues) => {
    const amount = Number(values.amount);
    if (!chosen) return toast.error('Choose the savings to withdraw from');
    if (!amount || amount <= 0) return toast.error('Enter an amount above zero');
    if (amount > Number(chosen.balance)) return toast.error(`That is more than the ${formatMoney(chosen.balance)} you have there`);
    if (chosen.remainingThisMonth !== null && amount > Number(chosen.remainingThisMonth)) {
      return toast.error(`You can withdraw up to ${formatMoney(chosen.remainingThisMonth)} more this month`);
    }
    request.mutate(
      { savingsAccountId: chosen.savingsAccountId, amount, reason: values.reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Withdrawal requested. You will be told when it is decided.');
          router.back();
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not request the withdrawal. Try again.'),
      },
    );
  };

  return (
    <OwnPage title="New withdrawal request" subject="withdrawals" access={COOPERATIVE_WITHDRAW_ACCESS} keyboard>
      {summary.isPending ? (
        <Skeleton width="100%" height={200} radius="lg" />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <View className="gap-5 pb-24">
          {options.length === 0 ? (
            <Text variant="body" tone="warning">
              {accounts.length === 0
                ? 'You have no savings that can be withdrawn. Share capital, for example, can never be withdrawn.'
                : 'A request is already waiting for each of your savings. Wait for it to be decided, or cancel it first.'}
            </Text>
          ) : (
            <>
              <SelectSheet control={control} name="accountId" label="Withdraw from" options={options} placeholder="Choose a savings type…" />
              {chosen ? (
                <Text variant="caption" tone="secondary">
                  {`Balance ${formatMoney(chosen.balance)}${chosen.remainingThisMonth !== null ? ` · You can still withdraw ${formatMoney(chosen.remainingThisMonth)} this month` : ''}`}
                </Text>
              ) : null}
              <AmountField control={control} name="amount" label="Amount (₦)" />
              <TextField control={control} name="reason" label="Reason (optional)" placeholder="What is it for?" multiline />
            </>
          )}
        </View>
      )}
      <StickyFooter>
        <Button variant="primary" loading={request.isPending} disabled={options.length === 0} onPress={() => { void handleSubmit(onSubmit)(); }} testID="withdrawal-submit">
          Request withdrawal
        </Button>
      </StickyFooter>
    </OwnPage>
  );
}
