'use client';

import { 
  Stack, 
  Title, 
  Text, 
  Group, 
  SimpleGrid,
  Card,
  Alert
} from '@mantine/core';
import {
  IconInfoCircle,
  IconAlertTriangle
} from '@tabler/icons-react';
import { useState } from 'react';
import { webhooksApi } from '@/lib/api/webhooks';
import { WebhookTestBuilder, WebhookTestData } from '@/components/webhooks/WebhookTestBuilder';
import { TestResponseViewer } from '@/components/webhooks/TestResponseViewer';
import { notifications } from '@mantine/notifications';

export default function WebhooksTestPage() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendTest = async (testData: WebhookTestData) => {
    try {
      setLoading(true);
      setError(null);
      setResponse(null);

      const apiData = {
        eventType: testData.eventType,
        payload: JSON.parse(testData.payload),
        headers: testData.headers,
        simulateDelay: testData.simulateDelay,
        simulateError: testData.simulateError,
        errorStatusCode: testData.errorStatusCode
      };

      const result = await webhooksApi.testWebhook(apiData);
      
      setResponse({
        status: result.success ? 'success' : 'error',
        statusCode: result.responseCode,
        duration: result.responseTime,
        timestamp: new Date().toISOString(),
        data: result.responseBody,
        error: result.error
      });

      notifications.show({
        title: result.success ? 'Test Successful' : 'Test Failed',
        message: result.success 
          ? 'Webhook test completed successfully'
          : result.error || 'Webhook test failed',
        color: result.success ? 'green' : 'red'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send test webhook';
      setError(errorMessage);
      setResponse({
        status: 'error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        error: errorMessage
      });
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Test Webhooks</Title>
          <Text c="dimmed">Send test webhooks to verify your configuration</Text>
        </div>
      </Group>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        <Text size="sm">
          Use this page to test webhook configurations. Test webhooks will be logged and can be viewed in the events log.
          They will not trigger any actual business logic or affect your data.
        </Text>
      </Alert>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <WebhookTestBuilder 
          onSendTest={handleSendTest}
          loading={loading}
        />
        
        <TestResponseViewer 
          response={response}
          loading={loading}
        />
      </SimpleGrid>

      {error && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
          <Text size="sm">{error}</Text>
        </Alert>
      )}

      <Card withBorder p="md">
        <Stack gap="md">
          <Text size="md" fw={600}>
            Testing Tips
          </Text>
          <Stack gap="xs">
            <Text size="sm">• Use different event types to test various webhook scenarios</Text>
            <Text size="sm">• Simulate errors to test your error handling</Text>
            <Text size="sm">• Add delays to test timeout handling</Text>
            <Text size="sm">• Check the events log after sending tests to see the full details</Text>
            <Text size="sm">• Test webhooks are marked with a special flag to distinguish them from real events</Text>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
