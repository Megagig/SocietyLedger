'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  TextInput,
  Textarea,
  Select,
  Group,
  Button,
  Text,
  Badge,
  Box,
} from '@mantine/core';
import { IconVariable, IconTemplate, IconCheck, IconX } from '@tabler/icons-react';
import { SMSTemplate } from '@/lib/api/sms';

interface TemplateEditorProps {
  template?: SMSTemplate;
  onSave: (template: { name: string; category: string; message: string }) => void;
  onCancel?: () => void;
  loading?: boolean;
}

const TEMPLATE_CATEGORIES = [
  'General',
  'Payment Reminder',
  'Meeting',
  'Dues',
  'Levy',
  'Welfare',
  'Election',
  'Custom',
] as const;

export function TemplateEditor({ template, onSave, onCancel, loading = false }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [category, setCategory] = useState(template?.category || 'General');
  const [message, setMessage] = useState(template?.message || '');

  // Extract variables from message
  const variables = message.match(/\{\{(\w+)\}\}/g)?.map(v => v.slice(2, -2)) || [];

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }

    if (!message.trim()) {
      return;
    }

    onSave({
      name: name.trim(),
      category,
      message: message.trim(),
    });
  };

  const handleVariableInsert = (variable: string) => {
    const textarea = document.getElementById('template-message-textarea') as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = `{${variable}}`;

    const updatedMessage =
      message.substring(0, start) + newText + message.substring(end);

    setMessage(updatedMessage);

    // Restore cursor position after variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  };

  return (
    <Card padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="lg" fw={600}>
            {template ? 'Edit Template' : 'Create New Template'}
          </Text>
          {onCancel && (
            <Button variant="subtle" onClick={onCancel}>
              <IconX size={18} />
            </Button>
          )}
        </Group>

        <TextInput
          label="Template Name"
          placeholder="e.g., Monthly Dues Reminder"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
          size="md"
        />

        <Select
          label="Category"
          placeholder="Select category"
          data={TEMPLATE_CATEGORIES}
          value={category}
          onChange={(value) => setCategory(value as any)}
          size="md"
        />

        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={500}>Message</Text>
            {variables.length > 0 && (
              <Badge variant="light" color="blue">
                {variables.length} variable{variables.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </Group>

          <Textarea
            id="template-message-textarea"
            value={message}
            onChange={(e) => setMessage(e.currentTarget.value)}
            placeholder="Type your message here... Use {name}, {amount}, {due_date} as variables"
            minRows={6}
            maxRows={12}
            autosize
            required
          />
        </Stack>

        {/* Quick Variables */}
        <Box>
          <Text size="sm" fw={500} mb="xs">Quick Variables</Text>
          <Group gap="xs">
            {['name', 'amount', 'due_date', 'association'].map((variable) => (
              <Badge
                key={variable}
                variant="outline"
                size="lg"
                style={{ cursor: 'pointer' }}
                onClick={() => handleVariableInsert(variable)}
              >
                {`{${variable}}`}
              </Badge>
            ))}
          </Group>
        </Box>

        {/* Preview */}
        {message && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Preview</Text>
            <Box
              p="md"
              bg="gray.0"
              style={{
                borderRadius: 8,
                minHeight: 80,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <Text size="sm" c="dimmed">
                {message}
              </Text>
            </Box>
          </Box>
        )}

        {/* Tips */}
        <Box>
          <Text size="sm" fw={500} mb="xs">Tips</Text>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              • Variables allow you to personalize messages when sending
            </Text>
            <Text size="sm" c="dimmed">
              • Use descriptive template names for easy identification
            </Text>
            <Text size="sm" c="dimmed">
              • Templates save time and ensure consistency
            </Text>
          </Stack>
        </Box>

        <Group justify="flex-end">
          <Button
            variant="light"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            leftSection={<IconTemplate size={18} />}
            onClick={handleSave}
            loading={loading}
            disabled={!name.trim() || !message.trim()}
          >
            {template ? 'Update Template' : 'Save Template'}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
