'use client';

import { useParams } from 'next/navigation';
import { Stack } from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { BlogPostForm } from '@/components/forms/BlogPostForm';

export default function EditBlogPostPage() {
  const params = useParams<{ id: string }>();

  return (
    <Stack gap="xl">
      <PageHeader title="Edit post" description="Update this blog post" />
      <BlogPostForm postId={Number(params.id)} />
    </Stack>
  );
}
