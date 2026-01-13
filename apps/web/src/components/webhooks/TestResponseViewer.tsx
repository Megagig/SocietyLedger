'use client';

import { 
  Card, 
  Stack, 
  Text, 
  Badge, 
  Group, 
  Code,
  ActionIcon,
  Tooltip,
  UnstyledButton,
  Box
} from '@mantine/core';
import { 
  IconCheck, 
  IconX, 
  IconClock,
  IconCopy,
  IconCode,
  IconFileText
} from '@tabler/icons-react';
import { useState } from 'react';

interface TestResponseViewerProps {
  response?: {
    status: 'success' | 'error' | 'pending';
    statusCode?: number;
    duration?: number;
    timestamp?: string;
    data?: any;
    headers?: Record<string, string>;
    error?: string;
  };
  loading?: boolean;
}

export function TestResponseViewer({ response, loading }: TestResponseViewerProps) {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (response?.data) {
      const content = JSON.stringify(response.data, null, 2);
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <Card withBorder shadow="sm" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="lg" fw={600}>
              Response
            </Text>
            <Badge color="blue" variant="light">
              Loading...
            </Badge>
          </Group>
          <Box py="xl">
            <Text ta="center" c="dimmed">
              Waiting for response...
            </Text>
          </Box>
        </Stack>
      </Card>
    );
  }

  if (!response) {
    return (
      <Card withBorder shadow="sm" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="lg" fw={600}>
              Response
            </Text>
            <Badge color="gray" variant="light">
              No response yet
            </Badge>
          </Group>
          <Box py="xl">
            <Text ta="center" c="dimmed">
              Send a test webhook to see the response here
            </Text>
          </Box>
        </Stack>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (response.status) {
      case 'success':
        return <IconCheck size={20} className="text-green-500" />;
      case 'error':
        return <IconX size={20} className="text-red-500" />;
      case 'pending':
        return <IconClock size={20} className="text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    switch (response.status) {
      case 'success':
        return 'green';
      case 'error':
        return 'red';
      case 'pending':
        return 'blue';
    }
  };

  return (
    <Card withBorder shadow="sm" p="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            {getStatusIcon()}
            <Text size="lg" fw={600}>
              Response
            </Text>
          </Group>
          <Group gap="xs">
            <Badge color={getStatusColor()} variant="light" size="lg">
              {response.status.toUpperCase()}
            </Badge>
            {response.statusCode && (
              <Badge color={getStatusColor()} variant="outline">
                {response.statusCode}
              </Badge>
            )}
          </Group>
        </Group>

        <Stack gap="xs">
          {response.duration && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">Duration:</Text>
              <Text size="sm" fw={500}>{response.duration}ms</Text>
            </Group>
          )}
          {response.timestamp && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">Timestamp:</Text>
              <Text size="sm">{new Date(response.timestamp).toLocaleString()}</Text>
            </Group>
          )}
        </Stack>

        {response.error && (
          <Card withBorder p="md" bg="red.0">
            <Group gap="xs">
              <IconX size={16} className="text-red-500" />
              <Text size="sm" c="red" fw={500}>
                Error: {response.error}
              </Text>
            </Group>
          </Card>
        )}

        {response.headers && Object.keys(response.headers).length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">
              Headers
            </Text>
            <Card withBorder p="sm">
              <Code block bg="gray.0">
                {JSON.stringify(response.headers, null, 2)}
              </Code>
            </Card>
          </Stack>
        )}

        {response.data && (
          <Stack gap="xs">
            <Group justify="space-between">
              <Group gap="xs">
                <IconCode size={16} />
                <Text size="sm" fw={500} c="dimmed">
                  Response Body
                </Text>
              </Group>
              <Group gap="xs">
                <UnstyledButton
                  onClick={() => setViewMode('formatted')}
                  className={`px-3 py-1 rounded text-sm ${viewMode === 'formatted' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                >
                  <IconFileText size={16} />
                </UnstyledButton>
                <Tooltip label={copied ? 'Copied!' : 'Copy'}>
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={handleCopy}
                  >
                    <IconCopy size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <Card withBorder p="sm">
              <Code block bg="gray.0">
                {viewMode === 'formatted' 
                  ? JSON.stringify(response.data, null, 2)
                  : JSON.stringify(response.data)
                }
              </Code>
            </Card>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
