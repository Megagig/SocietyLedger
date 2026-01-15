'use client';

import { Stack, Title, Text, SimpleGrid, Card, Badge } from '@mantine/core';
import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';

interface RelatedPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  readTimeMinutes: number | null;
  category?: {
    id: number;
    name: string;
    slug: string;
    color: string | null;
  };
}

interface RelatedPostsProps {
  posts: RelatedPost[];
}

export function RelatedPosts({ posts }: RelatedPostsProps) {
  if (!posts || posts.length === 0) {
    return null;
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Stack gap="md">
      <Title order={3}>Related Posts</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {posts.map((post) => (
          <Card
            key={post.id}
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            component={Link}
            href={`/blog/${post.slug}`}
            className="hover:shadow-md transition-shadow duration-200 block"
          >
            <Stack gap="xs">
              {post.category && (
                <Badge
                  variant="light"
                  color={post.category.color || 'teal'}
                  size="sm"
                >
                  {post.category.name}
                </Badge>
              )}
              <Text fw={600} size="lg" lineClamp={2} className="hover:text-teal-600 transition-colors">
                {post.title}
              </Text>
              {post.excerpt && (
                <Text size="sm" color="dimmed" lineClamp={2}>
                  {post.excerpt}
                </Text>
              )}
              <Text size="xs" color="dimmed">
                {formatDate(post.publishedAt)}
                {post.readTimeMinutes && ` • ${post.readTimeMinutes} min read`}
              </Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
