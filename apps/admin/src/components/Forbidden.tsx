'use client';

import { Stack, Text, ThemeIcon } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';

interface ForbiddenProps {
  message?: string;
}

export function Forbidden({ message }: ForbiddenProps) {
  return (
    <Stack align="center" justify="center" gap="md" py={64}>
      <ThemeIcon size={48} variant="light" color="orange" radius="xl">
        <IconLock size={24} />
      </ThemeIcon>
      <Stack align="center" gap={4}>
        <Text fw={600} size="md">Access Denied</Text>
        <Text c="dimmed" size="sm" ta="center" maw={360}>
          {message ?? "You don't have permission to view this page."}
        </Text>
      </Stack>
    </Stack>
  );
}
