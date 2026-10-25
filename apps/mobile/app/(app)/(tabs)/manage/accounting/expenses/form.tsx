import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { DateField } from '@/components/forms/DateField';
import { FileAttachField, type Attachment } from '@/components/forms/FileAttachField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ACCOUNTING_CREATE_ACCESS, dayOf } from '@/features/accounting/labels';
import { useAccountingAccess } from '@/features/accounting/queries';
import { BudgetNote } from '@/features/expenses/components/ExpenseParts';
import { receiptHelper } from '@/features/expenses/labels';
import { useRemoveReceipt, useSaveExpense } from '@/features/expenses/mutations';
import { useBudgetCheck, useExpense, useExpenseOptions } from '@/features/expenses/queries';
import { emptyExpenseValues, expenseFormSchema, expenseToFormValues, toExpensePayload, type ExpenseFormValues } from '@/features/expenses/schemas';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';

/**
 * Record an expense: who was paid, for what, how much, which category, which account it was paid from, and the receipt. Spending is
 * recorded after it is paid. It is saved as a draft, or sent straight to a second officer for approval.
 */
export default function ExpenseFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const allowed = useAccountingAccess();
  const canCreate = useCan(ACCOUNTING_CREATE_ACCESS);
  const options = useExpenseOptions();
  const expenseQuery = useExpense(editId);
  const save = useSaveExpense(editId);
  const removeReceipt = useRemoveReceipt(editId ?? 0);
  const { control, handleSubmit, reset } = useForm<ExpenseFormValues>({ resolver: zodResolver(expenseFormSchema), defaultValues: emptyExpenseValues(new Date().toISOString()), mode: 'onTouched' });
  const back = () => router.back();
  const title = isEdit ? 'Change expense' : 'Record an expense';

  useEffect(() => {
    if (expenseQuery.data) reset(expenseToFormValues(expenseQuery.data));
  }, [expenseQuery.data, reset]);

  const [amount, category, date, receipt] = useWatch({ control, name: ['amount', 'categoryAccountId', 'expenseDate', 'receipt'] });
  const amountNumber = Number(String(amount ?? '').replace(/,/g, ''));
  const budget = useBudgetCheck(category ? Number(category) : undefined, Number.isFinite(amountNumber) ? amountNumber : undefined, date ? dayOf(date) : undefined);
  const categoryOptions = useMemo(() => (options.data?.categories ?? []).map((c) => ({ label: `${c.code} ${c.name}`, value: String(c.id) })), [options.data]);
  const paidFromOptions = useMemo(() => (options.data?.paidFrom ?? []).map((a) => ({ label: `${a.code} ${a.name}`, value: String(a.id) })), [options.data]);

  if (!allowed || !canCreate) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }
  if (options.isPending || (isEdit && expenseQuery.isPending)) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} docsKey="AC7" />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={180} radius="md" />
        </View>
      </Screen>
    );
  }
  if (options.isError || !options.data || (isEdit && (expenseQuery.isError || !expenseQuery.data))) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} docsKey="AC7" />
        <ErrorState error={options.error ?? expenseQuery.error} onRetry={() => { void options.refetch(); void expenseQuery.refetch(); }} />
      </Screen>
    );
  }
  const existing = expenseQuery.data;
  if (existing && existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} docsKey="AC7" />
        <Text variant="body" tone="secondary" testID="expense-locked">
          This expense is already with an approver or in the books, so it can no longer be changed.
        </Text>
      </Screen>
    );
  }

  const limit = options.data.receiptRequiredAbove;
  const hasSavedReceipt = !!existing?.hasReceipt;
  const noReceiptAtAll = !receipt && !hasSavedReceipt;
  const fail = (error: unknown, fallback: string) => toast.error(error instanceof ApiError ? error.message : fallback);

  const submit = (values: ExpenseFormValues, send: boolean) => {
    const picked = values.receipt as Attachment | null;
    save.mutate(
      { payload: toExpensePayload(values), receipt: picked ? { uri: picked.uri, name: picked.name, type: picked.type } : null, send },
      {
        onSuccess: ({ expense, sent, sendError, receiptError }) => {
          // The voucher is saved even when a later step failed, so say what happened to each
          if (receiptError) fail(receiptError, 'The expense was saved, but the receipt could not be attached.');
          else if (send && !sent) fail(sendError, 'The expense was saved as a draft, but could not be sent.');
          else toast.success(sent ? 'Sent for approval' : 'Draft saved');
          router.replace({ pathname: '/(app)/(tabs)/manage/accounting/expenses/[id]', params: { id: String(expense.id) } } as never);
        },
        onError: (error) => fail(error, 'Could not save the expense. Try again.'),
      },
    );
  };

  const busy = save.isPending;

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="AC7" />

      <View className="gap-6 pb-6">
        {existing?.status === 'REJECTED' && existing.rejectionReason ? (
          <View className="rounded-lg bg-danger-soft p-4" testID="expense-rejection">
            <Text variant="body-strong" tone="danger">
              Rejected
            </Text>
            <Text variant="body">{existing.rejectionReason}</Text>
            <Text variant="caption" tone="secondary">
              Change it and send it again.
            </Text>
          </View>
        ) : null}

        <Section title="The spending">
          <View className="gap-4">
            <TextField control={control} name="payee" label="Who was paid?" placeholder="Ade Hall Ltd" autoCapitalize="words" testID="expense-payee" />
            <TextField control={control} name="description" label="What was it for?" placeholder="Hall hire for the AGM" autoCapitalize="sentences" multiline testID="expense-description" />
            <AmountField control={control} name="amount" label="Amount paid" testID="expense-amount" />
            <DateField control={control} name="expenseDate" label="Date paid" mode="date" maximumDate={new Date()} testID="expense-date" />
          </View>
        </Section>

        <Section title="Where it goes">
          <View className="gap-4">
            <SelectSheet control={control} name="categoryAccountId" label="Category" options={categoryOptions} placeholder="Choose a category" />
            {budget.data ? <BudgetNote position={budget.data} /> : null}
            <SelectSheet control={control} name="paidFromAccountId" label="Paid from" options={paidFromOptions} placeholder="Choose the account it was paid from" />
            <TextField control={control} name="reference" label="Reference (optional)" placeholder="Invoice or receipt number" autoCapitalize="characters" testID="expense-reference" />
          </View>
        </Section>

        <Section title="Receipt">
          <View className="gap-4">
            <Text variant="caption" tone="secondary" testID="expense-receipt-rule">
              {receiptHelper(String(amount ?? ''), limit)}
            </Text>
            {hasSavedReceipt ? (
              <View className="gap-2 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="expense-receipt-saved">
                <Text variant="body">A receipt is attached. Choosing a new one below replaces it.</Text>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  loading={removeReceipt.isPending}
                  onPress={() => removeReceipt.mutate(undefined, { onSuccess: () => toast.success('Receipt removed'), onError: (e) => fail(e, 'Could not remove the receipt.') })}
                  testID="expense-receipt-remove"
                >
                  Remove the receipt
                </Button>
              </View>
            ) : null}
            <FileAttachField control={control} name="receipt" helper="A clear photo of the receipt, or a PDF." testID="expense-receipt" />
            {noReceiptAtAll ? (
              <TextField control={control} name="noReceiptReason" label="No receipt? Say why" placeholder="For example: bus fare, no receipt" helper={`Only allowed for spending up to ${formatMoney(limit)}.`} multiline testID="expense-no-receipt" />
            ) : null}
          </View>
        </Section>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="secondary" fullWidth loading={busy} onPress={() => { void handleSubmit((v) => submit(v, false))(); }} testID="expense-save-draft">
            Save draft
          </Button>
        </View>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={busy} onPress={() => { void handleSubmit((v) => submit(v, true))(); }} testID="expense-send">
            Send for approval
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
