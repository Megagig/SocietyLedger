'use client';

import { Group, Text } from '@mantine/core';
import { IconCalendar, IconClock, IconEye } from '@tabler/icons-react';

interface PostMetaProps {
  publishedAt: Date | null;
  readTimeMinutes: number | null;
  viewCount: number;
}

export function PostMeta({ publishedAt, readTimeMinutes, viewCount }: PostMetaProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Group gap="md" wrap="wrap">
      {publishedAt && (
        <Group gap="xs">
          <IconCalendar size={16} />
          <Text size="sm" color="dimmed">
            {formatDate(publishedAt)}
          </Text>
        </Group>
      )}

      {readTimeMinutes && (
        <Group gap="xs">
          <IconClock size={16} />
          <Text size="sm" color="dimmed">
            {readTimeMinutes} min read
          </Text>
        </Group>
      )}

      <Group gap="xs">
        <IconEye size={16} />
        <Text size="sm" color="dimmed">
          {viewCount} views
        </Text>
      </Group>
    </Group>
  );
}
