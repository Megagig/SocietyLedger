'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack, Group, Text, Badge, Pagination, Card,
  ThemeIcon, SimpleGrid, Skeleton,
} from '@mantine/core';
import { IconThumbUp, IconThumbDown, IconBook } from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import { StatCard } from '@/components/StatCard';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocFeedback {
  id: number;
  isHelpful: boolean;
  comment: string | null;
  email: string | null;
  createdAt: string;
  page: { id: number; title: string; slug: string };
  user: { id: number; email: string; firstName?: string | null } | null;
}

interface FeedbackResponse {
  feedback: DocFeedback[];
  total: number;
  totalPages: number;
}

interface FeedbackStats {
  total: number;
  helpful: number;
  notHelpful: number;
  helpfulRate: number;
  withComments: number;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const [page, setPage] = useState(1);
  const [isHelpful, setIsHelpful] = useState<string | null>(null);

  const statsQ = useQuery({
    queryKey: ['feedback-stats'],
    queryFn: () => bff<FeedbackStats>('admin/documentation/feedback/stats'),
  });

  const feedbackQ = useQuery({
    queryKey: ['feedback', page, isHelpful],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (isHelpful) params.set('isHelpful', isHelpful);
      return bff<FeedbackResponse>(`admin/documentation/feedback?${params}`);
    },
  });

  const stats = statsQ.data;
  const items = feedbackQ.data?.feedback ?? [];
  const totalPages = feedbackQ.data?.totalPages ?? 1;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Support & Feedback"
        description="User feedback on documentation pages — helpful / not helpful ratings and comments"
      />

      {statsQ.isLoading ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} radius="lg" />)}
        </SimpleGrid>
      ) : stats ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <StatCard label="Total feedback" value={stats.total} />
          <StatCard label="Helpful" value={stats.helpful} icon={<IconThumbUp size={16} />} />
          <StatCard label="Not helpful" value={stats.notHelpful} icon={<IconThumbDown size={16} />} />
          <StatCard
            label="Helpful rate"
            value={`${stats.helpfulRate.toFixed(1)}%`}
          />
        </SimpleGrid>
      ) : null}

      <FilterBar
        search=""
        onSearchChange={() => {}}
        searchPlaceholder="Search feedback…"
        filters={[
          {
            key: 'type',
            label: 'Type',
            value: isHelpful,
            onChange: (v) => { setIsHelpful(v); setPage(1); },
            options: [
              { value: 'true', label: 'Helpful' },
              { value: 'false', label: 'Not helpful' },
            ],
          },
        ]}
        hasActiveFilters={!!isHelpful}
        onReset={() => { setIsHelpful(null); setPage(1); }}
      />

      {feedbackQ.isError ? (
        <ErrorState message={(feedbackQ.error as Error).message} onRetry={() => feedbackQ.refetch()} />
      ) : (
        <DataTable
          loading={feedbackQ.isLoading}
          rows={items}
          rowKey={(r) => r.id}
          emptyMessage="No feedback found"
          columns={[
            {
              key: 'rating',
              header: 'Rating',
              render: (r) => (
                <ThemeIcon
                  variant="light"
                  color={r.isHelpful ? 'green' : 'red'}
                  size="sm"
                >
                  {r.isHelpful ? <IconThumbUp size={12} /> : <IconThumbDown size={12} />}
                </ThemeIcon>
              ),
            },
            {
              key: 'page',
              header: 'Page',
              render: (r) => (
                <Text
                  component={Link}
                  href={`/help/${r.page.id}/edit`}
                  size="sm"
                  c="blue"
                  td="underline"
                >
                  {r.page.title}
                </Text>
              ),
            },
            {
              key: 'comment',
              header: 'Comment',
              render: (r) =>
                r.comment ? (
                  <Text size="sm" lineClamp={2}>{r.comment}</Text>
                ) : (
                  <Text size="sm" c="dimmed">—</Text>
                ),
            },
            {
              key: 'user',
              header: 'User',
              render: (r) => (
                <Text size="sm" c="dimmed">
                  {r.user?.email ?? r.email ?? 'Anonymous'}
                </Text>
              ),
            },
            {
              key: 'date',
              header: 'Date',
              render: (r) => (
                <Text size="xs" c="dimmed">
                  {new Date(r.createdAt).toLocaleDateString('en-GB')}
                </Text>
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
    </Stack>
  );
}
