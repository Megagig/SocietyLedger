'use client';

import { Modal, Stack, Group, Badge, Text, Title, Button, Card, CopyButton, Alert } from '@mantine/core';
import { IconCopy, IconCheck, IconX, IconClock, IconAlertCircle } from '@tabler/icons-react';
import { SMSMessage } from '@/lib/api/sms';

interface MessageDetailModalProps {
  message: SMSMessage;
  opened: boolean;
  onClose: () => void;
}

export function MessageDetailModal({ message, opened, onClose }: MessageDetailModalProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'green';
      case 'sent':
        return 'blue';
      case 'failed':
        return 'red';
      case 'pending':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <IconCheck size={16} />;
      case 'sent':
        return <IconClock size={16} />;
      case 'failed':
        return <IconAlertCircle size={16} />;
      default:
        return <IconClock size={16} />;
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} size="lg" title="Message Details">
      <Stack gap="md">
        {/* Status Badge */}
        <Group justify="center">
          <Badge
            size="xl"
            color={getStatusColor(message.status)}
            variant="filled"
            leftSection={getStatusIcon(message.status)}
          >
            {message.status.toUpperCase()}
          </Badge>
        </Group>

        {/* Recipient Info */}
        <Card padding="md" withBorder>
          <Stack gap="sm">
            <Group>
              <Text size="sm" c="dimmed">Recipient</Text>
              <Text fw={500}>{message.recipientName || message.recipient}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Phone Number</Text>
              <Text fw={500} style={{ fontFamily: 'monospace' }}>
                {message.recipient}
              </Text>
              <CopyButton value={message.recipient}>
                {({ copied, copy }) => (
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={copy}
                    leftSection={<IconCopy size={14} />}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </CopyButton>
            </Group>
          </Stack>
        </Card>

        {/* Message Content */}
        <Card padding="md" withBorder>
          <Stack gap="sm">
            <Group>
              <Text size="sm" c="dimmed">Message</Text>
              <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
                {message.message}
              </Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Segments</Text>
              <Badge variant="light">{message.segments}</Badge>
            </Group>
            <Group>
              <Text size="sm" c="dimmed">Cost</Text>
              <Text fw={500}>{message.cost} credits</Text>
            </Group>
          </Stack>
        </Card>

        {/* Delivery Info */}
        <Card padding="md" withBorder>
          <Title order={4} mb="sm">Delivery Information</Title>
          <Stack gap="sm">
            <Group>
              <Text size="sm" c="dimmed">Sent At</Text>
              <Text fw={500}>{new Date(message.sentAt).toLocaleString()}</Text>
            </Group>

            {message.deliveredAt && (
              <Group>
                <Text size="sm" c="dimmed">Delivered At</Text>
                <Text fw={500}>{new Date(message.deliveredAt).toLocaleString()}</Text>
              </Group>
            )}

            <Group>
              <Text size="sm" c="dimmed">Campaign</Text>
              <Text fw={500}>{message.campaignId ? `#${message.campaignId}` : 'N/A'}</Text>
            </Group>

            <Group>
              <Text size="sm" c="dimmed">Template</Text>
              <Text fw={500}>{message.templateId ? `#${message.templateId}` : 'N/A'}</Text>
            </Group>
          </Stack>
        </Card>

        {/* Error Message */}
        {message.status === 'failed' && message.errorMessage && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Delivery Failed">
            <Text size="sm">{message.errorMessage}</Text>
          </Alert>
        )}

        {/* Actions */}
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
