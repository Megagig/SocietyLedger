'use client';

import { Stack, Text, ThemeIcon, Button } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <Stack align="center" justify="center" gap="md" py={64}>
      <ThemeIcon size={48} variant="light" color="red" radius="xl">
        <IconAlertCircle size={24} />
      </ThemeIcon>
      <Stack align="center" gap={4}>
        <Text fw={600} size="md">{title}</Text>
        {message && <Text c="dimmed" size="sm" ta="center" maw={360}>{message}</Text>}
      </Stack>
      {onRetry && (
        <Button variant="default" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Stack>
  );
}
