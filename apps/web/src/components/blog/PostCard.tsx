'use client';

import { Card, Text, Badge, Group, Stack, AspectRatio, Image, Anchor } from '@mantine/core';
import { IconCalendar, IconClock, IconEye } from '@tabler/icons-react';
import Link from 'next/link';
import { CategoryBadge } from './CategoryBadge';
import { TagList } from './TagList';
import { PostMeta } from './PostMeta';

interface PostCardProps {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  readTimeMinutes: number | null;
  viewCount: number;
  category?: {
    id: number;
    name: string;
    slug: string;
    color: string | null;
  };
  tags?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  showFullContent?: boolean;
}

export function PostCard({
  id,
  title,
  slug,
  excerpt,
  coverImage,
  publishedAt,
  readTimeMinutes,
  viewCount,
  category,
  tags,
  showFullContent = false,
}: PostCardProps) {
  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      component={Link}
      href={`/blog/${slug}`}
      className="hover:shadow-md transition-shadow duration-200 block"
    >
      {coverImage && (
        <AspectRatio ratio={16 / 9} mb="md">
          <Image
            src={coverImage}
            alt={title}
            fit="cover"
            className="rounded-md"
          />
        </AspectRatio>
      )}

      <Stack gap="xs">
        {category && <CategoryBadge category={category} />}

        <Text fw={700} size="xl" lineClamp={2} className="hover:text-teal-600 transition-colors">
          {title}
        </Text>

        {excerpt && (
          <Text size="sm" color="dimmed" lineClamp={3}>
            {excerpt}
          </Text>
        )}

        <PostMeta
          publishedAt={publishedAt}
          readTimeMinutes={readTimeMinutes}
          viewCount={viewCount}
        />

        {tags && tags.length > 0 && <TagList tags={tags} />}
      </Stack>
    </Card>
  );
}
