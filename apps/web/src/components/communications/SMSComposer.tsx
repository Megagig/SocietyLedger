'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Textarea,
  Text,
  Badge,
  Group,
  Select,
  Button,
  Stack,
  Alert,
  Box,
} from '@mantine/core';
import { IconInfoCircle, IconTemplate, IconSend } from '@tabler/icons-react';
import { SMSTemplate } from '@/lib/api/sms';

interface SMSComposerProps {
  message: string;
  onMessageChange: (message: string) => void;
  templates?: SMSTemplate[];
  selectedTemplate?: SMSTemplate;
  onTemplateSelect?: (template: SMSTemplate) => void;
  onSend?: () => void;
  sending?: boolean;
  disabled?: boolean;
  maxSegments?: number;
}

const SMS_SEGMENT_LENGTH = 160;
const GSM7_SPECIAL_CHARS = '^{}\\[~]|\n';

export function SMSComposer({
  message,
  onMessageChange,
  templates = [],
  selectedTemplate,
  onTemplateSelect,
  onSend,
  sending = false,
  disabled = false,
  maxSegments = 10,
}: SMSComposerProps) {
  const [preview, setPreview] = useState('');

  // Calculate SMS segments
  const calculateSegments = (text: string): number => {
    if (!text) return 0;

    // Check for special characters that require UCS-2 encoding
    const hasSpecialChars = GSM7_SPECIAL_CHARS.split('|').some(char => text.includes(char));

    if (hasSpecialChars) {
      // UCS-2 encoding: 70 chars per segment
      return Math.ceil(text.length / 67);
    }

    // GSM-7 encoding: 160 chars per segment
    return Math.ceil(text.length / SMS_SEGMENT_LENGTH);
  };

  const segments = calculateSegments(message);
  const remainingChars = segments === 0
    ? SMS_SEGMENT_LENGTH
    : (segments * SMS_SEGMENT_LENGTH) - message.length;

  const isOverLimit = segments > maxSegments;

  // Extract variables from message (e.g., {{name}}, {{amount}})
  const variables = message.match(/\{\{(\w+)\}\}/g)?.map(v => v.slice(2, -2)) || [];

  // Update preview when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setPreview(selectedTemplate.content);
    } else {
      setPreview(message);
    }
  }, [selectedTemplate, message]);

  const handleTemplateChange = (templateId: string | null) => {
    if (templateId && onTemplateSelect) {
      const template = templates.find(t => t.id === parseInt(templateId));
      if (template) {
        onTemplateSelect(template);
        onMessageChange(template.content);
      }
    }
  };

  const handleVariableInsert = (variable: string) => {
    const textarea = document.getElementById('sms-composer-textarea') as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = `{{${variable}}}`;

    const updatedMessage =
      message.substring(0, start) + newText + message.substring(end);

    onMessageChange(updatedMessage);

    // Restore cursor position after variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  };

  return (
    <Card padding="lg" radius="md" withBorder>
      <Stack gap="md">
        {/* Template Selection */}
        {templates.length > 0 && (
          <Select
            label="Use Template"
            placeholder="Select a template..."
            leftSection={<IconTemplate size={16} />}
            data={templates.map((t) => ({
              value: t.id.toString(),
              label: t.name,
              group: t.category,
            }))}
            value={selectedTemplate?.id.toString() || null}
            onChange={handleTemplateChange}
            clearable
            searchable
          />
        )}

        {/* Message Input */}
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>Message</Text>
            <Badge
              variant={isOverLimit ? 'filled' : 'light'}
              color={isOverLimit ? 'red' : 'blue'}
            >
              {segments} / {maxSegments} segments
            </Badge>
          </Group>

          <Textarea
            id="sms-composer-textarea"
            value={message}
            onChange={(e) => onMessageChange(e.currentTarget.value)}
            placeholder="Type your message here..."
            minRows={6}
            maxRows={12}
            autosize
            disabled={disabled}
            error={isOverLimit ? `Message exceeds ${maxSegments} segments` : undefined}
          />

          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {remainingChars} characters remaining
            </Text>
            <Text size="xs" c={isOverLimit ? 'red' : 'dimmed'}>
              {message.length} / {segments * SMS_SEGMENT_LENGTH}
            </Text>
          </Group>
        </Stack>

        {/* Variables Helper */}
        {variables.length > 0 && (
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            <Text size="sm">
              Variables detected: {variables.map((v, i) => (
                <Badge
                  key={v}
                  size="xs"
                  variant="filled"
                  color="blue"
                  style={{ margin: '0 4px', cursor: 'pointer' }}
                  onClick={() => handleVariableInsert(v)}
                >
                  {v}
                </Badge>
              ))}
            </Text>
          </Alert>
        )}

        {/* Quick Variables */}
        <Box>
          <Text size="sm" fw={500} mb="xs">
            Quick Variables
          </Text>
          <Group gap="xs">
            {['name', 'amount', 'due_date', 'association'].map((variable) => (
              <Badge
                key={variable}
                variant="outline"
                size="lg"
                style={{ cursor: 'pointer' }}
                onClick={() => handleVariableInsert(variable)}
              >
                {'{{' + variable + '}}'}
              </Badge>
            ))}
          </Group>
        </Box>

        {/* Preview */}
        {message && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Preview</Text>
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
                {preview || 'Your message will appear here...'}
              </Text>
            </Box>
          </Stack>
        )}

        {/* Send Button */}
        {onSend && (
          <Button
            leftSection={<IconSend size={18} />}
            onClick={onSend}
            loading={sending}
            disabled={disabled || !message.trim() || isOverLimit}
            fullWidth
            size="lg"
          >
            Send Message
          </Button>
        )}
      </Stack>
    </Card>
  );
}
