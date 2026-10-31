'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  Stack, Group, Button, TextInput, Textarea, Select, Card,
} from '@mantine/core';
import { bff } from '@/lib/bff';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocSection {
  id: number;
  name: string;
}

export interface DocPageFormValues {
  title: string;
  content: string;
  excerpt: string;
  sectionId: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

const EMPTY_VALUES: DocPageFormValues = {
  title: '',
  content: '',
  excerpt: '',
  sectionId: null,
  status: 'DRAFT',
};

function toCreateBody(values: DocPageFormValues) {
  return {
    title: values.title,
    content: values.content,
    excerpt: values.excerpt || undefined,
    sectionId: values.sectionId ? Number(values.sectionId) : undefined,
  };
}

function toUpdateBody(values: DocPageFormValues) {
  return {
    ...toCreateBody(values),
    status: values.status,
  };
}

// ── Form ─────────────────────────────────────────────────────────────────────

export function DocPageForm({ pageId }: { pageId?: number }) {
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = pageId !== undefined;

  const [values, setValues] = useState<DocPageFormValues>(EMPTY_VALUES);

  const sectionsQ = useQuery({
    queryKey: ['doc-sections'],
    queryFn: () => bff<DocSection[]>('admin/documentation/sections'),
  });

  const pageQ = useQuery({
    queryKey: ['doc-page', pageId],
    queryFn: () => bff<{
      title: string; content: string; excerpt: string | null;
      sectionId: number | null; status: DocPageFormValues['status'];
    }>(`admin/documentation/pages/${pageId}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (pageQ.data) {
      setValues({
        title: pageQ.data.title,
        content: pageQ.data.content,
        excerpt: pageQ.data.excerpt ?? '',
        sectionId: pageQ.data.sectionId ? String(pageQ.data.sectionId) : null,
        status: pageQ.data.status,
      });
    }
  }, [pageQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      isEdit
        ? bff(`admin/documentation/pages/${pageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toUpdateBody(values)),
          })
        : bff('admin/documentation/pages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toCreateBody(values)),
          }),
    onSuccess: () => {
      notifications.show({ message: isEdit ? 'Page updated' : 'Page created', color: 'green' });
      qc.invalidateQueries({ queryKey: ['doc-pages'] });
      qc.invalidateQueries({ queryKey: ['doc-stats'] });
      router.push('/help');
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const canSave = values.title.trim().length >= 1 && values.content.trim().length >= 1;

  return (
    <Card
      style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
      p="lg"
      radius="lg"
    >
      <Stack gap="md">
        <TextInput
          label="Title"
          placeholder="e.g. How to add a new member"
          value={values.title}
          onChange={(e) => { const next = e.currentTarget.value; setValues((v) => ({ ...v, title: next })); }}
          required
        />
        <Textarea
          label="Excerpt"
          description="Short summary shown in search results and listings"
          placeholder="A brief summary of this page…"
          value={values.excerpt}
          onChange={(e) => { const next = e.currentTarget.value; setValues((v) => ({ ...v, excerpt: next })); }}
          autosize
          minRows={2}
          maxRows={4}
        />
        <Textarea
          label="Content"
          placeholder="Write the page…"
          value={values.content}
          onChange={(e) => { const next = e.currentTarget.value; setValues((v) => ({ ...v, content: next })); }}
          autosize
          minRows={10}
          required
        />
        <Group grow>
          <Select
            label="Section"
            placeholder="None"
            value={values.sectionId}
            onChange={(val) => setValues((v) => ({ ...v, sectionId: val }))}
            data={(sectionsQ.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
            clearable
          />
          {isEdit && (
            <Select
              label="Status"
              value={values.status}
              onChange={(val) => setValues((v) => ({ ...v, status: (val as DocPageFormValues['status']) ?? 'DRAFT' }))}
              data={[
                { value: 'DRAFT', label: 'Draft' },
                { value: 'PUBLISHED', label: 'Published' },
                { value: 'ARCHIVED', label: 'Archived' },
              ]}
              allowDeselect={false}
            />
          )}
        </Group>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => router.push('/help')} disabled={saveMut.isPending}>
            Cancel
          </Button>
          <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} disabled={!canSave}>
            {isEdit ? 'Save changes' : 'Create page'}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
