'use client';

import { Stack, Text, ThemeIcon } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Stack align="center" justify="center" gap="md" py={64}>
      <ThemeIcon size={48} variant="light" color="gray" radius="xl">
        {icon ?? <IconInbox size={24} />}
      </ThemeIcon>
      <Stack align="center" gap={4}>
        <Text fw={600} size="md">{title}</Text>
        {description && <Text c="dimmed" size="sm" ta="center" maw={360}>{description}</Text>}
      </Stack>
      {action}
    </Stack>
  );
}
