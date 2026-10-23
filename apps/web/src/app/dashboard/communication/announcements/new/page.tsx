'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Stack,
  TextInput,
  Textarea,
  Button,
  Group,
  Alert,
  Select,
  Checkbox,
  LoadingOverlay,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Send, AlertCircle } from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { notificationsApi } from '@/lib/api/notifications';

export default function CreateAnnouncementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      title: '',
      message: '',
      priority: 'info' as 'info' | 'warning' | 'urgent',
      sendEmail: false,
    },
    validate: {
      title: (value) => (!value ? 'Title is required' : value.length > 200 ? 'Title too long (max 200 characters)' : null),
      message: (value) => (!value ? 'Message is required' : value.length > 2000 ? 'Message too long (max 2000 characters)' : null),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);

      await notificationsApi.createAnnouncement(values);

      notifications.show({
        title: 'Announcement Sent',
        message: 'Your announcement has been sent to all members',
        color: 'green',
      });

      router.push('/dashboard/communication/announcements');
    } catch (err: any) {
      console.error('Error creating announcement:', err);
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to create announcement',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Can
      permission={PERMISSIONS.NOTIFICATION_SEND}
      fallback={<Alert color="red">You don&apos;t have permission to create announcements</Alert>}
    >
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Create Announcement</Title>
            <Text size="sm" c="dimmed">
              Send an announcement to all members
            </Text>
          </div>
          <Button variant="light" onClick={() => router.back()}>
            Cancel
          </Button>
        </Group>

        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Title"
                placeholder="Announcement title"
                {...form.getInputProps('title')}
                required
              />

              <Textarea
                label="Message"
                description={`${form.values.message.length}/2000 characters`}
                placeholder="Type your announcement message here..."
                minRows={6}
                maxRows={12}
                {...form.getInputProps('message')}
                required
              />

              <Select
                label="Priority"
                description="Select the importance level of this announcement"
                {...form.getInputProps('priority')}
                data={[
                  { value: 'info', label: 'Information (Blue)' },
                  { value: 'warning', label: 'Warning (Yellow)' },
                  { value: 'urgent', label: 'Urgent (Red)' },
                ]}
                required
              />

              <Checkbox
                label="Also send via email"
                description="In addition to in-app notification, send this announcement via email"
                {...form.getInputProps('sendEmail', { type: 'checkbox' })}
              />

              <Alert icon={<AlertCircle size={16} />} color="blue">
                <Text size="sm">
                  This announcement will be sent to all active members in your association.
                  {form.values.sendEmail && ' Emails will be sent to all members with valid email addresses.'}
                </Text>
              </Alert>

              <Group justify="flex-end" mt="md">
                <Button
                  variant="light"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  leftSection={<Send size={16} />}
                  loading={loading}
                >
                  Send Announcement
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Can>
  );
}
