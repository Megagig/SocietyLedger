import { useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { FileAttachField } from '@/components/forms/FileAttachField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PayToCard } from '@/features/cooperatives/components/PayToCard';
import { OwnPage } from '@/features/coopEnhanced/components/OwnPage';
import { ACCOUNT_CLASS_LABELS, MONTH_SHORT } from '@/features/coopEnhanced/labels';
import { useAccountTypesV2, useCoopBankAccounts, useSubmitPayment } from '@/features/coopEnhanced/queries';
import { formatMoney, sumMoney } from '@/lib/money';
import { COOPERATIVE_SAVINGS_DEPOSIT_ACCESS } from '@/lib/permissions';

type Line = { typeId: number; name: string; amount: string; month: number; year: number };

type FormValues = {
  typeId: string;
  amount: string;
  forDate: string;
  paymentDate: string;
  bankAccountId: string;
  reference: string;
  memberNote: string;
  receipt: { uri: string; name: string; type: string; size?: number } | null;
};

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

const periodLabel = (line: { month: number; year: number }) => `${MONTH_SHORT[line.month - 1]} ${line.year}`;

/**
 * Payment confirmation: the member adds one line for each savings type they paid (an amount, and the month it is for), attaches the ONE
 * receipt for the transfer, and submits. It only creates a pending payment: nothing is added to the savings until an officer confirms the
 * money arrived. Two separate transfers are two separate payments, each with its own receipt.
 */
export default function SavingsPayScreen() {
  const router = useRouter();
  const types = useAccountTypesV2();
  const banks = useCoopBankAccounts();
  const submit = useSubmitPayment();
  const [lines, setLines] = useState<Line[]>([]);

  const { control, getValues, setValue, trigger, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      typeId: '',
      amount: '',
      forDate: new Date().toISOString(),
      paymentDate: new Date().toISOString(),
      bankAccountId: '',
      reference: '',
      memberNote: '',
      receipt: null,
    },
  });

  const typeOptions = (types.data ?? []).map((t) => ({ label: `${t.name} (${ACCOUNT_CLASS_LABELS[t.accountClass]})`, value: String(t.id) }));
  const bankOptions = (banks.data ?? []).map((b) => ({ label: `${b.bankName} · ${b.accountNumber}`, value: String(b.id) }));
  const total = sumMoney(lines.map((l) => l.amount));

  const addLine = async () => {
    const values = getValues();
    const type = types.data?.find((t) => String(t.id) === values.typeId);
    const amount = Number(values.amount);
    if (!type) return toast.error('Choose a savings type');
    if (!amount || amount <= 0) return toast.error('Enter an amount above zero');
    const when = new Date(values.forDate);
    const month = when.getMonth() + 1;
    const year = when.getFullYear();
    setLines((current) => {
      // The same type for the same month is one line: add the amounts together.
      const existing = current.find((l) => l.typeId === type.id && l.month === month && l.year === year);
      if (existing) return current.map((l) => (l === existing ? { ...l, amount: String(Number(l.amount) + amount) } : l));
      return [...current, { typeId: type.id, name: type.name, amount: String(amount), month, year }];
    });
    setValue('amount', '');
    await trigger('amount');
  };

  // Choosing a type fills in the cooperative's usual monthly amount for it, which saves the member typing it.
  const chosenTypeId = useWatch({ control, name: 'typeId' });
  useEffect(() => {
    const t = types.data?.find((x) => String(x.id) === chosenTypeId);
    if (t?.defaultMonthlyAmount) setValue('amount', String(Number(t.defaultMonthlyAmount)));
  }, [chosenTypeId, types.data, setValue]);

  const onSubmit = (values: FormValues) => {
    if (lines.length === 0) return toast.error('Add at least one payment line');
    if (!values.receipt) return toast.error('Attach your bank receipt (a photo or PDF)');
    if (values.receipt.size && values.receipt.size > MAX_PROOF_BYTES) return toast.error('The receipt must be 5MB or smaller');
    submit.mutate(
      {
        lines: lines.map((l) => ({ accountTypeId: l.typeId, amount: Number(l.amount), periodMonth: l.month, periodYear: l.year })),
        paymentDate: values.paymentDate,
        bankAccountId: values.bankAccountId ? Number(values.bankAccountId) : undefined,
        reference: values.reference.trim() || undefined,
        memberNote: values.memberNote.trim() || undefined,
        file: { uri: values.receipt.uri, name: values.receipt.name, type: values.receipt.type },
      },
      {
        onSuccess: () => {
          toast.success('Payment submitted. It will show in your savings once an officer confirms it.');
          router.replace('/money/cooperative/pending-payments' as never);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not submit your payment. Try again.'),
      },
    );
  };

  return (
    <OwnPage title="Payment confirmation" subject="savings" access={COOPERATIVE_SAVINGS_DEPOSIT_ACCESS} docsKey="M16" keyboard>
      {types.isPending ? (
        <View className="gap-4">
          <Skeleton width="100%" height={160} radius="lg" />
          <Skeleton width="100%" height={120} radius="lg" />
        </View>
      ) : types.isError ? (
        <ErrorState error={types.error} onRetry={() => types.refetch()} />
      ) : (
        <View className="gap-5 pb-24">
          <Text variant="body" tone="secondary">
            Pay into your cooperative&apos;s bank account first, then add what you paid and upload the receipt. One bank transfer, one receipt: if you
            paid in two separate transfers, submit them as two payments.
          </Text>

          <PayToCard />

          <Card>
            <View className="gap-4">
              <SelectSheet control={control} name="typeId" label="Savings type" options={typeOptions} placeholder="Select savings type…" />
              <AmountField control={control} name="amount" label="Amount (₦)" />
              <DateField control={control} name="forDate" label="Month this payment is for" />
              <Button variant="soft" onPress={() => void addLine()} testID="pay-add-line">
                Add
              </Button>
            </View>
          </Card>

          <Card noPadding>
            <View className="px-4 pt-4">
              <Text variant="h3">{lines.length === 0 ? 'Your payment' : `Your payment (${lines.length} line${lines.length === 1 ? '' : 's'})`}</Text>
            </View>
            {lines.length === 0 ? (
              <Text variant="body" tone="secondary" className="px-4 py-4">
                List is empty.
              </Text>
            ) : (
              lines.map((line) => (
                <View key={`${line.typeId}-${line.year}-${line.month}`}>
                  <Divider />
                  <View className="flex-row items-center px-4 py-3">
                    <View className="flex-1">
                      <Text variant="body-strong">{line.name}</Text>
                      <Text variant="caption" tone="secondary">{`For ${periodLabel(line)}`}</Text>
                    </View>
                    <Money value={line.amount} />
                    <IconButton
                      icon={Trash2}
                      tone="danger"
                      accessibilityLabel={`Remove ${line.name} for ${periodLabel(line)}`}
                      onPress={() => setLines((c) => c.filter((l) => l !== line))}
                    />
                  </View>
                </View>
              ))
            )}
            <Divider />
            <View className="flex-row items-center justify-between px-4 py-3">
              <Text variant="body-strong">Total</Text>
              <Money value={total.toString()} size="body-strong" testID="pay-total" />
            </View>
          </Card>

          <View className="gap-4">
            <DateField control={control} name="paymentDate" label="Date you paid" maximumDate={new Date()} />
            {bankOptions.length > 0 ? <SelectSheet control={control} name="bankAccountId" label="Paid into" options={bankOptions} placeholder="Choose the account you paid into…" /> : null}
            <TextField control={control} name="reference" label="Bank reference (optional)" placeholder="Transfer reference or teller number" />
            <FileAttachField control={control} name="receipt" label="Evidence of payment" helper="One photo or PDF of the receipt, up to 5MB." />
            <TextField control={control} name="memberNote" label="Note to the officers (optional)" placeholder="Anything the officer should know" multiline />
          </View>
        </View>
      )}

      <StickyFooter>
        <Button variant="primary" loading={submit.isPending} disabled={lines.length === 0} onPress={() => { void handleSubmit(onSubmit)(); }} testID="pay-submit">
          {lines.length > 0 ? `Submit payment · ${formatMoney(total)}` : 'Submit payment'}
        </Button>
      </StickyFooter>
    </OwnPage>
  );
}
