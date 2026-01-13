'use client';

import { useState } from 'react';
import { 
  Card, 
  Text, 
  Group, 
  Button, 
  Code, 
  Collapse,
  Box,
  UnstyledButton
} from '@mantine/core';
import { 
  IconChevronDown, 
  IconChevronRight, 
  IconCopy, 
  IconEye, 
  IconEyeOff 
} from '@tabler/icons-react';

interface EventPayloadViewerProps {
  payload: any;
  maxHeight?: string;
}

export function EventPayloadViewer({ payload, maxHeight = '400px' }: EventPayloadViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPretty, setIsPretty] = useState(true);

  const jsonString = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const prettyJson = JSON.stringify(JSON.parse(jsonString), null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
  };

  return (
    <Card withBorder shadow="sm" p="0">
      <Group justify="space-between" p="sm" bg="gray-0 dark:bg-gray-800">
        <Text size="sm" fw={500} c="gray.700 dark:gray.300">
          Event Payload
        </Text>
        <Group gap="xs">
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setIsPretty(!isPretty)}
            leftSection={isPretty ? <IconEyeOff size={14} /> : <IconEye size={14} />}
          >
            {isPretty ? 'Raw' : 'Pretty'}
          </Button>
          <Button
            size="xs"
            variant="subtle"
            onClick={handleCopy}
            leftSection={<IconCopy size={14} />}
          >
            Copy
          </Button>
          <UnstyledButton
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </UnstyledButton>
        </Group>
      </Group>

      <Collapse in={isExpanded}>
        <Box p="md" style={{ maxHeight, overflow: 'auto' }}>
          <Code
            block
            style={{
              fontSize: '12px',
              lineHeight: '1.5',
            }}
          >
            {isPretty ? prettyJson : jsonString}
          </Code>
        </Box>
      </Collapse>
    </Card>
  );
}
