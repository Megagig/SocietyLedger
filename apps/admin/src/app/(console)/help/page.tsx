'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  Stack, SimpleGrid, Group, Text, Button, Badge, Pagination,
  Skeleton, Modal, TextInput, Progress,
} from '@mantine/core';
import {
  IconPlus, IconEdit, IconTrash, IconEye, IconBook,
  IconThumbUp, IconThumbDown,
} from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DataTable } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocPage {
  id: number;
  title: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  author: { firstName: string | null; email: string } | null;
  section: { id: number; name: string } | null;
}

interface DocSection {
  id: number;
  name: string;
  slug: string;
  order: number;
  _count: { pages: number };
}

interface DocPagesResponse {
  pages: DocPage[];
  total: number;
  totalPages: number;
}

interface DocStats {
  totalPages: number;
  publishedPages: number;
  draftPages: number;
  totalViews: number;
  helpfulCount: number;
  unhelpfulCount: number;
}

// ── Feedback thumbs ────────────────────────────────────────────────────────────

function FeedbackBar({ helpful, notHelpful }: { helpful: number; notHelpful: number }) {
  const total = helpful + notHelpful;
  if (total === 0) return <Text size="xs" c="dimmed">No feedback</Text>;
  const pct = Math.round((helpful / total) * 100);
  return (
    <Group gap="xs" align="center" wrap="nowrap">
      <IconThumbUp size={12} color="var(--mantine-color-green-5)" />
      <Text size="xs" fw={600} c="green">{helpful}</Text>
      <Progress value={pct} color="green" size="xs" w={48} />
      <Text size="xs" c="dimmed">{notHelpful}</Text>
      <IconThumbDown size={12} color="var(--mantine-color-dimmed)" />
    </Group>
  );
}

// ── New section modal ─────────────────────────────────────────────────────────

function NewSectionModal({ opened, onClose, onCreated }: {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');

  const mut = useMutation({
    mutationFn: () => bff('admin/documentation/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      }),
    }),
    onSuccess: () => {
      notifications.show({ message: 'Section created', color: 'green' });
      setName('');
      onClose();
      onCreated();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="New section" size="sm" centered>
      <Stack gap="md">
        <TextInput
          label="Name"
          placeholder="e.g. Getting Started"
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

export default function HelpPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [status, setStatus] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<DocPage | null>(null);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [secModalOpened, { open: openSecModal, close: closeSecModal }] = useDisclosure(false);

  const statsQ = useQuery({
    queryKey: ['doc-stats'],
    queryFn: () => bff<DocStats>('admin/documentation/stats'),
  });

  const sectionsQ = useQuery({
    queryKey: ['doc-sections'],
    queryFn: () => bff<DocSection[]>('admin/documentation/sections'),
  });

  const pagesQ = useQuery({
    queryKey: ['doc-pages', page, debouncedSearch, status, sectionId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status) params.set('status', status);
      if (sectionId) params.set('sectionId', sectionId);
      return bff<DocPagesResponse>(`admin/documentation/pages?${params}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => bff(`admin/documentation/pages/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notifications.show({ message: 'Page deleted', color: 'green' });
      qc.invalidateQueries({ queryKey: ['doc-pages'] });
      qc.invalidateQueries({ queryKey: ['doc-stats'] });
      closeDelete();
      setDeleteTarget(null);
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const docPages = pagesQ.data?.pages ?? [];
  const totalPages = pagesQ.data?.totalPages ?? 1;
  const sections = sectionsQ.data ?? [];
  const stats = statsQ.data;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Help Content"
        description="Manage documentation pages, sections, and user feedback"
        actions={
          <Group gap="sm">
            <Button
              variant="default"
              size="sm"
              leftSection={<IconPlus size={14} />}
              onClick={openSecModal}
            >
              New section
            </Button>
            <Button
              component={Link}
              href="/help/new"
              size="sm"
              leftSection={<IconPlus size={14} />}
            >
              New page
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
          <StatCard label="Total pages" value={stats.totalPages} icon={<IconBook size={16} />} />
          <StatCard label="Published" value={stats.publishedPages} />
          <StatCard label="Total views" value={stats.totalViews.toLocaleString()} icon={<IconEye size={16} />} />
          <StatCard
            label="Helpful votes"
            value={`${stats.helpfulCount}↑ ${stats.unhelpfulCount}↓`}
            icon={<IconThumbUp size={16} />}
          />
        </SimpleGrid>
      ) : null}

      {sections.length > 0 && (
        <Group gap="xs" wrap="wrap">
          <Text size="xs" c="dimmed" fw={500}>Sections:</Text>
          {sections.map((s) => (
            <Badge
              key={s.id}
              variant={sectionId === String(s.id) ? 'filled' : 'light'}
              size="sm"
              style={{ cursor: 'pointer' }}
              onClick={() => setSectionId(sectionId === String(s.id) ? null : String(s.id))}
            >
              {s.name} ({s._count.pages})
            </Badge>
          ))}
        </Group>
      )}

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search documentation…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: status,
            onChange: (v) => { setStatus(v); setPage(1); },
            options: [
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'DRAFT', label: 'Draft' },
            ],
          },
        ]}
        hasActiveFilters={!!(debouncedSearch || status || sectionId)}
        onReset={() => { setSearch(''); setStatus(null); setSectionId(null); setPage(1); }}
      />

      {pagesQ.isError ? (
        <ErrorState message={(pagesQ.error as Error).message} onRetry={() => pagesQ.refetch()} />
      ) : (
        <DataTable
          loading={pagesQ.isLoading}
          rows={docPages}
          rowKey={(r) => r.id}
          emptyMessage="No documentation pages found"
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
                <Badge
                  variant="light"
                  size="sm"
                  color={r.status === 'PUBLISHED' ? 'green' : 'yellow'}
                >
                  {r.status}
                </Badge>
              ),
            },
            {
              key: 'section',
              header: 'Section',
              render: (r) =>
                r.section ? (
                  <Text size="sm">{r.section.name}</Text>
                ) : (
                  <Text size="sm" c="dimmed">—</Text>
                ),
            },
            {
              key: 'views',
              header: 'Views',
              render: (r) => <Text size="sm" c="dimmed">{r.viewCount.toLocaleString()}</Text>,
            },
            {
              key: 'feedback',
              header: 'Feedback',
              render: (r) => (
                <FeedbackBar helpful={r.helpfulCount} notHelpful={r.notHelpfulCount} />
              ),
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
                    href={`/help/${r.id}/edit`}
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
          title="Delete page"
          description={`Delete "${deleteTarget.title}"? This is permanent.`}
        />
      )}

      <NewSectionModal
        opened={secModalOpened}
        onClose={closeSecModal}
        onCreated={() => qc.invalidateQueries({ queryKey: ['doc-sections'] })}
      />
    </Stack>
  );
}
