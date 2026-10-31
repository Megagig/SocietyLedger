import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { TextField } from '@/components/forms/TextField';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { formatMoment } from '@/features/ajo/format';
import { useAjoAction } from '@/features/ajo/mutations';
import { AJO_MEMBER_ACCESS, usePayoutAccount, useVerification } from '@/features/ajo/queries';
import { payoutAccountSchema, type PayoutAccountValues } from '@/features/ajo/schemas';

/** THM5: where the circle pays you when it is your turn. Only the last four digits are ever shown back. */
export default function PayoutAccountScreen() {
  const { canWrite } = useAjoWrite();
  const account = usePayoutAccount();
  const verification = useVerification();
  const save = useAjoAction(ajoApi.savePayoutAccount);
  const [problem, setProblem] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<PayoutAccountValues>({
    resolver: zodResolver(payoutAccountSchema),
    defaultValues: { bankName: '', accountNumber: '', accountName: '' },
    mode: 'onTouched',
  });
  const current = account.data;
  const check = verification.data;

  const submit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      const result = await save.mutateAsync({ bankName: values.bankName.trim(), accountNumber: values.accountNumber.replace(/\s/g, ''), accountName: values.accountName.trim() });
      toast.success(result.replayed ? 'Nothing changed.' : 'Payout account saved.');
      reset({ bankName: '', accountNumber: '', accountName: '' });
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not save your payout account.');
    }
  });

  return (
    <AjoScreen
      title="My payout account"
      access={AJO_MEMBER_ACCESS}
      keyboard
      refreshing={account.isRefetching}
      onRefresh={() => {
        void account.refetch();
        void verification.refetch();
      }}
    >
      <Text variant="body" tone="secondary">
        This is where your circle pays you when it is your turn to collect. Use an account in your own name.
      </Text>

      {account.isPending ? (
        <AjoLoading rows={2} />
      ) : account.isError ? (
        <ErrorState error={account.error} onRetry={() => account.refetch()} />
      ) : (
        <>
          {current ? (
            <Card testID="ajo-account-current">
              <View className="gap-1">
                <Text variant="h3">{current.bankName}</Text>
                <Text variant="body">
                  {current.accountName} · {current.accountMasked}
                </Text>
                <Text variant="caption" tone="tertiary">
                  Last changed {formatMoment(current.changedAt)}
                </Text>
                {current.inCoolOff && current.coolOffUntil ? (
                  <View className="mt-2 rounded-md bg-warning-soft p-3" accessibilityRole="alert">
                    <Text variant="caption" tone="warning">
                      You changed this recently, so you cannot be paid out until {formatMoment(current.coolOffUntil)}. This protects you if someone else gets into your account.
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>
          ) : null}

          {check ? (
            <Card testID="ajo-account-verification">
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Text variant="h3">SocietyLedger check</Text>
                  <AjoStatusBadge status={check.status} />
                </View>
                <Text variant="body" tone="secondary">
                  {check.status === 'VERIFIED'
                    ? 'You are verified and can be paid out.'
                    : check.status === 'REJECTED'
                      ? `Not verified: ${check.rejectionReason ?? 'no reason was given'}. Correct your details below and tell your circle officer.`
                      : check.status === 'PENDING'
                        ? 'SocietyLedger is checking your details. This does not stop you paying in.'
                        : 'Save your payout account and the check starts.'}
                </Text>
              </View>
            </Card>
          ) : null}

          {canWrite ? (
            <View className="gap-4">
              <Text variant="h3">{current ? 'Change my account' : 'Add my account'}</Text>
              <TextField control={control} name="bankName" label="Bank" testID="ajo-account-bank" />
              <TextField control={control} name="accountNumber" label="Account number" keyboardType="number-pad" maxLength={10} testID="ajo-account-number" />
              <TextField control={control} name="accountName" label="Account name" helper="Exactly as the bank has it." testID="ajo-account-name" />
              {problem ? (
                <Text variant="body" tone="danger">
                  {problem}
                </Text>
              ) : null}
              <Button loading={save.isPending} onPress={() => void submit()} testID="ajo-account-save">
                {current ? 'Change account' : 'Save account'}
              </Button>
            </View>
          ) : (
            <Text variant="body" tone="secondary">
              Changes are switched off while the add-on is expired.
            </Text>
          )}
        </>
      )}
    </AjoScreen>
  );
}
