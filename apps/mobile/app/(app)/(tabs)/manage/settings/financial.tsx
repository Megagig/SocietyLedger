import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Text } from '@/components/ui/Text';
import { SaveFooter } from '@/features/settings/components/SaveFooter';
import { ReadOnlyNote } from '@/features/settings/components/ReadOnlyNote';
import { SettingsScreen } from '@/features/settings/components/SettingsScreen';
import { LATE_FEE_TYPE_OPTIONS, SETTINGS_EDIT_ACCESS, SETTINGS_READ_ACCESS } from '@/features/settings/labels';
import { useSaveFinancial } from '@/features/settings/mutations';
import { useFinancialSettings } from '@/features/settings/queries';
import { financialFormSchema, financialToFormValues, toFinancialPayload, type FinancialFormValues } from '@/features/settings/schemas';
import { useCan } from '@/hooks/useCan';
import type { FinancialSettingsDTO } from '@/types/api/settings';

/** project-overview.md §6.9 ST3 — the late-fee fallback, the grace period and whether a charge can be part paid. */
export default function FinancialSettingsScreen() {
  const query = useFinancialSettings();
  const allowed = useCan(SETTINGS_READ_ACCESS);
  const canEdit = useCan(SETTINGS_EDIT_ACCESS);
  return (
    <SettingsScreen title="Financial settings" docsKey="ST3" allowed={allowed} query={query}>
      {(settings) => <FinancialForm settings={settings} canEdit={canEdit} />}
    </SettingsScreen>
  );
}

function FinancialForm({ settings, canEdit }: { settings: FinancialSettingsDTO; canEdit: boolean }) {
  const router = useRouter();
  const save = useSaveFinancial();
  const { control, handleSubmit, formState } = useForm<FinancialFormValues>({
    resolver: zodResolver(financialFormSchema),
    defaultValues: financialToFormValues(settings),
    mode: 'onTouched',
  });
  const lateFees = useWatch({ control, name: 'enableLateFees' });
  const feeType = useWatch({ control, name: 'lateFeeType' });

  const submit = (values: FinancialFormValues) =>
    save.mutate(toFinancialPayload(values), {
      onSuccess: () => {
        toast.success('Financial settings saved');
        router.back();
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save. Try again.'),
    });

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Financial settings" onBack={() => router.back()} docsKey="ST3" />

      {!canEdit ? <ReadOnlyNote /> : null}
      <View className={canEdit ? 'gap-6 pb-6' : 'gap-6 pb-6 opacity-60'} pointerEvents={canEdit ? 'auto' : 'none'}>
        <Section title="Late fees">
          <View className="gap-4">
            <Switch control={control} name="enableLateFees" label="Charge late fees" helper="Applies to dues and levies that are past their due date" testID="fin-late-fees" />
            {lateFees ? (
              <>
                <SelectSheet control={control} name="lateFeeType" label="The fee is" options={LATE_FEE_TYPE_OPTIONS} />
                <TextField
                  control={control}
                  name="lateFeeAmount"
                  label={feeType === 'percentage' ? 'Percentage of the charge' : 'Amount in naira'}
                  helper={feeType === 'percentage' ? 'For example 5 means 5% of what is owed' : 'For example 500 means ₦500.00 per late charge'}
                  keyboardType="decimal-pad"
                  testID="fin-late-amount"
                />
              </>
            ) : null}
            <TextField control={control} name="defaultGracePeriodDays" label="Grace period in days" helper="Days after the due date before a late fee can be charged" keyboardType="number-pad" testID="fin-grace" />
            <Text variant="caption" tone="secondary">
              These late-fee settings are used only while you have no late-fee rule under Finance, Penalties. Once you add a rule, the rule is used instead.
            </Text>
          </View>
        </Section>

        <Section title="Paying">
          <Switch control={control} name="enablePartialPayments" label="Allow part payments" helper="A member can pay some of a charge and the rest later" testID="fin-partial" />
        </Section>
      </View>

      {canEdit ? (
        <SaveFooter
          loading={save.isPending}
          disabled={!formState.isDirty}
          onPress={() => {
            void handleSubmit(submit)();
          }}
          testID="fin-save"
        />
      ) : null}
    </Screen>
  );
}
