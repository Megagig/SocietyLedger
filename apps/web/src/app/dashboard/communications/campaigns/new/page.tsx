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
  MultiSelect,
  NumberInput,
  LoadingOverlay,
  Alert,
  Text as MantineText,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconArrowLeft, IconSend, IconClock } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { smsApi, CreateCampaignRequest, SMSRecipientType, SMSTemplate } from '@/lib/api/sms';
import { membersApi, Member } from '@/lib/api/members';
import { MEMBER_CATEGORIES } from '@/utils/constants';
import { SMSComposer } from '@/components/communications/SMSComposer';
import { RecipientSelector } from '@/components/communications/RecipientSelector';

// G39/G40: recipientType previously used fake lowercase values ('all',
// 'category', 'status', 'custom') the API never accepted, and the message
// composer only rendered for 'custom' — every other recipient type had no
// way to enter a message at all. Both fixed here against the real
// SMSRecipientType enum and recipientFilter shape.
const RECIPIENT_TYPE_OPTIONS: { value: SMSRecipientType; label: string }[] = [
  { value: 'ALL_MEMBERS', label: 'All Members' },
  { value: 'SELECTED_MEMBERS', label: 'Selected Members' },
  { value: 'MEMBER_CATEGORY', label: 'By Category' },
  { value: 'CUSTOM_NUMBERS', label: 'Custom Phone Numbers' },
  { value: 'OWING_MEMBERS', label: 'Members Owing Dues' },
  { value: 'PAID_MEMBERS', label: 'Paid-Up Members' },
];

export default function CampaignBuilderPage() {
  const router = useRouter();

  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [recipientType, setRecipientType] = useState<SMSRecipientType>('ALL_MEMBERS');
  const [selectedMembers, setSelectedMembers] = useState<Array<{ id: string; type: 'member' | 'phone'; value: string | number; label: string }>>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customNumbers, setCustomNumbers] = useState('');
  const [owingMinAmount, setOwingMinAmount] = useState<number | undefined>(undefined);
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplate | undefined>();

  const { data: templatesData } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: () => smsApi.getTemplates(),
  });
  const templates = templatesData?.templates || [];

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
      notifications.show({ title: 'Campaign Name Required', message: 'Please enter a name for your campaign', color: 'yellow' });
      return;
    }
    if (!message.trim()) {
      notifications.show({ title: 'Message Required', message: 'Please enter a message for your campaign', color: 'yellow' });
      return;
    }
    if (recipientType === 'SELECTED_MEMBERS' && selectedMembers.length === 0) {
      notifications.show({ title: 'No Recipients', message: 'Please select at least one member', color: 'yellow' });
      return;
    }
    if (recipientType === 'MEMBER_CATEGORY' && selectedCategories.length === 0) {
      notifications.show({ title: 'No Category Selected', message: 'Please select at least one category', color: 'yellow' });
      return;
    }
    if (recipientType === 'CUSTOM_NUMBERS' && !customNumbers.trim()) {
      notifications.show({ title: 'No Numbers Entered', message: 'Please enter at least one phone number', color: 'yellow' });
      return;
    }

    const requestData: CreateCampaignRequest = {
      name: campaignName.trim(),
      message: message.trim(),
      recipientType,
      ...(scheduleDate && { scheduledAt: scheduleDate.toISOString() }),
      ...(selectedTemplate && { templateId: selectedTemplate.id }),
    };

    if (recipientType === 'SELECTED_MEMBERS') {
      requestData.recipientFilter = { memberIds: selectedMembers.map((r) => Number(r.value)) };
    } else if (recipientType === 'MEMBER_CATEGORY') {
      requestData.recipientFilter = { categories: selectedCategories };
    } else if (recipientType === 'CUSTOM_NUMBERS') {
      requestData.recipientFilter = {
        customNumbers: customNumbers.split(/[\n,]/).map((n) => n.trim()).filter(Boolean),
      };
    } else if (recipientType === 'OWING_MEMBERS' && owingMinAmount) {
      requestData.recipientFilter = { owingMinAmount };
    }

    campaignMutation.mutate(requestData);
  };

  return (
    <Container size="xl" py="xl">
      <LoadingOverlay visible={campaignMutation.isPending} />
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group>
            <Button variant="subtle" onClick={() => router.push('/dashboard/communications/campaigns')}>
              <IconArrowLeft size={18} />
            </Button>
            <div>
              <Title order={2}>Create New Campaign</Title>
              <MantineText c="dimmed">Create and schedule an SMS campaign</MantineText>
            </div>
          </Group>
          <Button
            leftSection={<IconSend size={18} />}
            onClick={handleSave}
            loading={campaignMutation.isPending}
            size="lg"
          >
            Create Campaign
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
              data={RECIPIENT_TYPE_OPTIONS}
              value={recipientType}
              onChange={(value) => setRecipientType((value as SMSRecipientType) || 'ALL_MEMBERS')}
              size="md"
            />

            {recipientType === 'MEMBER_CATEGORY' && (
              <MultiSelect
                label="Categories"
                placeholder="Select categories"
                data={Object.values(MEMBER_CATEGORIES).map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
                value={selectedCategories}
                onChange={setSelectedCategories}
                size="md"
              />
            )}

            {recipientType === 'CUSTOM_NUMBERS' && (
              <Textarea
                label="Phone Numbers"
                placeholder="Enter phone numbers, one per line or comma-separated"
                value={customNumbers}
                onChange={(e) => setCustomNumbers(e.currentTarget.value)}
                minRows={3}
                size="md"
              />
            )}

            {recipientType === 'OWING_MEMBERS' && (
              <NumberInput
                label="Minimum Amount Owing (optional)"
                placeholder="Leave empty to include all owing members"
                value={owingMinAmount}
                onChange={(v) => setOwingMinAmount(v === '' ? undefined : Number(v))}
                min={0}
                size="md"
              />
            )}

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

        {/* Recipient selection for SELECTED_MEMBERS */}
        {recipientType === 'SELECTED_MEMBERS' ? (
          <Group align="flex-start">
            <div style={{ flex: '0 0 40%' }}>
              <RecipientSelector
                members={members}
                selectedRecipients={selectedMembers}
                onRecipientsChange={setSelectedMembers}
                maxRecipients={500}
              />
            </div>
            <div style={{ flex: '0 0 60%' }}>
              <SMSComposer
                message={message}
                onMessageChange={setMessage}
                templates={templates}
                selectedTemplate={selectedTemplate}
                onTemplateSelect={setSelectedTemplate}
              />
            </div>
          </Group>
        ) : (
          <Stack gap="md">
            <Alert color="blue" variant="light">
              <MantineText size="sm">
                {recipientType === 'ALL_MEMBERS' && 'This campaign will be sent to all active members.'}
                {recipientType === 'MEMBER_CATEGORY' && 'This campaign will be sent to members in the selected categories.'}
                {recipientType === 'CUSTOM_NUMBERS' && 'This campaign will be sent to the phone numbers entered above.'}
                {recipientType === 'OWING_MEMBERS' && 'This campaign will be sent to members with outstanding dues.'}
                {recipientType === 'PAID_MEMBERS' && 'This campaign will be sent to members who are fully paid up.'}
              </MantineText>
            </Alert>
            {/* G40: the composer now always renders, regardless of recipient type. */}
            <SMSComposer
              message={message}
              onMessageChange={setMessage}
              templates={templates}
              selectedTemplate={selectedTemplate}
              onTemplateSelect={setSelectedTemplate}
            />
          </Stack>
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
