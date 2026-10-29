import { zodResolver } from '@hookform/resolvers/zod';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, PiggyBank } from 'lucide-react-native';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { useThemeTokens } from '@/providers/ThemeProvider';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { FileAttachField } from '@/components/forms/FileAttachField';
import { TextField } from '@/components/forms/TextField';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoMoney } from '@/features/ajo/components/AjoMoney';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { formatKobo, isoToLocalDay, koboPositive, koboToNaira, nairaToKoboString, newIdempotencyKey } from '@/features/ajo/format';
import { useAjoAction } from '@/features/ajo/mutations';
import { AJO_MEMBER_ACCESS, useMyMemberships } from '@/features/ajo/queries';
import { PROOF_TYPES, transferSchema, type TransferValues } from '@/features/ajo/schemas';
import type { GroupBankDTO } from '@/types/api/ajo';

/** THM3: pay into the circle's own bank account, then report the transfer with the slip. SocietyLedger never holds the money. */
export default function PayContributionScreen() {
  const params = useLocalSearchParams<{ membershipId?: string }>();
  const membershipId = Number(params.membershipId) || 0;
  const router = useRouter();
  const { canWrite } = useAjoWrite();
  const mine = useMyMemberships();
  const item = mine.data?.find((m) => m.membershipId === membershipId);
  const back = () => router.replace(`/(app)/(tabs)/money/thrift/${membershipId}` as never);

  return (
    <AjoScreen title="Pay" access={AJO_MEMBER_ACCESS} keyboard>
      {mine.isPending ? (
        <AjoLoading />
      ) : mine.isError ? (
        <ErrorState error={mine.error} onRetry={() => mine.refetch()} />
      ) : !item ? (
        <EmptyState icon={PiggyBank} title="We could not find that circle." actionLabel="Back to my circles" onAction={() => router.replace('/(app)/(tabs)/money/thrift' as never)} />
      ) : !canWrite ? (
        <EmptyState icon={PiggyBank} title="Payments are switched off." description="The Ajo add-on has expired, so nothing can be added until it is renewed." actionLabel="Back" onAction={back} />
      ) : item.status !== 'ACTIVE' ? (
        <EmptyState icon={PiggyBank} title="You can pay once the circle has approved you." description="Check the circle page to see what it is still waiting for." actionLabel="Back" onAction={back} />
      ) : (
        <PayForm item={item} onDone={back} />
      )}
    </AjoScreen>
  );
}

