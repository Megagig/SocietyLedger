import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { SaveFooter } from '@/features/settings/components/SaveFooter';
import { SettingsScreen } from '@/features/settings/components/SettingsScreen';
import { PAYMENTS_EDIT_ACCESS, PAYMENT_CHANNEL_OPTIONS } from '@/features/settings/labels';
import { useSavePayments } from '@/features/settings/mutations';
import { useIntegrationsSettings, usePaymentsSettings } from '@/features/settings/queries';
import { paymentsFormSchema, paymentsToFormValues, toPaymentsPayload, type PaymentsFormValues } from '@/features/settings/schemas';
import { useCan } from '@/hooks/useCan';
import type { PaymentsSettingsDTO } from '@/types/api/settings';

/** project-overview.md §6.9 ST4 — which ways to pay the association accepts, receipts, and cash lodgment. Paystack is switched on from the website. */
export default function PaymentSettingsScreen() {
  const query = usePaymentsSettings();
  const allowed = useCan(PAYMENTS_EDIT_ACCESS);
  return (
    <SettingsScreen title="Payment settings" docsKey="ST4" allowed={allowed} query={query}>
      {(settings) => <PaymentsForm settings={settings} />}
    </SettingsScreen>
  );
}

function PaymentsForm({ settings }: { settings: PaymentsSettingsDTO }) {
  const router = useRouter();
  const save = useSavePayments();
  const integrations = useIntegrationsSettings().data;
  const { control, handleSubmit, formState } = useForm<PaymentsFormValues>({
    resolver: zodResolver(paymentsFormSchema),
    defaultValues: paymentsToFormValues(settings),
    mode: 'onTouched',
  });
  const methodsError = formState.errors.bank_transfer?.message;

  const submit = (values: PaymentsFormValues) =>
    save.mutate(toPaymentsPayload(values), {
      onSuccess: () => {
        toast.success('Payment settings saved');
        router.back();
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save. Try again.'),
    });

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Payment settings" onBack={() => router.back()} docsKey="ST4" />

      <View className="gap-6 pb-6">
        <Section title="Ways members can pay">
          <View className="gap-2">
            {PAYMENT_CHANNEL_OPTIONS.map((option) => (
              <Switch key={option.value} control={control} name={option.value} label={option.label} helper={option.helper} testID={`pay-${option.value}`} />
            ))}
            {methodsError ? (
              <Text variant="caption" tone="danger">
                {methodsError}
              </Text>
            ) : null}
          </View>
        </Section>

        <Section title="Receipts and part payments">
          <View className="gap-2">
            <Switch control={control} name="receiptAutoGenerate" label="Make a receipt automatically" helper="A receipt number is made for every payment that is recorded" testID="pay-receipts" />
            <Switch control={control} name="enablePartialPayments" label="Allow part payments" helper="Same as the setting under Financial settings: either one switched off stops part payments" testID="pay-partial" />
          </View>
        </Section>

        <Section title="Cash">
          <TextField control={control} name="cashLodgmentDueDays" label="Days to lodge cash" helper="After this many days, cash an officer collected and has not lodged is flagged as late" keyboardType="number-pad" testID="pay-lodgment" />
        </Section>

        <Section title="Online payments">
          <ListGroup>
            <ListItem title="Card payments (Paystack)" meta="Switched on from the SocietyLedger website" trailing={integrations ? <StatusChip status={integrations.paystackEnabled ? 'active' : 'inactive'} label={integrations.paystackEnabled ? 'On' : 'Off'} /> : undefined} />
            <ListItem title="Bank payments (Nomba)" meta="Switched on from the SocietyLedger website" trailing={integrations ? <StatusChip status={integrations.nombaEnabled ? 'active' : 'inactive'} label={integrations.nombaEnabled ? 'On' : 'Off'} /> : undefined} />
          </ListGroup>
        </Section>
      </View>

      <SaveFooter
        loading={save.isPending}
        disabled={!formState.isDirty}
        onPress={() => {
          void handleSubmit(submit)();
        }}
        testID="pay-save"
      />
    </Screen>
  );
}
