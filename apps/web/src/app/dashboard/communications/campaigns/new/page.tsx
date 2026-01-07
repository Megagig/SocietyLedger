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
  Checkbox,
  Select,
  MultiSelect,
  LoadingOverlay,
  Divider,
  Badge,
  Radio,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Plus, AlertCircle, Send } from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import {
  createSMSCampaign,
  startSMSCampaign,
  getSMSTemplates,
  getSMSCreditBalance,
  type RecipientFilter,
  type SMSTemplate,
} from '@/lib/api/communication';

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [useTemplate, setUseTemplate] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      message: '',
      templateId: '',
      sendToAll: false,
      memberType: [] as string[],
      groups: [] as string[],
      tags: [] as string[],
      scheduleType: 'immediate' as 'immediate' | 'scheduled',
      scheduledAt: null as Date | null,
    },
    validate: {
      name: (value) => (!value ? 'Campaign name is required' : null),
      message: (value) =>
        !useTemplate && !value
          ? 'Message is required'
          : value.length > 160
          ? 'Message too long (max 160 characters)'
          : null,
      templateId: (value) => (useTemplate && !value ? 'Please select a template' : null),
      scheduledAt: (value) =>
        form.values.scheduleType === 'scheduled' && !value
          ? 'Please select a date and time'
          : null,
    },
  });

  useState(() => {
    loadTemplates();
    loadBalance();
  });

  const loadTemplates = async () => {
    try {
      const res = await getSMSTemplates();
      setTemplates(res.data.templates);
    } catch (err: any) {
      console.error('Error loading templates:', err);
    }
  };

  const loadBalance = async () => {
    try {
      const res = await getSMSCreditBalance();
      setBalance(res.data.balance);
    } catch (err: any) {
      console.error('Error loading balance:', err);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      form.setFieldValue('message', template.content);
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);

      // Build recipient filter
      const filter: RecipientFilter = {};
      if (values.sendToAll) {
        filter.sendToAll = true;
      }
      if (values.memberType.length > 0) {
        filter.memberType = values.memberType as any;
      }
      if (values.groups.length > 0) {
        filter.groups = values.groups;
      }
      if (values.tags.length > 0) {
        filter.tags = values.tags;
      }

      // Create campaign
      const payload: any = {
        name: values.name,
        description: values.description || undefined,
        message: useTemplate ? undefined : values.message,
        templateId: useTemplate ? values.templateId : undefined,
        filter,
      };

      if (values.scheduleType === 'scheduled' && values.scheduledAt) {
        payload.scheduledAt = values.scheduledAt.toISOString();
      }

      const res = await createSMSCampaign(payload);

      // Start immediately if not scheduled
      if (values.scheduleType === 'immediate') {
        await startSMSCampaign(res.data.id);
        notifications.show({
          title: 'Campaign Started',
          message: 'Your campaign has been created and started',
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Campaign Scheduled',
          message: 'Your campaign has been scheduled successfully',
          color: 'green',
        });
      }

      router.push('/dashboard/communications/campaigns');
    } catch (err: any) {
      console.error('Error creating campaign:', err);
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to create campaign',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Can
      permission="SMS_SEND"
      fallback={<Alert color="red">You don't have permission to create campaigns</Alert>}
    >
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Create SMS Campaign</Title>
            <Text size="sm" c="dimmed">
              Create a campaign to send SMS to multiple members
            </Text>
          </div>
          <Button variant="light" onClick={() => router.back()}>
            Cancel
          </Button>
        </Group>

        {balance !== null && balance < 10 && (
          <Alert icon={<AlertCircle size={16} />} color="orange" title="Low SMS Balance">
            You have only {balance} SMS credits remaining. Top up to continue sending messages.
          </Alert>
        )}

        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              {/* Campaign Details */}
              <Title order={4}>Campaign Details</Title>

              <TextInput
                label="Campaign Name"
                placeholder="e.g., Monthly Newsletter"
                {...form.getInputProps('name')}
                required
              />

              <Textarea
                label="Description"
                description="Optional description for your reference"
                placeholder="Brief description of the campaign"
                minRows={2}
                {...form.getInputProps('description')}
              />

              <Divider />

              {/* Message */}
              <Title order={4}>Message</Title>

              <Checkbox
                label="Use template"
                checked={useTemplate}
                onChange={(e) => setUseTemplate(e.currentTarget.checked)}
              />

              {useTemplate ? (
                <Select
                  label="Select Template"
                  placeholder="Choose a template"
                  data={templates.map((t) => ({ value: t.id, label: t.name }))}
                  {...form.getInputProps('templateId')}
                  onChange={(value) => {
                    form.setFieldValue('templateId', value || '');
                    if (value) handleTemplateChange(value);
                  }}
                  required
                />
              ) : (
                <Textarea
                  label="Message"
                  description={`${form.values.message.length}/160 characters`}
                  placeholder="Type your message here..."
                  minRows={4}
                  maxRows={6}
                  {...form.getInputProps('message')}
                  required
                />
              )}

              <Divider />

              {/* Recipients */}
              <Title order={4}>Recipients</Title>

              <Checkbox
                label="Send to all members"
                {...form.getInputProps('sendToAll', { type: 'checkbox' })}
              />

              {!form.values.sendToAll && (
                <Stack gap="sm">
                  <MultiSelect
                    label="Member Type"
                    description="Filter by member type"
                    placeholder="Select member types"
                    data={[
                      { value: 'REGULAR', label: 'Regular Members' },
                      { value: 'EXECUTIVE', label: 'Executive Members' },
                      { value: 'HONORARY', label: 'Honorary Members' },
                    ]}
                    {...form.getInputProps('memberType')}
                  />

                  <MultiSelect
                    label="Groups"
                    description="Filter by member groups"
                    placeholder="Select groups"
                    data={[]} // Populate from API
                    {...form.getInputProps('groups')}
                  />

                  <MultiSelect
                    label="Tags"
                    description="Filter by member tags"
                    placeholder="Select tags"
                    data={[]} // Populate from API
                    {...form.getInputProps('tags')}
                  />
                </Stack>
              )}

              <Divider />

              {/* Schedule */}
              <Title order={4}>Schedule</Title>

              <Radio.Group {...form.getInputProps('scheduleType')}>
                <Stack gap="xs">
                  <Radio value="immediate" label="Send immediately after creation" />
                  <Radio value="scheduled" label="Schedule for later" />
                </Stack>
              </Radio.Group>

              {form.values.scheduleType === 'scheduled' && (
                <DateTimePicker
                  label="Schedule Date & Time"
                  placeholder="Select date and time"
                  {...form.getInputProps('scheduledAt')}
                  minDate={new Date()}
                  required
                />
              )}

              {/* Cost Estimate */}
              {estimatedCost > 0 && (
                <Alert icon={<AlertCircle size={16} />} color="blue">
                  <Group justify="space-between">
                    <Text size="sm">Estimated Cost:</Text>
                    <Badge size="lg">{estimatedCost} credits</Badge>
                  </Group>
                </Alert>
              )}

              {balance !== null && (
                <Alert color="gray">
                  <Group justify="space-between">
                    <Text size="sm">Available Balance:</Text>
                    <Badge size="lg" color={balance < estimatedCost ? 'red' : 'green'}>
                      {balance} credits
                    </Badge>
                  </Group>
                </Alert>
              )}

              {/* Submit */}
              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={() => router.back()} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  leftSection={
                    form.values.scheduleType === 'immediate' ? (
                      <Send size={16} />
                    ) : (
                      <Plus size={16} />
                    )
                  }
                  loading={loading}
                  disabled={balance !== null && balance < estimatedCost}
                >
                  {form.values.scheduleType === 'immediate'
                    ? 'Create & Send'
                    : 'Schedule Campaign'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Can>
  );
}
