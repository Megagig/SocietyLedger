'use client';

import { Group, Badge } from '@mantine/core';
import Link from 'next/link';

interface TagListProps {
  tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
}

export function TagList({ tags }: TagListProps) {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <Group gap="xs" wrap="wrap">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          component={Link}
          href={`/blog/tag/${tag.slug}`}
          variant="outline"
          size="sm"
          className="hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:border-teal-500 transition-colors"
        >
          #{tag.name}
        </Badge>
      ))}
    </Group>
  );
}
