'use client';

import { Group, Title, Text, Stack } from '@mantine/core';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" mb="xl">
      <Stack gap={4}>
        <Title order={2}>{title}</Title>
        {description && (
          <Text size="sm" c="dimmed">{description}</Text>
        )}
      </Stack>
      {actions && <Group gap="sm">{actions}</Group>}
    </Group>
  );
}
