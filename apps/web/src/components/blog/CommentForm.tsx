'use client';

import { useState } from 'react';
import { Stack, Textarea, Button, Group, Text, Paper, TextInput } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';

interface CommentFormProps {
  postId: number;
  isAuthenticated: boolean;
  currentUser?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  onSubmit: (content: string, parentId?: number) => Promise<void>;
}

export function CommentForm({
  postId,
  isAuthenticated,
  currentUser,
  onSubmit,
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      await onSubmit(content);
      setContent('');
      setGuestName('');
      setGuestEmail('');
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            {isAuthenticated
              ? `Commenting as ${currentUser?.firstName || currentUser?.email}`
              : 'Leave a comment'}
          </Text>

          {!isAuthenticated && (
            <Group grow>
              <TextInput
                placeholder="Your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                size="sm"
              />
              <TextInput
                type="email"
                placeholder="Your email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                required
                size="sm"
              />
            </Group>
          )}

          <Textarea
            placeholder="Write your comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            minRows={3}
            maxRows={6}
            required
            size="sm"
          />

          <Group justify="flex-end">
            <Button
              type="submit"
              size="sm"
              loading={loading}
              disabled={!content.trim()}
              rightSection={<IconSend size={16} />}
            >
              Post Comment
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
