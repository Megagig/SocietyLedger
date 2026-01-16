'use client';

import { useState } from 'react';
import { Stack, Text, Group, Avatar, Button, Paper, Collapse, Badge } from '@mantine/core';
import { IconMessageCircle, IconChevronDown, IconChevronUp } from '@tabler/icons-react';

interface Comment {
  id: number;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'SPAM';
  createdAt: Date;
  author?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  guestName?: string;
  guestEmail?: string;
  parentId?: number;
}

interface CommentItemProps {
  comment: Comment;
  replies?: Comment[];
  isAuthenticated: boolean;
  currentUser?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  onReply: (content: string) => Promise<void>;
}

export function CommentItem({
  comment,
  replies = [],
  isAuthenticated,
  currentUser,
  onReply,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const getAuthorName = () => {
    if (comment.author) {
      return `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || comment.author.email;
    }
    return comment.guestName || 'Anonymous';
  };

  const getInitials = () => {
    const name = getAuthorName();
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    setLoading(true);
    try {
      await onReply(replyContent);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="sm">
      <Paper withBorder p="md" radius="md" bg="gray.0">
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Avatar size="sm" radius="xl" color="teal">
                {getInitials()}
              </Avatar>
              <div>
                <Text size="sm" fw={500}>
                  {getAuthorName()}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatDate(comment.createdAt)}
                </Text>
              </div>
            </Group>
          </Group>

          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {comment.content}
          </Text>

          <Group gap="xs">
            {replies.length > 0 && (
              <Button
                variant="subtle"
                size="xs"
                leftSection={showReplies ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                onClick={() => setShowReplies(!showReplies)}
              >
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </Button>
            )}
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconMessageCircle size={14} />}
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              Reply
            </Button>
          </Group>
        </Stack>
      </Paper>

      {showReplyForm && (
        <Paper withBorder p="md" radius="md" ml="xl">
          <form onSubmit={handleReplySubmit}>
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                {isAuthenticated
                  ? `Replying as ${currentUser?.firstName || currentUser?.email}`
                  : 'Leave a reply'}
              </Text>
              <textarea
                placeholder="Write your reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="mantine-TextInput-input mantine-Input-input"
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.5rem',
                  borderRadius: '0.25rem',
                  border: '1px solid #e9ecef',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                }}
                required
              />
              <Group justify="flex-end">
                <Button
                  type="submit"
                  size="xs"
                  loading={loading}
                  disabled={!replyContent.trim()}
                >
                  Post Reply
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      )}

      {replies.length > 0 && (
        <Collapse in={showReplies}>
          <Stack gap="sm" ml="xl">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                isAuthenticated={isAuthenticated}
                currentUser={currentUser}
                onReply={onReply}
              />
            ))}
          </Stack>
        </Collapse>
      )}
    </Stack>
  );
}
