'use client';

import Link from 'next/link';
import { Button, Card, Stack, Text } from '@mantine/core';
import type { EntrySource } from '@/lib/api/accounting';
import { formatNaira, SOURCE_OPEN_LABELS, sourceHref } from '@/lib/accounting-drill';

/**
 * Where an automatic journal entry came from: the record behind it in plain facts, with a button to open it. If the record can no
 * longer be found it says so and the entry stays readable. Not shown for an entry an officer wrote.
 */
export function SourceCard({ source }: { source: EntrySource }) {
  const href = sourceHref(source);
  const details = [source.date ? new Date(source.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : null, source.status, source.reference ? `Ref ${source.reference}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card withBorder padding="md" data-testid="entry-source">
      <Stack gap={6}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {source.title}
        </Text>
        <Text fw={500}>{source.summary}</Text>
        {!source.missing ? (
          <>
            {source.amount !== null ? <Text fw={600}>{formatNaira(source.amount)}</Text> : null}
            {details ? (
              <Text size="sm" c="dimmed">
                {details}
              </Text>
            ) : null}
          </>
        ) : null}
        {href ? (
          <Button component={Link} href={href} variant="light" size="xs" mt={4} data-testid="entry-source-open">
            {SOURCE_OPEN_LABELS[source.kind]}
          </Button>
        ) : null}
      </Stack>
    </Card>
  );
}