function PayForm({ item, onDone }: { item: NonNullable<ReturnType<typeof useMyMemberships>['data']>[number]; onDone: () => void }) {
  const membershipId = item.membershipId;
  const { color } = useThemeTokens();
  // The full account number is shown only when asked for and is never put in the query cache.
  const [bank, setBank] = useState<GroupBankDTO | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [loadingBank, setLoadingBank] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const report = useAjoAction((input: Parameters<typeof ajoApi.reportTransfer>[1]) => ajoApi.reportTransfer(item.group.id, input));
  const { control, handleSubmit, setValue } = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { amount: '', paidOn: new Date().toISOString(), reference: '', proof: null },
    mode: 'onTouched',
  });

  const showBank = async () => {
    setLoadingBank(true);
    setBankError(null);
    try {
      setBank(await ajoApi.groupBank(item.group.id));
    } catch (error) {
      setBankError(error instanceof ApiError ? error.message : 'Could not load the circle’s bank details.');
    } finally {
      setLoadingBank(false);
    }
  };

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    toast.success('Account number copied.');
  };

  const submit = handleSubmit(async (values) => {
    const kobo = nairaToKoboString(values.amount);
    if (!kobo || !values.proof) return;
    setProblem(null);
    try {
      await report.mutateAsync({
        membershipId,
        amountKobo: kobo,
        bankReference: values.reference?.trim() || undefined,
        paidOn: isoToLocalDay(values.paidOn),
        proof: { uri: values.proof.uri, name: values.proof.name, type: values.proof.type },
        idempotencyKey,
      });
      setIdempotencyKey(newIdempotencyKey());
      setDone(true);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not report your payment.');
    }
  });

  if (done) {
    return (
      <Card testID="ajo-pay-done">
        <View className="items-center gap-3 py-4">
          <CheckCircle2 size={40} color={color.success} />
          <Text variant="h3">Reported.</Text>
          <Text variant="body" tone="secondary" align="center">
            It counts once an officer confirms it against the bank statement. You will get a receipt when they do.
          </Text>
          <Button onPress={onDone}>Back to my circle</Button>
        </View>
      </Card>
    );
  }

  const overdue = koboPositive(item.overdueKobo);
  return (
    <>
      <View className="gap-1">
        <Text variant="h2">Pay {item.group.name}</Text>
        <View className="flex-row flex-wrap items-center gap-1">
          <Text variant="body" tone="secondary">
            {overdue ? 'You have' : 'Nothing is overdue.'}
          </Text>
          {overdue ? <AjoMoney kobo={item.overdueKobo} tone="danger" /> : null}
          {overdue ? (
            <Text variant="body" tone="secondary">
              overdue.
            </Text>
          ) : null}
          {item.nextDue ? (
            <>
              <Text variant="body" tone="secondary">
                Your next payment is
              </Text>
              <AjoMoney kobo={item.nextDue.remainingKobo} />
            </>
          ) : null}
        </View>
      </View>

      <Card testID="ajo-pay-bank">
        <View className="gap-3">
          <Text variant="h3">1. Send the money to the circle&apos;s account</Text>
          <Text variant="body" tone="secondary">
            This is the circle&apos;s own bank account. SocietyLedger does not hold your money.
          </Text>
          {bank ? (
            <View className="gap-2">
              <View>
                <Text variant="caption" tone="tertiary">
                  Bank
                </Text>
                <Text variant="body-strong">{bank.bankName}</Text>
              </View>
              <View>
                <Text variant="caption" tone="tertiary">
                  Account name
                </Text>
                <Text variant="body-strong">{bank.accountName}</Text>
              </View>
              <View>
                <Text variant="caption" tone="tertiary">
                  Account number
                </Text>
                <View className="flex-row items-center justify-between gap-2">
                  <Text variant="num-lg" testID="ajo-pay-account-number">
                    {bank.accountNumber}
                  </Text>
                  <Button size="sm" variant="secondary" onPress={() => void copy(bank.accountNumber)} testID="ajo-pay-copy">
                    Copy
                  </Button>
                </View>
              </View>
            </View>
          ) : (
            <View className="gap-2">
              <Button variant="soft" loading={loadingBank} onPress={() => void showBank()} testID="ajo-pay-show-bank">
                Show the account details
              </Button>
              {bankError ? (
                <Text variant="body" tone="danger">
                  {bankError}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </Card>

      <Card testID="ajo-pay-form">
        <View className="gap-4">
          <Text variant="h3">2. Tell us you have paid</Text>
          <AmountField
            control={control}
            name="amount"
            label="Amount you paid"
            testID="ajo-pay-amount"
            helper={item.nextDue ? `Next payment: ${formatKobo(item.nextDue.remainingKobo)}` : undefined}
          />
          <View className="flex-row flex-wrap gap-2">
            {overdue ? (
              <Button size="sm" variant="secondary" onPress={() => setValue('amount', koboToNaira(item.overdueKobo), { shouldValidate: true })}>
                {`Overdue: ${formatKobo(item.overdueKobo)}`}
              </Button>
            ) : null}
            {item.nextDue ? (
              <Button size="sm" variant="secondary" onPress={() => setValue('amount', koboToNaira(item.nextDue?.remainingKobo), { shouldValidate: true })}>
                {`Next payment: ${formatKobo(item.nextDue.remainingKobo)}`}
              </Button>
            ) : null}
          </View>
          <DateField control={control} name="paidOn" label="Date you paid" maximumDate={new Date()} testID="ajo-pay-date" />
          <TextField control={control} name="reference" label="Bank reference (optional)" helper="The reference or session ID on your slip." maxLength={80} testID="ajo-pay-reference" />
          <FileAttachField control={control} name="proof" label="Slip or screenshot" helper="JPG, PNG, WebP or PDF, up to 5 MB." allowedTypes={PROOF_TYPES} testID="ajo-pay-proof" />
          {problem ? (
            <Text variant="body" tone="danger" testID="ajo-pay-problem">
              {problem}
            </Text>
          ) : null}
          <Button loading={report.isPending} onPress={() => void submit()} testID="ajo-pay-submit">
            Report my payment
          </Button>
        </View>
      </Card>
    </>
  );
}
