'use client';

import { Stack } from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { BlogPostForm } from '@/components/forms/BlogPostForm';

export default function NewBlogPostPage() {
  return (
    <Stack gap="xl">
      <PageHeader title="New post" description="Create a new blog post" />
      <BlogPostForm />
    </Stack>
  );
}
