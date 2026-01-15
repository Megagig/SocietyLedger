'use client';

import { Stack, Text, Divider, Alert, Group } from '@mantine/core';
import { IconMessageCircle } from '@tabler/icons-react';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

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
  replies?: Comment[];
}

interface CommentSectionProps {
  postId: number;
  comments: Comment[];
  isAuthenticated: boolean;
  currentUser?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  onCommentSubmit: (content: string, parentId?: number) => Promise<void>;
}

export function CommentSection({
  postId,
  comments,
  isAuthenticated,
  currentUser,
  onCommentSubmit,
}: CommentSectionProps) {
  const approvedComments = comments.filter(c => c.status === 'APPROVED');
  const topLevelComments = approvedComments.filter(c => !c.parentId);

  const getReplies = (commentId: number) => {
    return approvedComments.filter(c => c.parentId === commentId);
  };

  if (approvedComments.length === 0) {
    return (
      <Stack gap="lg">
        <Divider label={<Text fw={500}>Comments</Text>} labelPosition="left" />
        <Alert
          icon={<IconMessageCircle size={20} />}
          title="No comments yet"
          color="gray"
          variant="light"
        >
          Be the first to share your thoughts on this post!
        </Alert>
        <CommentForm
          postId={postId}
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          onSubmit={onCommentSubmit}
        />
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Divider
        label={
          <Group gap="xs">
            <IconMessageCircle size={20} />
            <Text fw={500}>Comments ({approvedComments.length})</Text>
          </Group>
        }
        labelPosition="left"
      />

      <Stack gap="md">
        {topLevelComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={getReplies(comment.id)}
            isAuthenticated={isAuthenticated}
            currentUser={currentUser}
            onReply={(content) => onCommentSubmit(content, comment.id)}
          />
        ))}
      </Stack>

      <CommentForm
        postId={postId}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        onSubmit={onCommentSubmit}
      />
    </Stack>
  );
}
