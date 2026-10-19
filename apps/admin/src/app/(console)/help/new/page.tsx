'use client';

import { Stack } from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { DocPageForm } from '@/components/forms/DocPageForm';

export default function NewHelpPagePage() {
  return (
    <Stack gap="xl">
      <PageHeader title="New page" description="Create a new documentation page" />
      <DocPageForm />
    </Stack>
  );
}
