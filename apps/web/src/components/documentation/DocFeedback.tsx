'use client';

import { useState } from 'react';
import { Group, Text, Button, Textarea, Stack, Alert, ActionIcon } from '@mantine/core';
import { IconThumbUp, IconThumbDown, IconCheck, IconX } from '@tabler/icons-react';
import { API_ROUTES } from '@/utils/constants';

interface DocFeedbackProps {
  pageId: number;
}

export function DocFeedback({ pageId }: DocFeedbackProps) {
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);
  const [comment, setComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFeedback = async (isHelpful: boolean) => {
    setFeedback(isHelpful ? 'helpful' : 'not-helpful');
    setShowCommentBox(true);
    setSubmitted(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!feedback) return;

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(API_ROUTES.DOCUMENTATION.PAGE_FEEDBACK(pageId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          isHelpful: feedback === 'helpful',
          comment: comment.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(true);
      setShowCommentBox(false);
      setComment('');
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFeedback(null);
    setShowCommentBox(false);
    setComment('');
    setSubmitted(false);
    setError(null);
  };

  if (submitted) {
    return (
      <Alert
        icon={<IconCheck size={20} />}
        color="teal"
        variant="light"
        radius="md"
      >
        <Text size="sm">Thank you for your feedback!</Text>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Text size="sm" fw={500} c="dimmed">
        Was this page helpful?
      </Text>

      {!feedback ? (
        <Group gap="xs">
          <Button
            variant="light"
            color="teal"
            size="xs"
            leftSection={<IconThumbUp size={16} />}
            onClick={() => handleFeedback(true)}
          >
            Yes
          </Button>
          <Button
            variant="light"
            color="red"
            size="xs"
            leftSection={<IconThumbDown size={16} />}
            onClick={() => handleFeedback(false)}
          >
            No
          </Button>
        </Group>
      ) : (
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c={feedback === 'helpful' ? 'teal' : 'red'}>
              {feedback === 'helpful' ? '👍 You found this helpful' : '👎 You found this not helpful'}
            </Text>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={handleReset}
            >
              <IconX size={14} />
            </ActionIcon>
          </Group>

          {showCommentBox && (
            <Stack gap="xs">
              <Textarea
                placeholder="Optional: Tell us more (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                size="xs"
                minRows={2}
                maxRows={4}
              />
              <Group gap="xs">
                <Button
                  size="xs"
                  onClick={handleSubmit}
                  loading={loading}
                  variant="filled"
                  color="teal"
                >
                  Submit Feedback
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => setShowCommentBox(false)}
                >
                  Cancel
                </Button>
              </Group>
            </Stack>
          )}

          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}
        </Stack>
      )}
    </Stack>
  );
}
