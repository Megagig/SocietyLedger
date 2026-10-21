import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Switch } from '@/components/forms/Switch';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import type { NotificationPreferencesDTO } from '@/types/api/notifications';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/features/notifications/queries';

/** project-overview.md §6.6 N2 — Notification preferences. */
export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const query = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const { control, handleSubmit, reset } = useForm<NotificationPreferencesDTO>({
    defaultValues: query.data,
    values: query.data,
  });

  function onSubmit(data: NotificationPreferencesDTO) {
    update.mutate(data, {
      onSuccess: () => {
        toast.success('Preferences saved');
        router.back();
      },
      onError: () => toast.error('Could not save preferences. Try again.'),
    });
  }

  return (
    <Screen edges={['top', 'bottom']} scroll keyboard>
      <ScreenHeader title="Notification preferences" onBack={() => router.back()} />

      {query.isPending && (
        <View className="gap-4 px-4 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={40} />
          ))}
        </View>
      )}

      {query.isError && <ErrorState onRetry={() => query.refetch()} />}

      {query.isSuccess && (
        <>
          <Section title="Channels">
            <Switch control={control} name="inAppEnabled" label="In-app notifications" />
            <Switch control={control} name="emailEnabled" label="Email notifications" />
            <Switch control={control} name="smsEnabled" label="SMS notifications" helper="SMS credits are required" />
            <Switch control={control} name="pushEnabled" label="Push notifications" helper="Device push notifications" />
          </Section>

          <Section title="Payments">
            <Switch control={control} name="paymentDueInApp" label="Payment due — in-app" />
            <Switch control={control} name="paymentDueEmail" label="Payment due — email" />
            <Switch control={control} name="paymentDueSMS" label="Payment due — SMS" />
            <Switch control={control} name="paymentReceivedInApp" label="Payment received — in-app" />
            <Switch control={control} name="paymentReceivedEmail" label="Payment received — email" />
            <Switch control={control} name="paymentReceivedSMS" label="Payment received — SMS" />
          </Section>

          <Section title="Announcements">
            <Switch control={control} name="announcementInApp" label="Announcements — in-app" />
            <Switch control={control} name="announcementEmail" label="Announcements — email" />
            <Switch control={control} name="announcementSMS" label="Announcements — SMS" />
          </Section>

          <Section title="Approvals">
            <Switch control={control} name="approvalInApp" label="Approvals — in-app" />
            <Switch control={control} name="approvalEmail" label="Approvals — email" />
            <Switch control={control} name="approvalSMS" label="Approvals — SMS" />
          </Section>

          <Section title="System">
            <Switch control={control} name="systemInApp" label="System alerts — in-app" />
            <Switch control={control} name="systemEmail" label="System alerts — email" />
            <Switch control={control} name="systemSMS" label="System alerts — SMS" />
          </Section>

          <Section title="Quiet hours">
            <Switch control={control} name="quietHoursEnabled" label="Enable quiet hours" helper="No notifications during these hours" />
            <Text variant="caption" tone="secondary" className="mt-1">
              Start: {query.data?.quietHoursStart ?? '22:00'} — End: {query.data?.quietHoursEnd ?? '07:00'} ({query.data?.quietHoursTimezone ?? 'UTC'})
            </Text>
          </Section>

          <StickyFooter>
            <Button
              variant="primary"
              loading={update.isPending}
              onPress={() => { handleSubmit(onSubmit)(); }}
              fullWidth
            >
              Save preferences
            </Button>
          </StickyFooter>
        </>
      )}
    </Screen>
  );
}
