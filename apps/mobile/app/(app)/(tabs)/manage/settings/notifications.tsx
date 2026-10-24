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
import { SettingsScreen } from '@/features/settings/components/SettingsScreen';
import { describeReminderDays, parseReminderDays, REMINDER_FREQUENCY_OPTIONS, SETTINGS_EDIT_ACCESS } from '@/features/settings/labels';
import { useSaveNotifications } from '@/features/settings/mutations';
import { useNotificationsSettings } from '@/features/settings/queries';
import { notificationsFormSchema, notificationsToFormValues, toNotificationsPayload, type NotificationsFormValues } from '@/features/settings/schemas';
import { useCan } from '@/hooks/useCan';
import type { NotificationsSettingsDTO } from '@/types/api/settings';

/** project-overview.md §6.9 ST5 — when members are reminded about charges by email, and the name the email comes from. */
export default function NotificationSettingsScreen() {
  const query = useNotificationsSettings();
  const allowed = useCan(SETTINGS_EDIT_ACCESS);
  return (
    <SettingsScreen title="Reminders and sender" docsKey="ST5" allowed={allowed} query={query}>
      {(settings) => <NotificationsForm settings={settings} />}
    </SettingsScreen>
  );
}

function NotificationsForm({ settings }: { settings: NotificationsSettingsDTO }) {
  const router = useRouter();
  const save = useSaveNotifications();
  const { control, handleSubmit, formState } = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: notificationsToFormValues(settings),
    mode: 'onTouched',
  });
  const emailOn = useWatch({ control, name: 'emailEnabled' });
  const daysText = useWatch({ control, name: 'paymentReminderDays' });

  const submit = (values: NotificationsFormValues) =>
    save.mutate(toNotificationsPayload(values), {
      onSuccess: () => {
        toast.success('Reminder settings saved');
        router.back();
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save. Try again.'),
    });

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Reminders and sender" onBack={() => router.back()} docsKey="ST5" />

      <View className="gap-6 pb-6">
        <Section title="Email reminders">
          <View className="gap-4">
            <Switch control={control} name="emailEnabled" label="Email members about their charges" helper="Switching this off stops every reminder email" testID="notif-email" />
            {emailOn ? (
              <>
                <TextField
                  control={control}
                  name="paymentReminderDays"
                  label="Days before the due date"
                  placeholder="7, 3, 1"
                  helper="Separate the days with commas. Up to 6 reminders."
                  keyboardType="numbers-and-punctuation"
                  testID="notif-days"
                />
                <Text variant="caption" tone="secondary">
                  {describeReminderDays(parseReminderDays(daysText ?? ''))}
                </Text>
                <SelectSheet control={control} name="overdueReminderFrequency" label="Once a charge is overdue, remind" options={REMINDER_FREQUENCY_OPTIONS} />
              </>
            ) : null}
          </View>
        </Section>

        <Section title="Sender">
          <TextField control={control} name="senderName" label="Emails come from" helper="The name members see on reminder emails" autoCapitalize="words" testID="notif-sender" />
        </Section>
      </View>

      <SaveFooter
        loading={save.isPending}
        disabled={!formState.isDirty}
        onPress={() => {
          void handleSubmit(submit)();
        }}
        testID="notif-save"
      />
    </Screen>
  );
}
