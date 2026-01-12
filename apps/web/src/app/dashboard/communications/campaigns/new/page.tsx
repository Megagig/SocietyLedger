'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Stack,
  Group,
  Button,
  Card,
  TextInput,
  Textarea,
  Select,
  LoadingOverlay,
  Alert,
  Text as MantineText,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconArrowLeft, IconSend, IconClock } from '@tabler/icons-react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { smsApi, CreateCampaignRequest, SMSTemplate } from '@/lib/api/sms';
import { membersApi, Member } from '@/lib/api/members';
import { SMSComposer } from '@/components/communications/SMSComposer';
import { RecipientSelector } from '@/components/communications/RecipientSelector';

export default function CampaignBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = Array.isArray(params.id) ? parseInt(params.id[0]) : (params.id ? parseInt(params.id) : null);

  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [recipients, setRecipients] = useState<Array<{ id: string; type: 'member' | 'phone'; value: string | number; label: string }>>([]);
  const [recipientType, setRecipientType] = useState<'all' | 'category' | 'status' | 'custom'>('custom');
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplate | undefined>();

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: () => smsApi.getTemplates(),
  });

  // Fetch members
  const { data: membersData } = useQuery({
    queryKey: ['members-list'],
    queryFn: () => membersApi.getMembers({ limit: 1000 }),
  });

  const members: Array<{ id: number; name: string; phone: string; category: string; status: string }> =
    membersData?.members?.map((m: Member) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      phone: m.phone || '',
      category: m.category,
      status: m.status,
    })) || [];

  // Fetch existing campaign if editing
  const { data: existingCampaign } = useQuery({
    queryKey: ['sms-campaign', campaignId],
    queryFn: () => (campaignId ? smsApi.getCampaign(campaignId) : Promise.resolve(null)),
    enabled: !!campaignId,
  });

  // Load existing campaign data
  useState(() => {
    if (existingCampaign && campaignId) {
      setCampaignName(existingCampaign.name);
      setMessage(existingCampaign.message);
      if (existingCampaign.scheduledFor) {
        setScheduleDate(new Date(existingCampaign.scheduledFor));
      }
    }
  });

  const templates = templatesData?.templates || [];

  // Create/Update campaign mutation
  const campaignMutation = useMutation({
    mutationFn: (data: CreateCampaignRequest) => smsApi.createCampaign(data),
    onSuccess: () => {
      notifications.show({
        title: 'Campaign Created',
        message: 'Your SMS campaign has been created successfully',
        color: 'green',
      });
      router.push('/dashboard/communications/campaigns');
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Failed to Create Campaign',
        message: error.response?.data?.message || 'An error occurred',
        color: 'red',
      });
    },
  });

  const handleSave = () => {
    if (!campaignName.trim()) {
      notifications.show({
        title: 'Campaign Name Required',
        message: 'Please enter a name for your campaign',
        color: 'yellow',
      });
      return;
    }

    if (recipients.length === 0 && recipientType !== 'all') {
      notifications.show({
        title: 'No Recipients',
        message: 'Please add recipients or select "All Members"',
        color: 'yellow',
      });
      return;
    }

    if (!message.trim()) {
      notifications.show({
        title: 'Message Required',
        message: 'Please enter a message for your campaign',
        color: 'yellow',
      });
      return;
    }

    const requestData: CreateCampaignRequest = {
      name: campaignName.trim(),
      message: message.trim(),
      recipientType,
      ...(recipientType === 'custom' && {
        recipientIds: recipients.map(r => typeof r.value === 'number' ? r.value : parseInt(r.value as string)),
      }),
      ...(scheduleDate && { scheduleAt: scheduleDate.toISOString() }),
    };

    campaignMutation.mutate(requestData);
  };

  return (
    <Container size="xl" py="xl">
      <LoadingOverlay visible={campaignMutation.isPending} />
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group>
            <Button
              variant="subtle"
              onClick={() => router.push('/dashboard/communications/campaigns')}
            >
              <IconArrowLeft size={18} />
            </Button>
            <div>
              <Title order={2}>
                {campaignId ? 'Edit Campaign' : 'Create New Campaign'}
              </Title>
              <MantineText c="dimmed">
                {campaignId ? 'Update campaign details' : 'Create and schedule SMS campaign'}
              </MantineText>
            </div>
          </Group>
          <Button
            leftSection={<IconSend size={18} />}
            onClick={handleSave}
            loading={campaignMutation.isPending}
            size="lg"
          >
            {campaignId ? 'Update Campaign' : 'Create Campaign'}
          </Button>
        </Group>

        {/* Campaign Settings */}
        <Card padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <TextInput
              label="Campaign Name"
              placeholder="e.g., Monthly Dues Reminder"
              value={campaignName}
              onChange={(e) => setCampaignName(e.currentTarget.value)}
              required
              size="md"
            />

            <Select
              label="Recipient Type"
              placeholder="Select recipient type"
              data={[
                { value: 'all', label: 'All Members' },
                { value: 'category', label: 'By Category' },
                { value: 'status', label: 'By Status' },
                { value: 'custom', label: 'Custom Selection' },
              ]}
              value={recipientType}
              onChange={(value) => setRecipientType(value as any)}
              size="md"
            />

            <DateInput
              label="Schedule For (Optional)"
              placeholder="Select date and time"
              value={scheduleDate}
              onChange={setScheduleDate}
              leftSection={<IconClock size={16} />}
              clearable
              size="md"
              minDate={new Date()}
            />
          </Stack>
        </Card>

        {/* Main Content */}
        {recipientType === 'custom' ? (
          <Group align="flex-start">
            {/* Recipient Selector */}
            <div style={{ flex: '0 0 40%' }}>
              <RecipientSelector
                members={members}
                selectedRecipients={recipients}
                onRecipientsChange={setRecipients}
                maxRecipients={500}
              />
            </div>

            {/* Message Composer */}
            <div style={{ flex: '0 0 60%' }}>
              <SMSComposer
                message={message}
                onMessageChange={setMessage}
                templates={templates}
                selectedTemplate={selectedTemplate}
                onTemplateSelect={setSelectedTemplate}
                disabled={recipients.length === 0}
              />
            </div>
          </Group>
        ) : (
          <Alert color="blue" variant="light">
            <MantineText size="sm">
              {recipientType === 'all'
                ? 'This campaign will be sent to all active members.'
                : recipientType === 'category'
                ? 'This campaign will be sent to members in the selected category.'
                : 'This campaign will be sent to members with the selected status.'}
            </MantineText>
          </Alert>
        )}

        {/* Info */}
        <Card padding="md" radius="md" withBorder>
          <MantineText size="sm" fw={500} mb="xs">Campaign Tips</MantineText>
          <Stack gap="xs">
            <MantineText size="sm" c="dimmed">
              • Give your campaign a descriptive name for easy identification
            </MantineText>
            <MantineText size="sm" c="dimmed">
              • Use templates to save time and ensure consistency
            </MantineText>
            <MantineText size="sm" c="dimmed">
              • Schedule campaigns in advance for better planning
            </MantineText>
            <MantineText size="sm" c="dimmed">
              • Each SMS segment costs 1 credit. Long messages use multiple segments.
            </MantineText>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
