'use client';

import { 
  Card, 
  Stack, 
  Text, 
  TextInput, 
  Textarea, 
  Select, 
  Button, 
  Group,
  Badge,
  Alert,
  Switch,
  NumberInput
} from '@mantine/core';
import { 
  IconSend, 
  IconAlertTriangle,
  IconInfoCircle
} from '@tabler/icons-react';
import { useState } from 'react';

interface WebhookTestBuilderProps {
  onSendTest: (testData: WebhookTestData) => void;
  loading?: boolean;
}

export interface WebhookTestData {
  eventType: string;
  payload: string;
  headers: Record<string, string>;
  simulateDelay?: number;
  simulateError?: boolean;
  errorStatusCode?: number;
}

const EVENT_TYPES = [
  { value: 'payment.success', label: 'Payment Success' },
  { value: 'payment.failed', label: 'Payment Failed' },
  { value: 'subscription.created', label: 'Subscription Created' },
  { value: 'subscription.renewed', label: 'Subscription Renewed' },
  { value: 'subscription.cancelled', label: 'Subscription Cancelled' },
  { value: 'invoice.created', label: 'Invoice Created' },
  { value: 'invoice.paid', label: 'Invoice Paid' },
  { value: 'invoice.failed', label: 'Invoice Failed' },
  { value: 'customer.created', label: 'Customer Created' },
  { value: 'customer.updated', label: 'Customer Updated' },
  { value: 'member.joined', label: 'Member Joined' },
  { value: 'member.left', label: 'Member Left' },
  { value: 'meeting.scheduled', label: 'Meeting Scheduled' },
  { value: 'meeting.completed', label: 'Meeting Completed' },
  { value: 'custom', label: 'Custom Event' },
];

