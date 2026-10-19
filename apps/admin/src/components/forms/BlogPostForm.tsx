'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  Stack, Group, Button, TextInput, Textarea, Select, MultiSelect, Card,
} from '@mantine/core';
import { bff } from '@/lib/bff';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlogCategory {
  id: number;
  name: string;
}

interface BlogTag {
  id: number;
  name: string;
}

export interface BlogPostFormValues {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  categoryId: string | null;
  tagIds: string[];
}

const EMPTY_VALUES: BlogPostFormValues = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: '',
  status: 'DRAFT',
  categoryId: null,
  tagIds: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}

function toRequestBody(values: BlogPostFormValues) {
  return {
    title: values.title,
    slug: values.slug,
    excerpt: values.excerpt || undefined,
    content: values.content,
    coverImage: values.coverImage || undefined,
    status: values.status,
    categoryId: values.categoryId ? Number(values.categoryId) : undefined,
    tagIds: values.tagIds.map(Number),
  };
}

// ── Form ─────────────────────────────────────────────────────────────────────

export function BlogPostForm({ postId }: { postId?: number }) {
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = postId !== undefined;

  const [values, setValues] = useState<BlogPostFormValues>(EMPTY_VALUES);
  const [slugTouched, setSlugTouched] = useState(false);

  const catsQ = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => bff<BlogCategory[]>('admin/blog/categories'),
  });

  const tagsQ = useQuery({
    queryKey: ['blog-tags'],
    queryFn: () => bff<BlogTag[]>('admin/blog/tags'),
  });

  const postQ = useQuery({
    queryKey: ['blog-post', postId],
    queryFn: () => bff<{
      title: string; slug: string; excerpt: string | null; content: string;
      coverImage: string | null; status: BlogPostFormValues['status'];
      categoryId: number | null; tags: { tag: { id: number } }[];
    }>(`admin/blog/posts/${postId}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (postQ.data) {
      setValues({
        title: postQ.data.title,
        slug: postQ.data.slug,
        excerpt: postQ.data.excerpt ?? '',
        content: postQ.data.content,
        coverImage: postQ.data.coverImage ?? '',
        status: postQ.data.status,
        categoryId: postQ.data.categoryId ? String(postQ.data.categoryId) : null,
        tagIds: postQ.data.tags.map((t) => String(t.tag.id)),
      });
      setSlugTouched(true);
    }
  }, [postQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      isEdit
        ? bff(`admin/blog/posts/${postId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toRequestBody(values)),
          })
        : bff('admin/blog/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toRequestBody(values)),
          }),
    onSuccess: () => {
      notifications.show({ message: isEdit ? 'Post updated' : 'Post created', color: 'green' });
      qc.invalidateQueries({ queryKey: ['blog-posts'] });
      qc.invalidateQueries({ queryKey: ['blog-stats'] });
      router.push('/blog');
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const slugValid = /^[a-z0-9-]+$/.test(values.slug);
  const canSave = values.title.trim().length >= 3
    && slugValid
    && values.slug.length >= 3
    && values.content.trim().length >= 10;

  return (
    <Card
      style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
      p="lg"
      radius="lg"
    >
      <Stack gap="md">
        <TextInput
          label="Title"
          placeholder="e.g. 5 ways to speed up dues collection"
          value={values.title}
          onChange={(e) => {
            const title = e.currentTarget.value;
            setValues((v) => ({
              ...v,
              title,
              slug: slugTouched ? v.slug : slugify(title),
            }));
          }}
          required
        />
        <TextInput
          label="Slug"
          description="Used in the post URL — lowercase letters, numbers, hyphens only"
          placeholder="5-ways-to-speed-up-dues-collection"
          value={values.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setValues((v) => ({ ...v, slug: e.currentTarget.value }));
          }}
          error={values.slug.length > 0 && !slugValid ? 'Only lowercase letters, numbers, and hyphens' : undefined}
          required
        />
        <Textarea
          label="Excerpt"
          description="Short summary shown in post listings"
          placeholder="A brief teaser for this post…"
          value={values.excerpt}
          onChange={(e) => setValues((v) => ({ ...v, excerpt: e.currentTarget.value }))}
          autosize
          minRows={2}
          maxRows={4}
        />
        <Textarea
          label="Content"
          placeholder="Write the post…"
          value={values.content}
          onChange={(e) => setValues((v) => ({ ...v, content: e.currentTarget.value }))}
          autosize
          minRows={10}
          required
        />
        <TextInput
          label="Cover image URL"
          placeholder="https://…"
          value={values.coverImage}
          onChange={(e) => setValues((v) => ({ ...v, coverImage: e.currentTarget.value }))}
        />
        <Group grow>
          <Select
            label="Status"
            value={values.status}
            onChange={(val) => setValues((v) => ({ ...v, status: (val as BlogPostFormValues['status']) ?? 'DRAFT' }))}
            data={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]}
            allowDeselect={false}
          />
          <Select
            label="Category"
            placeholder="None"
            value={values.categoryId}
            onChange={(val) => setValues((v) => ({ ...v, categoryId: val }))}
            data={(catsQ.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
            clearable
          />
        </Group>
        <MultiSelect
          label="Tags"
          placeholder="Select tags"
          value={values.tagIds}
          onChange={(val) => setValues((v) => ({ ...v, tagIds: val }))}
          data={(tagsQ.data ?? []).map((t) => ({ value: String(t.id), label: t.name }))}
          searchable
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => router.push('/blog')} disabled={saveMut.isPending}>
            Cancel
          </Button>
          <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} disabled={!canSave}>
            {isEdit ? 'Save changes' : 'Create post'}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
