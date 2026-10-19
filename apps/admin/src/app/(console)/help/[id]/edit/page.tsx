'use client';

import { useParams } from 'next/navigation';
import { Stack } from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { DocPageForm } from '@/components/forms/DocPageForm';

export default function EditHelpPagePage() {
  const params = useParams<{ id: string }>();

  return (
    <Stack gap="xl">
      <PageHeader title="Edit page" description="Update this documentation page" />
      <DocPageForm pageId={Number(params.id)} />
    </Stack>
  );
}