const DEFAULT_PAYLOADS: Record<string, string> = {
  'payment.success': JSON.stringify({
    event: 'payment.success',
    data: {
      id: 'pay_1234567890',
      amount: 50000,
      currency: 'NGN',
      status: 'success',
      reference: 'REF-1234567890',
      customer: {
        id: 'cus_1234567890',
        email: 'customer@example.com',
        name: 'John Doe'
      },
      metadata: {
        association_id: 1,
        member_id: 123
      }
    }
  }, null, 2),
  'payment.failed': JSON.stringify({
    event: 'payment.failed',
    data: {
      id: 'pay_1234567890',
      amount: 50000,
      currency: 'NGN',
      status: 'failed',
      reference: 'REF-1234567890',
      customer: {
        id: 'cus_1234567890',
        email: 'customer@example.com',
        name: 'John Doe'
      },
      error: {
        code: 'payment_failed',
        message: 'Payment could not be processed'
      }
    }
  }, null, 2),
  'subscription.created': JSON.stringify({
    event: 'subscription.created',
    data: {
      id: 'sub_1234567890',
      customer: {
        id: 'cus_1234567890',
        email: 'customer@example.com'
      },
      plan: {
        id: 'plan_1234567890',
        name: 'Basic Plan',
        amount: 10000,
        interval: 'monthly'
      },
      status: 'active',
      start_date: new Date().toISOString(),
      next_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  }, null, 2),
  'custom': JSON.stringify({
    event: 'custom.event',
    data: {
      message: 'Custom webhook payload',
      timestamp: new Date().toISOString()
    }
  }, null, 2)
};

export function WebhookTestBuilder({ onSendTest, loading }: WebhookTestBuilderProps) {
  const [eventType, setEventType] = useState<string>('payment.success');
  const [payload, setPayload] = useState<string>(DEFAULT_PAYLOADS['payment.success']);
  const [customHeaderKey, setCustomHeaderKey] = useState('');
  const [customHeaderValue, setCustomHeaderValue] = useState('');
  const [headers, setHeaders] = useState<Record<string, string>>({
    'Content-Type': 'application/json',
    'X-Webhook-Source': 'test-builder'
  });
  const [simulateDelay, setSimulateDelay] = useState<number | undefined>(undefined);
  const [simulateError, setSimulateError] = useState(false);
  const [errorStatusCode, setErrorStatusCode] = useState(500);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleEventTypeChange = (value: string | null) => {
    if (value) {
      setEventType(value);
      setPayload(DEFAULT_PAYLOADS[value] || DEFAULT_PAYLOADS['custom']);
      setValidationError(null);
    }
  };

  const validatePayload = (value: string): boolean => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  };

  const handlePayloadChange = (value: string) => {
    setPayload(value);
    if (!validatePayload(value)) {
      setValidationError('Invalid JSON format');
    } else {
      setValidationError(null);
    }
  };

  const addHeader = () => {
    if (customHeaderKey && customHeaderValue) {
      setHeaders({ ...headers, [customHeaderKey]: customHeaderValue });
      setCustomHeaderKey('');
      setCustomHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...headers };
    delete newHeaders[key];
    setHeaders(newHeaders);
  };

  const handleSendTest = () => {
    if (!validatePayload(payload)) {
      setValidationError('Invalid JSON format');
      return;
    }

    const testData: WebhookTestData = {
      eventType,
      payload,
      headers,
      simulateDelay,
      simulateError,
      errorStatusCode: simulateError ? errorStatusCode : undefined
    };

    onSendTest(testData);
  };

  return (
    <Card withBorder shadow="sm" p="lg">
      <Stack gap="md">
        <Group gap="xs">
          <IconSend size={20} className="text-blue-500" />
          <Text size="lg" fw={600}>
            Test Webhook
          </Text>
        </Group>

        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Event Type
          </Text>
          <Select
            data={EVENT_TYPES}
            value={eventType}
            onChange={handleEventTypeChange}
            placeholder="Select event type"
          />
        </Stack>

        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              Payload
            </Text>
            <Badge color="gray" variant="light" size="sm">
              JSON
            </Badge>
          </Group>
          <Textarea
            value={payload}
            onChange={(e) => handlePayloadChange(e.currentTarget.value)}
            placeholder="Enter webhook payload (JSON)"
            minRows={8}
            styles={{ input: { fontFamily: 'monospace' } }}
            error={validationError}
          />
          {validationError && (
            <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
              {validationError}
            </Alert>
          )}
        </Stack>

        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Headers
          </Text>
          <Stack gap="xs">
            {Object.entries(headers).map(([key, value]) => (
              <Group key={key} gap="xs">
                <Badge variant="outline" size="sm">
                  {key}: {value}
                </Badge>
                <Text 
                  size="xs" 
                  c="red" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => removeHeader(key)}
                >
                  Remove
                </Text>
              </Group>
            ))}
          </Stack>
          <Group gap="xs">
            <TextInput
              placeholder="Header name"
              value={customHeaderKey}
              onChange={(e) => setCustomHeaderKey(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <TextInput
              placeholder="Header value"
              value={customHeaderValue}
              onChange={(e) => setCustomHeaderValue(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button variant="light" onClick={addHeader} disabled={!customHeaderKey || !customHeaderValue}>
              Add
            </Button>
          </Group>
        </Stack>

        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Simulation Options
          </Text>
          <Group gap="md">
            <NumberInput
              label="Simulate Delay (ms)"
              placeholder="e.g., 1000"
              value={simulateDelay}
              onChange={(val) => setSimulateDelay(val === '' ? undefined : Number(val))}
              min={0}
              step={100}
              style={{ flex: 1 }}
            />
            <Switch
              label="Simulate Error"
              checked={simulateError}
              onChange={(e) => setSimulateError(e.currentTarget.checked)}
            />
          </Group>
          {simulateError && (
            <NumberInput
              label="Error Status Code"
              placeholder="e.g., 500"
              value={errorStatusCode}
              onChange={(val) => setErrorStatusCode(val === '' ? 500 : Number(val))}
              min={400}
              max={599}
              step={1}
            />
          )}
        </Stack>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm">
            This will send a test webhook to your configured endpoint. The webhook will be logged and can be viewed in the events log.
          </Text>
        </Alert>

        <Button
          fullWidth
          size="lg"
          leftSection={<IconSend size={20} />}
          onClick={handleSendTest}
          loading={loading}
          disabled={!!validationError}
        >
          Send Test Webhook
        </Button>
      </Stack>
    </Card>
  );
}
