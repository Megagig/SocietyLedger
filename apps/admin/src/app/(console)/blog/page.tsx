'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  Stack, SimpleGrid, Group, Text, Button, Badge, Pagination,
  Skeleton, Modal, TextInput, Textarea, Select, Anchor,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconEye, IconFileText } from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DataTable } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  author: { firstName: string | null; lastName: string | null; email: string } | null;
  category: { id: number; name: string; slug: string } | null;
}

interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  _count: { posts: number };
}

interface BlogPostsResponse {
  posts: BlogPost[];
  total: number;
  totalPages: number;
}

interface BlogStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalViews: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR = { PUBLISHED: 'green', DRAFT: 'yellow', ARCHIVED: 'gray' } as const;

function authorName(author: BlogPost['author']) {
  if (!author) return '—';
  const name = [author.firstName, author.lastName].filter(Boolean).join(' ');
  return name || author.email;
}

// ── New category modal ─────────────────────────────────────────────────────────

function NewCategoryModal({ opened, onClose, onCreated }: {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');

  const mut = useMutation({
    mutationFn: () => bff('admin/blog/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      }),
    }),
    onSuccess: () => {
      notifications.show({ message: 'Category created', color: 'green' });
      setName('');
      onClose();
      onCreated();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="New category" size="sm" centered>
      <Stack gap="md">
        <TextInput
          label="Name"
          placeholder="e.g. Feature Updates"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
          size="sm"
        />
        <Group justify="flex-end">
          <Button variant="default" size="sm" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button size="sm" loading={mut.isPending} disabled={!name.trim()} onClick={() => mut.mutate()}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [status, setStatus] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [catModalOpened, { open: openCatModal, close: closeCatModal }] = useDisclosure(false);

  const statsQ = useQuery({
    queryKey: ['blog-stats'],
    queryFn: () => bff<BlogStats>('admin/blog/stats'),
  });

  const catsQ = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => bff<BlogCategory[]>('admin/blog/categories'),
  });

  const postsQ = useQuery({
    queryKey: ['blog-posts', page, debouncedSearch, status, categoryId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status) params.set('status', status);
      if (categoryId) params.set('categoryId', categoryId);
      return bff<BlogPostsResponse>(`admin/blog/posts?${params}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => bff(`admin/blog/posts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notifications.show({ message: 'Post deleted', color: 'green' });
      qc.invalidateQueries({ queryKey: ['blog-posts'] });
      qc.invalidateQueries({ queryKey: ['blog-stats'] });
      closeDelete();
      setDeleteTarget(null);
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const posts = postsQ.data?.posts ?? [];
  const totalPages = postsQ.data?.totalPages ?? 1;
  const cats = catsQ.data ?? [];
  const stats = statsQ.data;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Blog CMS"
        description="Manage platform blog posts, categories, and content"
        actions={
          <Group gap="sm">
            <Button
              variant="default"
              size="sm"
              leftSection={<IconPlus size={14} />}
              onClick={openCatModal}
            >
              New category
            </Button>
            <Button
              component={Link}
              href="/blog/new"
              size="sm"
              leftSection={<IconPlus size={14} />}
            >
              New post
            </Button>
          </Group>
        }
      />

      {statsQ.isLoading ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} radius="lg" />)}
        </SimpleGrid>
      ) : stats ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <StatCard label="Total posts" value={stats.totalPosts} icon={<IconFileText size={16} />} />
          <StatCard label="Published" value={stats.publishedPosts} />
          <StatCard label="Drafts" value={stats.draftPosts} />
          <StatCard label="Total views" value={stats.totalViews.toLocaleString()} icon={<IconEye size={16} />} />
        </SimpleGrid>
      ) : null}

      {cats.length > 0 && (
        <Group gap="xs" wrap="wrap">
          <Text size="xs" c="dimmed" fw={500}>Categories:</Text>
          {cats.map((c) => (
            <Badge
              key={c.id}
              variant={categoryId === String(c.id) ? 'filled' : 'light'}
              size="sm"
              style={{ cursor: 'pointer' }}
              onClick={() => setCategoryId(categoryId === String(c.id) ? null : String(c.id))}
            >
              {c.name} ({c._count.posts})
            </Badge>
          ))}
        </Group>
      )}

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search posts…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: status,
            onChange: (v) => { setStatus(v); setPage(1); },
            options: [
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'ARCHIVED', label: 'Archived' },
            ],
          },
        ]}
        hasActiveFilters={!!(debouncedSearch || status || categoryId)}
        onReset={() => { setSearch(''); setStatus(null); setCategoryId(null); setPage(1); }}
      />

      {postsQ.isError ? (
        <ErrorState message={(postsQ.error as Error).message} onRetry={() => postsQ.refetch()} />
      ) : (
        <DataTable
          loading={postsQ.isLoading}
          rows={posts}
          rowKey={(r) => r.id}
          emptyMessage="No posts found"
          columns={[
            {
              key: 'title',
              header: 'Title',
              render: (r) => (
                <Stack gap={0}>
                  <Text size="sm" fw={600} lineClamp={1}>{r.title}</Text>
                  <Text size="xs" ff="monospace" c="dimmed">{r.slug}</Text>
                </Stack>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge variant="light" size="sm" color={STATUS_COLOR[r.status]}>{r.status}</Badge>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              render: (r) =>
                r.category ? (
                  <Text size="sm">{r.category.name}</Text>
                ) : (
                  <Text size="sm" c="dimmed">—</Text>
                ),
            },
            {
              key: 'author',
              header: 'Author',
              render: (r) => <Text size="sm">{authorName(r.author)}</Text>,
            },
            {
              key: 'views',
              header: 'Views',
              render: (r) => <Text size="sm" c="dimmed">{r.viewCount.toLocaleString()}</Text>,
            },
            {
              key: 'date',
              header: 'Created',
              render: (r) => (
                <Text size="xs" c="dimmed">
                  {new Date(r.createdAt).toLocaleDateString('en-GB')}
                </Text>
              ),
            },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <Group gap="xs" wrap="nowrap">
                  <Button
                    component={Link}
                    href={`/blog/${r.id}/edit`}
                    variant="subtle" size="compact-xs"
                    leftSection={<IconEdit size={12} />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="subtle" size="compact-xs" color="red"
                    leftSection={<IconTrash size={12} />}
                    onClick={() => { setDeleteTarget(r); openDelete(); }}
                  >
                    Delete
                  </Button>
                </Group>
              ),
            },
          ]}
        />
      )}

      {totalPages > 1 && (
        <Group justify="flex-end">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}

      {deleteTarget && (
        <ConfirmDestructive
          opened={deleteOpened}
          onClose={() => { closeDelete(); setDeleteTarget(null); }}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          loading={deleteMut.isPending}
          title="Delete post"
          description={`Delete "${deleteTarget.title}"? This is permanent and cannot be undone.`}
        />
      )}

      <NewCategoryModal
        opened={catModalOpened}
        onClose={closeCatModal}
        onCreated={() => qc.invalidateQueries({ queryKey: ['blog-categories'] })}
      />
    </Stack>
  );
}
