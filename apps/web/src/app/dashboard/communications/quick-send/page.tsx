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
  Badge,
  Divider,
  NumberInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Send, AlertCircle, Users, Phone } from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  sendQuickSMS,
  getSMSCreditBalance,
  type RecipientFilter,
} from '@/lib/api/communication';

export default function QuickSendPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [recipientType, setRecipientType] = useState<'phone' | 'filter'>('phone');

  const form = useForm({
    initialValues: {
      phoneNumbers: '',
      message: '',
      sendToAll: false,
      memberType: [] as string[],
      groups: [] as string[],
      tags: [] as string[],
    },
    validate: {
      message: (value) =>
        !value ? 'Message is required' : value.length > 160 ? 'Message too long (max 160 characters)' : null,
      phoneNumbers: (value) =>
        recipientType === 'phone' && !value && !form.values.sendToAll
          ? 'At least one phone number is required'
          : null,
    },
  });

  useState(() => {
    loadBalance();
  });

  const loadBalance = async () => {
    try {
      const res = await getSMSCreditBalance();
      setBalance(res.data.balance);
    } catch (err: any) {
      console.error('Error loading balance:', err);
    }
  };

  const calculateCost = () => {
    if (recipientType === 'phone' && form.values.phoneNumbers) {
      const phones = form.values.phoneNumbers.split(/[,\n]/).filter((p) => p.trim());
      setEstimatedCost(phones.length);
    } else if (form.values.sendToAll) {
      setEstimatedCost(0); // Will be calculated on backend
    } else {
      setEstimatedCost(0);
    }
  };

  useState(() => {
    calculateCost();
  }, [form.values.phoneNumbers, form.values.sendToAll, recipientType]);

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);

      let payload: any = {
        message: values.message,
      };

      if (recipientType === 'phone') {
        // Parse phone numbers
        const phones = values.phoneNumbers
          .split(/[,\n]/)
          .map((p) => p.trim())
          .filter((p) => p);
        payload.phoneNumbers = phones;
      } else {
        // Build filter
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
        payload.filter = filter;
      }

      await sendQuickSMS(payload);

      notifications.show({
        title: 'SMS Sent',
        message: 'Your message has been queued for delivery',
        color: 'green',
      });

      router.push('/dashboard/communications');
    } catch (err: any) {
      console.error('Error sending SMS:', err);
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to send SMS',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Can
      permission={PERMISSIONS.SMS_SEND}
      fallback={<Alert color="red">You don't have permission to send SMS</Alert>}
    >
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Quick Send SMS</Title>
            <Text size="sm" c="dimmed">
              Send SMS to specific phone numbers or member groups
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
              {/* Recipient Type */}
              <Select
                label="Recipient Type"
                value={recipientType}
                onChange={(value) => setRecipientType(value as 'phone' | 'filter')}
                data={[
                  { value: 'phone', label: 'Specific Phone Numbers' },
                  { value: 'filter', label: 'Member Groups/Filters' },
                ]}
                required
              />

              {recipientType === 'phone' ? (
                <>
                  <Textarea
                    label="Phone Numbers"
                    description="Enter phone numbers separated by commas or new lines (e.g., 08012345678, 09087654321)"
                    placeholder="08012345678, 09087654321"
                    minRows={4}
                    {...form.getInputProps('phoneNumbers')}
                    required
                  />
                </>
              ) : (
                <>
                  <Checkbox
                    label="Send to all members"
                    {...form.getInputProps('sendToAll', { type: 'checkbox' })}
                  />

                  {!form.values.sendToAll && (
                    <>
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
                    </>
                  )}
                </>
              )}

              <Divider />

              {/* Message */}
              <Textarea
                label="Message"
                description={`${form.values.message.length}/160 characters`}
                placeholder="Type your message here..."
                minRows={4}
                maxRows={6}
                {...form.getInputProps('message')}
                required
              />

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
              <Group justify="flex-end">
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
                  disabled={balance !== null && balance < estimatedCost}
                >
                  Send SMS
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Can>
  );
}
