'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  Anchor, Badge, Button, Card, FileInput, Grid, Group, Paper, Select, Skeleton, Stack, Switch, Text, Textarea, Title,
} from '@mantine/core';
import { IconArrowLeft, IconFileText, IconPaperclip, IconPhoto, IconSend, IconUserCheck } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { ErrorState } from '@/components/ErrorState';
import {
  CATEGORY_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  VALID_STATUS_TRANSITIONS,
  formatSize,
  personName,
  type Person,
  type PlatformTicket,
  type TicketAttachment,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/support';

const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

function Attachments({ items }: { items?: TicketAttachment[] }) {
  if (!items || items.length === 0) return null;

  async function open(item: TicketAttachment) {
    try {
      const { url } = await bff<{ url: string }>(`admin/support/attachments/${item.id}`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      notifications.show({ message: (err as Error).message || 'Could not open the file', color: 'red' });
    }
  }

  return (
    <Group gap="xs" mt="sm">
      {items.map((item) => (
        <Button
          key={item.id}
          variant="default"
          size="compact-sm"
          leftSection={item.mimeType.startsWith('image/') ? <IconPhoto size={14} /> : <IconFileText size={14} />}
          onClick={() => open(item)}
        >
          {item.originalName} · {formatSize(item.fileSize)}
        </Button>
      ))}
    </Group>
  );
}

/** One Tier 2 ticket: the conversation, internal notes, and the controls to assign, change status and priority. */
export default function PlatformTicketPage() {
  const params = useParams();
  const ticketId = Number(params.id);
  const qc = useQueryClient();

  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const ticketQ = useQuery({
    queryKey: ['platform-ticket', ticketId],
    queryFn: () => bff<PlatformTicket>(`admin/support/tickets/${ticketId}`),
    enabled: Number.isFinite(ticketId),
    refetchInterval: 30_000,
  });
  const staffQ = useQuery({
    queryKey: ['platform-ticket-staff'],
    queryFn: () => bff<{ staff: (Person & { platformRole?: string })[]; meId: number | null }>('admin/support/staff'),
    staleTime: 5 * 60_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['platform-ticket', ticketId] });
    qc.invalidateQueries({ queryKey: ['platform-tickets'] });
    qc.invalidateQueries({ queryKey: ['platform-ticket-stats'] });
  };

  const replyMut = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('message', message.trim());
      form.append('isInternal', String(internal));
      files.forEach((file) => form.append('files', file));
      return bff<{ attachmentError?: string }>(`admin/support/tickets/${ticketId}/respond`, { method: 'POST', body: form });
    },
    onSuccess: () => {
      notifications.show({ message: internal ? 'Internal note added' : 'Reply sent', color: 'green' });
      setMessage('');
      setFiles([]);
      setInternal(false);
      refresh();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const updateMut = useMutation({
    mutationFn: (body: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: number | null }) =>
      bff(`admin/support/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: () => {
      notifications.show({ message: 'Ticket updated', color: 'green' });
      refresh();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  function pickFiles(picked: File[]) {
    const next: File[] = [];
    for (const file of picked.slice(0, MAX_FILES)) {
      if (!ALLOWED.includes(file.type)) {
        notifications.show({ message: `${file.name}: attach a photo or a PDF`, color: 'red' });
        continue;
      }
      if (file.size > MAX_BYTES) {
        notifications.show({ message: `${file.name} is larger than 5MB`, color: 'red' });
        continue;
      }
      next.push(file);
    }
    setFiles(next);
  }

  if (ticketQ.isLoading) return <Stack gap="md"><Skeleton h={40} /><Skeleton h={200} /><Skeleton h={160} /></Stack>;
  if (ticketQ.isError || !ticketQ.data) {
    return <ErrorState message={(ticketQ.error as Error | null)?.message ?? 'Ticket not found'} onRetry={() => ticketQ.refetch()} />;
  }

  const ticket = ticketQ.data;
  const meId = staffQ.data?.meId ?? null;
  const staff = staffQ.data?.staff ?? [];
  const replies = ticket.responses ?? [];
  const statusOptions = [ticket.status, ...VALID_STATUS_TRANSITIONS[ticket.status]].map((s) => ({ value: s, label: STATUS_LABELS[s] }));

  return (
    <Stack gap="lg">
      <div>
        <Anchor component={Link} href="/support" size="sm" c="dimmed">
          <Group gap={4}><IconArrowLeft size={14} /> Back to tickets</Group>
        </Anchor>
        <Group gap="sm" mt="xs" wrap="wrap">
          <Text size="sm" c="dimmed" ff="monospace">{ticket.ticketNumber}</Text>
          <Badge variant="light" color={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
          <Badge variant="light" color={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
          {ticket.isEscalation && <Badge variant="light" color="grape">Escalated from a member ticket</Badge>}
        </Group>
        <Title order={2} mt={4}>{ticket.subject}</Title>
      </div>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            <Paper withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" mb={4}>{personName(ticket.user)} · {when(ticket.createdAt)}</Text>
              <Text style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</Text>
              <Attachments items={ticket.attachments} />
            </Paper>

            {replies.map((reply) => (
              <Paper
                key={reply.id}
                withBorder
                p="md"
                radius="md"
                style={{
                  borderColor: reply.isInternal ? 'var(--mantine-color-yellow-5)' : undefined,
                  backgroundColor: reply.isInternal ? 'var(--mantine-color-yellow-light)' : reply.isStaff ? 'var(--mantine-color-teal-light)' : undefined,
                }}
              >
                <Group gap="xs" mb={4}>
                  <Text size="sm" fw={500}>{reply.isStaff ? personName(reply.user) : `${personName(reply.user)} (customer)`}</Text>
                  {reply.isInternal ? <Badge size="xs" color="yellow">Internal note</Badge> : reply.isStaff ? <Badge size="xs" color="teal">SocietyLedger</Badge> : null}
                  <Text size="xs" c="dimmed">{when(reply.createdAt)}</Text>
                </Group>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{reply.message}</Text>
                <Attachments items={reply.attachments} />
              </Paper>
            ))}

            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Textarea
                  label={internal ? 'Internal note (only SocietyLedger staff can see this)' : 'Reply to the association admin'}
                  placeholder={internal ? 'Add a note for the team…' : 'Write your reply…'}
                  value={message}
                  onChange={(e) => setMessage(e.currentTarget.value)}
                  minRows={4}
                  autosize
                  maxLength={10000}
                />
                <FileInput
                  label="Attachments (optional)"
                  placeholder="Up to 3 photos or PDFs, 5MB each"
                  leftSection={<IconPaperclip size={14} />}
                  multiple
                  clearable
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                  value={files}
                  onChange={pickFiles}
                />
                <Group justify="space-between">
                  <Switch label="Internal note" checked={internal} onChange={(e) => setInternal(e.currentTarget.checked)} />
                  <Button leftSection={<IconSend size={16} />} loading={replyMut.isPending} disabled={!message.trim()} onClick={() => replyMut.mutate()}>
                    {internal ? 'Add note' : 'Send reply'}
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Select
                  label="Status"
                  data={statusOptions}
                  value={ticket.status}
                  allowDeselect={false}
                  onChange={(v) => v && v !== ticket.status && updateMut.mutate({ status: v as TicketStatus })}
                  disabled={updateMut.isPending}
                />
                <Select
                  label="Priority"
                  data={(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
                  value={ticket.priority}
                  allowDeselect={false}
                  onChange={(v) => v && v !== ticket.priority && updateMut.mutate({ priority: v as TicketPriority })}
                  disabled={updateMut.isPending}
                />
                <Select
                  label="Assigned to"
                  placeholder="Unassigned"
                  clearable
                  data={staff.map((s) => ({ value: String(s.id), label: personName(s) }))}
                  value={ticket.assignedTo ? String(ticket.assignedTo.id) : null}
                  onChange={(v) => updateMut.mutate({ assignedToId: v ? Number(v) : null })}
                  disabled={updateMut.isPending}
                />
                {meId !== null && ticket.assignedTo?.id !== meId && (
                  <Button variant="light" leftSection={<IconUserCheck size={16} />} loading={updateMut.isPending} onClick={() => updateMut.mutate({ assignedToId: meId })}>
                    Assign to me
                  </Button>
                )}
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
              <Stack gap={6}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Association</Text>
                <Anchor component={Link} href={`/associations/${ticket.association.id}`} size="sm">{ticket.association.name}</Anchor>
                <Text size="xs" c="dimmed">{ticket.association.subdomain}</Text>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mt="xs">Opened by</Text>
                <Text size="sm">{personName(ticket.user)}</Text>
                <Text size="xs" c="dimmed">{ticket.user?.email}</Text>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mt="xs">Category</Text>
                <Text size="sm">{CATEGORY_LABELS[ticket.category]}</Text>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
