import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { FileAttachField } from '@/components/forms/FileAttachField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { LODGE_EXPLAINER } from '@/features/cash/labels';
import { useRecordLodgment } from '@/features/cash/mutations';
import { CASH_LODGE_ACCESS, useCashLodgable } from '@/features/cash/queries';
import { buildLodgmentFormSchema, parseNairaInput, shortfallOf, type LodgmentFormValues } from '@/features/cash/schemas';
import { formatAccountNumber } from '@/features/nigerianPayments/labels';
import { useBankAccounts } from '@/features/nigerianPayments/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';

/**
 * project-overview.md §6.9 CA6 — Lodge cash: record cash you paid into a bank account, with a photo of the slip. Another officer
 * checks it against the bank statement; until then it shows as "lodged, awaiting check" and is out of your hands.
 */
export default function LodgeCashScreen() {
  const router = useRouter();
  const canLodge = useCan(CASH_LODGE_ACCESS);
  const lodgable = useCashLodgable();
  const accountsQuery = useBankAccounts('active');
  const record = useRecordLodgment();
  const [excluded, setExcluded] = useState<number[]>([]);
  const back = () => router.back();

  const collections = lodgable.data?.collections ?? [];
  const chosen = collections.filter((c) => !excluded.includes(c.id));
  const expected = Math.round(chosen.reduce((sum, c) => sum + c.remaining, 0) * 100) / 100;
  const schema = useMemo(() => buildLodgmentFormSchema(expected), [expected]);

  const accounts = accountsQuery.data ?? [];
  const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];

  const { control, handleSubmit, setValue, reset } = useForm<LodgmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { bankAccountId: '', amount: '', depositDate: new Date().toISOString(), bankReference: '', shortfallReason: '', slip: null as never },
    mode: 'onTouched',
  });
  const amountText = useWatch({ control, name: 'amount' });
  const short = shortfallOf(expected, amountText ?? '');

  // Start from lodging everything: the full amount, into the default account.
  useEffect(() => {
    if (!lodgable.data) return;
    setValue('amount', expected > 0 ? String(expected) : '');
  }, [expected, lodgable.data, setValue]);
  useEffect(() => {
    if (defaultAccount) setValue('bankAccountId', String(defaultAccount.id));
  }, [defaultAccount, setValue]);

  if (!canLodge) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Lodge cash" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (lodgable.isPending || accountsQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Lodge cash" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={96} radius="lg" />
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (lodgable.isError || accountsQuery.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Lodge cash" onBack={back} />
        <ErrorState error={lodgable.error ?? accountsQuery.error} onRetry={() => { void lodgable.refetch(); void accountsQuery.refetch(); }} />
      </Screen>
    );
  }

  if (collections.length === 0) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Lodge cash" onBack={back} docsKey="CA6" />
        <EmptyState
          title="No cash to lodge"
          description="Close a collection first — cash from an open collection can't be lodged until you close it."
          actionLabel="See my collections"
          onAction={() => router.replace('/(app)/(tabs)/manage/cash/collections' as never)}
        />
      </Screen>
    );
  }

  if (accounts.length === 0) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Lodge cash" onBack={back} docsKey="CA6" />
        <EmptyState title="No bank account yet" description="Ask the administrator to add the association's bank account under Payments → Bank accounts, then lodge the cash." />
      </Screen>
    );
  }

  const accountOptions = accounts.map((a) => ({
    label: `${a.bankName} · ${formatAccountNumber(a.accountNumber)}${a.isDefault ? ' (default)' : ''}`,
    value: String(a.id),
  }));

  const toggle = (id: number) => setExcluded((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const onSubmit = (values: LodgmentFormValues) => {
    const slip = values.slip;
    if (!slip) return;
    record.mutate(
      {
        bankAccountId: Number(values.bankAccountId),
        amount: parseNairaInput(values.amount) ?? 0,
        depositDate: values.depositDate,
        ...(values.bankReference.trim() ? { bankReference: values.bankReference.trim() } : {}),
        ...(values.shortfallReason.trim() ? { shortfallReason: values.shortfallReason.trim() } : {}),
        ...(excluded.length > 0 ? { collectionIds: chosen.map((c) => c.id) } : {}),
        slip: { uri: slip.uri, name: slip.name, type: slip.type },
      },
      {
        onSuccess: (created) => {
          toast.success('Lodgment recorded');
          reset();
          router.replace(`/(app)/(tabs)/manage/cash/lodgments/${created.id}` as never);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not record the lodgment. Try again.'),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Lodge cash" onBack={back} docsKey="CA6" />

      <View className="gap-6 pb-6">
        <Text variant="body" tone="secondary">
          {LODGE_EXPLAINER}
        </Text>

        <Section title="Cash you are lodging">
          <View className="gap-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {collections.map((c) => (
                <FilterChip key={c.id} label={`${c.title} · ${formatMoney(c.remaining)}`} active={!excluded.includes(c.id)} onPress={() => toggle(c.id)} />
              ))}
            </ScrollView>
            <View className="flex-row items-center justify-between rounded-lg bg-primary-soft p-4">
              <Text variant="label" tone="onPrimarySoft">
                You should lodge
              </Text>
              <Money value={expected} size="h3" />
            </View>
            {chosen.length === 0 ? (
              <Text variant="caption" tone="danger">
                Choose at least one collection to lodge.
              </Text>
            ) : null}
          </View>
        </Section>

        <Section title="The deposit">
          <View className="gap-4">
            <SelectSheet control={control} name="bankAccountId" label="Paid into" options={accountOptions} placeholder="Choose the account" />
            <AmountField control={control} name="amount" label="Amount you paid in" helper="What the deposit slip shows." />
            {short > 0 ? (
              <View className="gap-3 rounded-lg bg-warning-soft p-4">
                <Text variant="label" tone="warning">
                  {`${formatMoney(short)} short of what you collected`}
                </Text>
                <TextField control={control} name="shortfallReason" label="Why is it short?" placeholder="For example: ₦2,000 spent on refreshments, receipt kept" multiline testID="lodge-shortfall" />
              </View>
            ) : null}
            <DateField control={control} name="depositDate" label="Date paid in" maximumDate={new Date()} />
            <TextField control={control} name="bankReference" label="Bank reference (optional)" helper="The teller number or reference on the slip." autoCapitalize="characters" />
          </View>
        </Section>

        <Section title="Deposit slip">
          <FileAttachField control={control} name="slip" helper="A clear photo of the slip. The officer who checks it compares it with the bank statement." testID="lodge-slip" />
        </Section>
      </View>

      <StickyFooter>
        <Button
          variant="primary"
          loading={record.isPending}
          disabled={chosen.length === 0}
          onPress={() => { handleSubmit(onSubmit)(); }}
          testID="lodge-save"
        >
          Record lodgment
        </Button>
      </StickyFooter>
    </Screen>
  );
}
