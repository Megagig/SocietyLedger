import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
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
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ACCOUNTING_CREATE_ACCESS, ACCOUNTING_EDIT_ACCESS } from '@/features/accounting/labels';
import { useCreateBudget, useUpdateBudget } from '@/features/accounting/mutations';
import { useAccountingAccess, useAccounts, useBudget } from '@/features/accounting/queries';
import { budgetFormSchema, budgetTotal, toBudgetPayload, type BudgetFormValues } from '@/features/accounting/schemas';
import { useCan } from '@/hooks/useCan';
import type { BudgetDTO } from '@/types/api/accounting';

const thisYear = () => new Date().getFullYear();

const defaults = (): BudgetFormValues => ({
  name: '',
  fiscalYear: String(thisYear()),
  startDate: new Date(thisYear(), 0, 1, 12).toISOString(),
  endDate: new Date(thisYear(), 11, 31, 12).toISOString(),
  description: '',
  items: [{ accountId: '', amount: '', notes: '' }],
});

const valuesOf = (b: BudgetDTO): BudgetFormValues => ({
  name: b.name,
  fiscalYear: String(b.fiscalYear),
  startDate: b.startDate,
  endDate: b.endDate,
  description: b.description ?? '',
  items: b.items.map((i) => ({ accountId: String(i.accountId), amount: String(Number(i.annualAmount)), notes: i.notes ?? '' })),
});

/** project-overview.md §6.9 AC6 — plan a year: income and spending, a yearly amount for each account. Only a draft can be changed. */
export default function BudgetFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const allowed = useAccountingAccess();
  const canCreate = useCan(ACCOUNTING_CREATE_ACCESS);
  const canEdit = useCan(ACCOUNTING_EDIT_ACCESS);
  const budgetQuery = useBudget(editId);
  const accounts = useAccounts(false);
  const create = useCreateBudget();
  const update = useUpdateBudget(editId ?? 0);
  const { control, handleSubmit, reset, formState } = useForm<BudgetFormValues>({ resolver: zodResolver(budgetFormSchema), defaultValues: defaults(), mode: 'onTouched' });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' }) ?? [];
  const back = () => router.back();
  const typeOf = new Map((accounts.data ?? []).map((a) => [String(a.id), a.type]));
  const plannedIncome = budgetTotal(items.filter((i) => typeOf.get(i.accountId) === 'INCOME'));
  const plannedSpending = budgetTotal(items.filter((i) => typeOf.get(i.accountId) === 'EXPENSE'));
  const title = isEdit ? 'Change budget' : 'Plan a budget';

  useEffect(() => {
    if (budgetQuery.data) reset(valuesOf(budgetQuery.data));
  }, [budgetQuery.data, reset]);

  // A budget covers money coming in and money going out only
  const options = useMemo(
    () => (accounts.data ?? []).filter((a) => a.isActive && (a.type === 'INCOME' || a.type === 'EXPENSE')).map((a) => ({ label: `${a.code} ${a.name} (${a.type === 'INCOME' ? 'income' : 'spending'})`, value: String(a.id) })),
    [accounts.data],
  );

  if (!allowed || !(isEdit ? canEdit : canCreate)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }
  if ((isEdit && budgetQuery.isPending) || accounts.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} docsKey="AC6" />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={180} radius="md" />
        </View>
      </Screen>
    );
  }
  if ((isEdit && (budgetQuery.isError || !budgetQuery.data)) || accounts.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} docsKey="AC6" />
        <ErrorState error={budgetQuery.error ?? accounts.error} onRetry={() => { void budgetQuery.refetch(); void accounts.refetch(); }} />
      </Screen>
    );
  }
  if (isEdit && budgetQuery.data && budgetQuery.data.status !== 'DRAFT') {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} docsKey="AC6" />
        <Text variant="body" tone="secondary" testID="budget-locked">
          Only a draft budget can be changed. This one is already approved.
        </Text>
      </Screen>
    );
  }

  const submit = (values: BudgetFormValues) => {
    const payload = toBudgetPayload(values);
    const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the budget. Try again.');
    if (isEdit) {
      update.mutate({ name: payload.name, description: payload.description, items: payload.items }, { onSuccess: () => { toast.success('Budget saved'); router.back(); }, onError: fail });
    } else {
      create.mutate(payload, {
        onSuccess: (budget) => {
          toast.success('Budget saved as a draft');
          router.replace({ pathname: '/(app)/(tabs)/manage/accounting/budgets/[id]', params: { id: String(budget.id) } } as never);
        },
        onError: fail,
      });
    }
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="AC6" />

      <View className="gap-6 pb-6">
        <Section title="The budget">
          <View className="gap-4">
            <TextField control={control} name="name" label="Name" placeholder="2026 budget" autoCapitalize="sentences" testID="budget-name" />
            <TextField control={control} name="fiscalYear" label="Year" keyboardType="number-pad" helper="The year it is for, like 2026" testID="budget-year" />
            {isEdit ? null : (
              <>
                <DateField control={control} name="startDate" label="Starts" mode="date" />
                <DateField control={control} name="endDate" label="Ends" mode="date" />
              </>
            )}
            <TextField control={control} name="description" label="Note (optional)" autoCapitalize="sentences" multiline />
          </View>
        </Section>

        <Section title="What you plan">
          <View className="gap-4">
            {fields.map((field, index) => (
              <View key={field.id} className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID={`budget-line-${index}`}>
                <View className="flex-row items-center justify-between">
                  <Text variant="label" tone="secondary">
                    Line {index + 1}
                  </Text>
                  {fields.length > 1 ? <IconButton icon={Trash2} accessibilityLabel={`Remove line ${index + 1}`} onPress={() => remove(index)} testID={`budget-line-remove-${index}`} /> : null}
                </View>
                <SelectSheet control={control} name={`items.${index}.accountId`} label="Account" options={options} placeholder="Choose an account" />
                <AmountField control={control} name={`items.${index}.amount`} label="For the year" testID={`budget-amount-${index}`} />
                <TextField control={control} name={`items.${index}.notes`} label="Note (optional)" autoCapitalize="sentences" testID={`budget-note-${index}`} />
              </View>
            ))}
            <Button variant="secondary" fullWidth onPress={() => append({ accountId: '', amount: '', notes: '' })} testID="budget-line-add">
              Add a line
            </Button>
            <View className="gap-2 rounded-lg bg-surface-sunken p-4" testID="budget-totals">
              <View className="flex-row items-center justify-between">
                <Text variant="body">Planned income</Text>
                <Money value={plannedIncome.toFixed(2)} size="body-strong" />
              </View>
              <View className="flex-row items-center justify-between">
                <Text variant="body">Planned spending</Text>
                <Money value={plannedSpending.toFixed(2)} size="body-strong" />
              </View>
            </View>
            {formState.errors.items?.message || formState.errors.items?.root?.message ? (
              <Text variant="caption" tone="danger">
                {formState.errors.items?.message ?? formState.errors.items?.root?.message}
              </Text>
            ) : null}
          </View>
        </Section>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={create.isPending || update.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="budget-save">
            {isEdit ? 'Save changes' : 'Save draft'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
