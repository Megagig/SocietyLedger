'use client';

import Link from 'next/link';
import { Badge, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core';
import { getDashboardAttention } from '@/lib/api/dashboard';
import { useScopedQuery } from '@/lib/query';
import { attentionRows } from './attention-lines';

/** Work waiting on the signed-in officer, one line per queue. Hidden while loading, on error, and when nothing is waiting. */
export function NeedsAttentionCard() {
  const { data } = useScopedQuery({
    domain: 'dashboard',
    parts: ['attention'],
    queryFn: getDashboardAttention,
    staleTime: 1000 * 30, // waiting payments: shorter than the rest of the dashboard
    refetchInterval: 1000 * 60,
  });

  const rows = attentionRows(data);
  if (rows.length === 0) return null;

  return (
    <Paper withBorder radius="md" p="md" data-testid="needs-attention">
      <Text fw={600} mb="xs">
        Needs your attention
      </Text>
      <Stack gap={4}>
        {rows.map((row) => (
          <UnstyledButton key={row.key} component={Link} href={row.href} py={6} data-testid={`attention-${row.key}`}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm">{row.label(row.count)}</Text>
              <Badge color={row.urgent ? 'red' : 'yellow'} variant="light">
                {row.count}
              </Badge>
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Paper>
  );
}
