import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';
import { ONBOARDING_FINANCE_TEMPLATES } from '@societyledger/shared';

import { ApiError } from '@/api/errors';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useCreateCategory } from '@/features/financeSetup/mutations';
import { StepFrame } from '@/features/onboarding/components/StepFrame';
import { useCompleteStep } from '@/features/onboarding/mutations';
import {
  defaultAmounts,
  financeSetupSchema,
  toBankAccountPayload,
  toCategoryPayload,
  type FinanceSetupFormValues,
} from '@/features/onboarding/schemas';
import { useCreateBankAccount } from '@/features/nigerianPayments/mutations';
import { useNigerianBanks } from '@/features/nigerianPayments/queries';

/** O2 — what members are charged (starter dues, levies and penalties) and the bank account they pay into. Each part is optional. */
export default function SetupFinanceScreen() {
  const createCategory = useCreateCategory();
  const createBank = useCreateBankAccount();
  const complete = useCompleteStep();
  const banks = useNigerianBanks();
  const [picked, setPicked] = useState<number[]>([]);
  // Saved on an earlier attempt, so trying again after a failure never creates the same thing twice.
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [bankSaved, setBankSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const { control, handleSubmit } = useForm<FinanceSetupFormValues>({
    resolver: zodResolver(financeSetupSchema),
    defaultValues: { amounts: defaultAmounts(), bankName: '', accountName: '', accountNumber: '' },
    mode: 'onTouched',
  });
  const bankOptions = useMemo(() => (banks.data ?? []).map((b) => ({ label: b.name, value: b.name })), [banks.data]);

  const goNext = () => router.replace('/(app)/onboarding/complete');
  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
  const toggle = (index: number) => setPicked((list) => (list.includes(index) ? list.filter((i) => i !== index) : [...list, index]));

  async function save(values: FinanceSetupFormValues) {
    setSaving(true);
    const problems: string[] = [];
    const saved = [...savedNames];
    try {
      for (const index of picked) {
        const template = ONBOARDING_FINANCE_TEMPLATES[index];
        if (!template || saved.includes(template.name)) continue;
        try {
          await createCategory.mutateAsync(toCategoryPayload(template, values.amounts[index] ?? String(template.amount)));
          saved.push(template.name);
        } catch (error) {
          problems.push(`${template.name}: ${error instanceof ApiError ? error.message : 'could not be saved'}`);
        }
      }
      setSavedNames(saved);

      let bankDone = bankSaved;
      const bankPayload = toBankAccountPayload(values, banks.data?.find((b) => b.name === values.bankName)?.code);
      if (bankPayload && !bankSaved) {
        try {
          await createBank.mutateAsync(bankPayload);
          bankDone = true;
          setBankSaved(true);
        } catch (error) {
          problems.push(`Bank account: ${error instanceof ApiError ? error.message : 'could not be saved'}`);
        }
      }

      if (problems.length > 0) {
        toast.error(`Some things could not be saved. ${problems.join(' ')}`);
        return;
      }
      // Nothing entered at all counts as skipped, so the final checklist stays honest.
      const didSomething = saved.length > 0 || bankDone;
      await complete.mutateAsync(didSomething ? { step: 4, stepName: 'finance' } : { step: 4, stepName: 'finance', skipped: true });
      goNext();
    } catch (error) {
      fail(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepFrame
      stepKey="finance"
      title="Set up finances"
      description="Pick the charges you want to start with and add the bank account members pay into. You can change all of this later."
      primaryLabel="Save and continue"
      primaryLoading={saving}
      onPrimary={() => void handleSubmit(save)()}
      skipLoading={complete.isPending && complete.variables?.skipped === true && !saving}
      onSkip={() => complete.mutate({ step: 4, stepName: 'finance', skipped: true }, { onSuccess: goNext, onError: fail })}
    >
      <Section title="Starter charges">
        <View className="gap-3">
          {ONBOARDING_FINANCE_TEMPLATES.map((template, index) => {
            const on = picked.includes(index);
            const done = savedNames.includes(template.name);
            return (
              <Card key={template.name}>
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text variant="body-strong">{template.name}</Text>
                    <Text variant="caption" tone="secondary">{template.description}</Text>
                  </View>
                  {done ? (
                    <Badge tone="success">Saved</Badge>
                  ) : (
                    <Button variant={on ? 'primary' : 'soft'} size="sm" onPress={() => toggle(index)} testID={`finance-template-${index}`}>
                      {on ? 'Added' : 'Add'}
                    </Button>
                  )}
                </View>
                {on && !done ? (
                  <View className="mt-3">
                    <TextField control={control} name={`amounts.${index}`} label="Amount (₦)" keyboardType="decimal-pad" testID={`finance-amount-${index}`} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      </Section>

      <Section title="Bank account for transfers">
        {bankSaved ? (
          <Badge tone="success">Bank account saved</Badge>
        ) : (
          <View className="gap-4">
            <Text variant="caption" tone="secondary">Members see this account when they pay by bank transfer. Leave it empty to add one later.</Text>
            <SelectSheet control={control} name="bankName" label="Bank" options={bankOptions} placeholder={banks.isPending ? 'Loading banks…' : 'Choose a bank'} testID="finance-bank" />
            <TextField control={control} name="accountName" label="Account name" autoCapitalize="words" testID="finance-account-name" />
            <TextField control={control} name="accountNumber" label="Account number" keyboardType="number-pad" maxLength={10} helper="10 digits" testID="finance-account-number" />
          </View>
        )}
      </Section>
    </StepFrame>
  );
}
