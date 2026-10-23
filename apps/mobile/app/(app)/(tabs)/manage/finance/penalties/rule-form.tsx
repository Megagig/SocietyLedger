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
import { SegmentedControl } from '@/components/forms/SegmentedControl';
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
import { useCreateRule, useUpdateRule } from '@/features/donationsPenalties/mutations';
import { FUND_CREATE_ACCESS, FUND_EDIT_ACCESS, usePenaltyRules } from '@/features/donationsPenalties/queries';
import { emptyRuleValues, ruleFormSchema, ruleToFormValues, toRulePayload, type RuleFormValues } from '@/features/donationsPenalties/schemas';
import { useFinanceCategories } from '@/features/finance/queries';
import { useCan } from '@/hooks/useCan';
import type { PenaltyFeeType } from '@/types/api/donationsPenalties';

/** project-overview.md §6.9 FN11 — a late-fee rule: what to charge a dues or levy charge that is overdue, and when. */
export default function RuleFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const canCreate = useCan(FUND_CREATE_ACCESS);
  const canEdit = useCan(FUND_EDIT_ACCESS);
  const rulesQuery = usePenaltyRules();
  const categories = useFinanceCategories();
  const create = useCreateRule();
  const update = useUpdateRule(editId ?? 0);
  const { control, handleSubmit, reset, setValue } = useForm<RuleFormValues>({ resolver: zodResolver(ruleFormSchema), defaultValues: emptyRuleValues(), mode: 'onTouched' });
  const feeType = useWatch({ control, name: 'feeType' });
  const compounding = useWatch({ control, name: 'isCompounding' });
  const back = () => router.back();
  const title = isEdit ? 'Edit rule' : 'Add a late-fee rule';
  const rule = rulesQuery.data?.pages.flatMap((p) => p.rules).find((r) => r.id === editId);
  // A rule covers every due and levy, or one category on purpose (a penalty category is never penalised).
  const categoryOptions = useMemo(
    () => [{ label: 'All dues and levies', value: '' }, ...(categories.data ?? []).filter((c) => c.type !== 'penalty').map((c) => ({ label: c.name, value: String(c.id) }))],
    [categories.data],
  );

  useEffect(() => {
    if (rule) reset(ruleToFormValues(rule));
  }, [rule, reset]);

  if (isEdit ? !canEdit : !canCreate) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if ((isEdit && rulesQuery.isPending) || categories.isPending) {
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

  if (isEdit && (rulesQuery.isError || !rule)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={rulesQuery.error} title={rulesQuery.isError ? undefined : 'Rule not found'} onRetry={() => rulesQuery.refetch()} />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the rule. Try again.');

  const onSubmit = (values: RuleFormValues) => {
    const payload = toRulePayload(values);
    const done = (message: string) => ({
      onSuccess: () => {
        toast.success(message);
        router.back();
      },
      onError: fail,
    });
    if (isEdit) {
      // The category is fixed once the rule exists.
      const { categoryId: _categoryId, triggerType: _triggerType, ...changes } = payload;
      update.mutate(changes, done('Rule updated'));
    } else {
      create.mutate(payload, done('Rule added'));
    }
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="FN11" />

      <View className="gap-6 pb-6">
        <Section title="The rule">
          <View className="gap-4">
            <TextField control={control} name="name" label="Name" placeholder="Late dues fee" autoCapitalize="sentences" testID="rule-name" />
            {isEdit ? (
              <View className="gap-1">
                <Text variant="label">Covers</Text>
                <Text variant="body">{rule?.category ? rule.category.name : 'All dues and levies'}</Text>
              </View>
            ) : (
              <SelectSheet control={control} name="categoryId" label="Covers" options={categoryOptions} placeholder="All dues and levies" helper="Donation pledges and penalties are never charged a late fee unless a rule names that category." />
            )}
            <TextField control={control} name="description" label="Description (optional)" multiline />
          </View>
        </Section>

        <Section title="The fee">
          <View className="gap-4">
            <SegmentedControl<PenaltyFeeType>
              options={[
                { label: 'Fixed amount', value: 'fixed' },
                { label: 'Percentage', value: 'percentage' },
              ]}
              value={feeType}
              onChange={(value) => setValue('feeType', value, { shouldValidate: true })}
              testID="rule-fee-type"
            />
            {feeType === 'fixed' ? (
              <AmountField control={control} name="feeAmount" label="Fee" presets={[500, 1000, 2000, 5000]} />
            ) : (
              <>
                <TextField control={control} name="feeAmount" label="Percent of what is owed" keyboardType="decimal-pad" placeholder="5" helper="For example 5 charges 5% of the unpaid balance." />
                <AmountField control={control} name="maxFeeAmount" label="Most a single fee can be (optional)" presets={[1000, 5000, 10000]} />
              </>
            )}
          </View>
        </Section>

        <Section title="When">
          <View className="gap-4">
            <TextField control={control} name="gracePeriodDays" label="Days overdue before the fee" keyboardType="number-pad" helper="0 charges it the day after the due date." />
            <Switch control={control} name="isCompounding" label="Repeat the fee" helper="Charge again every few days while it stays unpaid. Off means once." />
            {compounding ? <TextField control={control} name="compoundingDays" label="Days between fees" keyboardType="number-pad" /> : null}
          </View>
        </Section>

        {isEdit ? (
          <Section title="Status">
            <Switch control={control} name="isActive" label="On" helper="A switched-off rule charges nothing. Fees it already charged stay." />
          </Section>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={create.isPending || update.isPending} onPress={() => { void handleSubmit(onSubmit)(); }} testID="rule-save">
            {isEdit ? 'Save changes' : 'Add rule'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
