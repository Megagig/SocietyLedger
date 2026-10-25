'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Stack,
  Group,
  Button,
  Alert,
  LoadingOverlay,
  Card,
  Text as MantineText,
} from '@mantine/core';
import { IconArrowLeft, IconSend, IconCheck } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { smsApi, SendSMSRequest, SMSTemplate } from '@/lib/api/sms';
import { membersApi, Member } from '@/lib/api/members';
import { RecipientSelector } from '@/components/communications/RecipientSelector';
import { SMSComposer } from '@/components/communications/SMSComposer';

export default function QuickSendPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState<Array<{ id: string; type: 'member' | 'phone'; value: string | number; label: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplate | undefined>();

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: () => smsApi.getTemplates(),
  });

  const templates = templatesData?.templates || [];

  // Fetch members
  const { data: membersData, isLoading: isLoadingMembers } = useQuery({
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

  // Send SMS mutation
  const sendMutation = useMutation({
    mutationFn: (data: SendSMSRequest) => smsApi.sendSMS(data),
    onSuccess: (response) => {
      // What actually happened: a text that fails is refunded and said so, rather than reported as sent
      const result = (response as { totalSent?: number; totalFailed?: number; inProgress?: boolean; accepted?: number }) ?? {};
      notifications.show({
        title: result.inProgress ? 'Sending' : result.totalFailed ? 'SMS Partly Sent' : 'SMS Sent Successfully',
        message: result.inProgress
          ? `Sending to ${result.accepted ?? recipients.length} people. You can leave this page.`
          : result.totalFailed
            ? `${result.totalSent ?? 0} sent, ${result.totalFailed} did not go out (those credits are refunded).`
            : `Message sent to ${result.totalSent ?? recipients.length} recipient(s)`,
        color: result.totalFailed ? 'orange' : 'green',
        icon: <IconCheck size={18} />,
      });
      // Reset form
      setMessage('');
      setRecipients([]);
      setSelectedTemplate(undefined);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Failed to Send SMS',
        message: error.response?.data?.message || 'An error occurred while sending the message',
        color: 'red',
      });
    },
  });

  const handleSend = () => {
    if (recipients.length === 0) {
      notifications.show({
        title: 'No Recipients',
        message: 'Please add at least one recipient',
        color: 'yellow',
      });
      return;
    }

    if (!message.trim()) {
      notifications.show({
        title: 'Empty Message',
        message: 'Please enter a message to send',
        color: 'yellow',
      });
      return;
    }

    const requestData: SendSMSRequest = {
      recipients: recipients.map(r => String(r.value)),
      message: message.trim(),
      ...(selectedTemplate && { templateId: selectedTemplate.id }),
    };

    sendMutation.mutate(requestData);
  };

  const estimatedCost = recipients.length * Math.ceil(message.length / 160);

  return (
    <Container size="xl" py="xl">
      <LoadingOverlay visible={sendMutation.isPending} />
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group>
            <Button
              variant="subtle"
              onClick={() => router.push('/dashboard/communications')}
            >
              <IconArrowLeft size={18} />
            </Button>
            <div>
              <Title order={2}>Quick Send</Title>
              <MantineText c="dimmed">Send SMS to members or custom numbers</MantineText>
            </div>
          </Group>
          <Button
            leftSection={<IconSend size={18} />}
            onClick={handleSend}
            loading={sendMutation.isPending}
            disabled={recipients.length === 0 || !message.trim()}
            size="lg"
          >
            Send Message
          </Button>
        </Group>

        {/* Cost Estimate */}
        {recipients.length > 0 && message.length > 0 && (
          <Alert color="blue" variant="light">
            <Group gap="md">
              <div>
                <MantineText size="sm" c="dimmed">Estimated Cost</MantineText>
                <MantineText size="lg" fw={600}>
                  {estimatedCost} credits
                </MantineText>
              </div>
              <div>
                <MantineText size="sm" c="dimmed">Recipients</MantineText>
                <MantineText size="lg" fw={600}>
                  {recipients.length}
                </MantineText>
              </div>
              <div>
                <MantineText size="sm" c="dimmed">Segments</MantineText>
                <MantineText size="lg" fw={600}>
                  {Math.ceil(message.length / 160)}
                </MantineText>
              </div>
            </Group>
          </Alert>
        )}

        {/* Main Content */}
        <Group align="flex-start">
          {/* Recipient Selector - Takes 40% width */}
          <div style={{ flex: '0 0 40%' }}>
            <RecipientSelector
              members={members}
              selectedRecipients={recipients}
              onRecipientsChange={setRecipients}
              maxRecipients={500}
            />
          </div>

          {/* Message Composer - Takes 60% width */}
          <div style={{ flex: '0 0 60%' }}>
            <SMSComposer
              message={message}
              onMessageChange={setMessage}
              templates={templates}
              selectedTemplate={selectedTemplate}
              onTemplateSelect={setSelectedTemplate}
              onSend={handleSend}
              sending={sendMutation.isPending}
              disabled={recipients.length === 0}
            />
          </div>
        </Group>

        {/* Info Cards */}
        <Card padding="md" radius="md" withBorder>
          <Title order={4} mb="md">Quick Tips</Title>
          <Stack gap="sm">
            <MantineText size="sm">
              • Each SMS segment is 160 characters. Longer messages use multiple segments.
            </MantineText>
            <MantineText size="sm">
              • Variables like {'{'}name{'}'}, {'{'}amount{'}'} can be inserted from templates.
            </MantineText>
            <MantineText size="sm">
              • Phone numbers must be in Nigerian format: 08012345678 or +2348012345678
            </MantineText>
            <MantineText size="sm">
              • Maximum 500 recipients per send. Use campaigns for larger groups.
            </MantineText>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
