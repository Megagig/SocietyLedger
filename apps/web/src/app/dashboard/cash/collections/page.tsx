'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Button, Card, Group, LoadingOverlay, Modal, Pagination, SegmentedControl, Select, Stack, Table, Text, Textarea, TextInput, Title } from '@mantine/core';
import { Plus } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { cashApi, cashErrorMessage, formatNaira, type CashCollection, type CashCollectionStatus } from '@/lib/api/cash';
import { getRecentMeetings, getUpcomingMeetings } from '@/lib/api/meetings';
import { CashNav } from '@/components/cash/CashNav';
import { HelpLink } from '@/components/docs/HelpLink';

const PAGE_SIZE = 20;

function CollectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CashCollectionStatus>('OPEN');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<CashCollection[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [opening, setOpening] = useState(searchParams.get('new') === '1');
  const [title, setTitle] = useState('');
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [meetings, setMeetings] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await cashApi.listCollections({ status, page, limit: PAGE_SIZE });
      setRows(result.items);
      setTotalPages(result.totalPages);
    } catch (error) {
      notifications.show({ title: 'Could not load collections', message: cashErrorMessage(error, 'Try again.'), color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Meetings are optional context — if the meetings module is off or the lists fail, the collection simply isn't tied to one.
  useEffect(() => {
    if (!opening || meetings.length > 0) return;
    Promise.allSettled([getUpcomingMeetings(10), getRecentMeetings(10)]).then((results) => {
      const seen = new Set<number>();
      const options: { value: string; label: string }[] = [];
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const list = Array.isArray(result.value) ? result.value : (result.value as { data?: unknown[] })?.data;
        for (const m of (Array.isArray(list) ? list : []) as { id: number; title: string; startTime: string }[]) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          options.push({ value: String(m.id), label: `${m.title} · ${new Date(m.startTime).toLocaleDateString()}` });
        }
      }
      setMeetings(options);
    });
  }, [opening, meetings.length]);

  const open = async () => {
    if (title.trim().length < 2) {
      notifications.show({ title: 'Name the collection', message: 'For example: October general meeting.', color: 'red' });
      return;
    }
    setSaving(true);
    try {
      const created = await cashApi.createCollection({ title: title.trim(), meetingId: meetingId ? Number(meetingId) : null, notes: notes.trim() || null });
      notifications.show({ title: 'Collection opened', message: 'You can start taking cash.', color: 'green' });
      router.push(`/dashboard/cash/collections/${created.id}`);
    } catch (error) {
      notifications.show({ title: 'Could not open the collection', message: cashErrorMessage(error, 'Try again.'), color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Can anyPermissions={[PERMISSIONS.CASH_COLLECT, PERMISSIONS.CASH_LODGE, PERMISSIONS.CASH_VERIFY, PERMISSIONS.CASH_VIEW]}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Cash Collections</Title>
            <Text size="sm" c="dimmed">
              Each collection is one occasion on which cash is taken — a meeting, or a day
            </Text>
          </div>
          <Group>
            <HelpLink />
            <Can permission={PERMISSIONS.CASH_COLLECT}>
              <Button leftSection={<Plus size={16} />} onClick={() => setOpening(true)}>
                Open a collection
              </Button>
            </Can>
          </Group>
        </Group>

        <CashNav />

        <SegmentedControl
          value={status}
          onChange={(value) => {
            setStatus(value as CashCollectionStatus);
            setPage(1);
          }}
          data={[
            { value: 'OPEN', label: 'Open' },
            { value: 'CLOSED', label: 'Closed' },
          ]}
          w={220}
        />

        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />
          {rows.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {status === 'OPEN' ? 'No open collection. Open one when you start taking cash at a meeting.' : 'No closed collections yet.'}
            </Text>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Collection</Table.Th>
                  <Table.Th>Collected by</Table.Th>
                  <Table.Th>Opened</Table.Th>
                  <Table.Th>Receipts</Table.Th>
                  <Table.Th>Collected</Table.Th>
                  <Table.Th>Still to lodge</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((c) => (
                  <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/dashboard/cash/collections/${c.id}`)}>
                    <Table.Td fw={500}>{c.title}</Table.Td>
                    <Table.Td>{c.collectedBy.name}</Table.Td>
                    <Table.Td>{new Date(c.openedAt).toLocaleDateString()}</Table.Td>
                    <Table.Td>{c.receiptCount}</Table.Td>
                    <Table.Td fw={600}>{formatNaira(c.collected)}</Table.Td>
                    <Table.Td>{formatNaira(c.toLodge)}</Table.Td>
                    <Table.Td>
                      <Badge color={c.status === 'OPEN' ? 'blue' : 'gray'} variant="light">
                        {c.status === 'OPEN' ? 'Open' : 'Closed'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {totalPages > 1 ? (
            <Group justify="center" mt="md">
              <Pagination value={page} onChange={setPage} total={totalPages} />
            </Group>
          ) : null}
        </Card>

        <Modal opened={opening} onClose={() => setOpening(false)} title="Open a collection" size="md">
          <Stack>
            <Text size="sm" c="dimmed">
              Every receipt you write goes into this collection. When you are done, close it and lodge the cash.
            </Text>
            <TextInput label="Name" placeholder="October general meeting" value={title} onChange={(e) => setTitle(e.currentTarget.value)} data-autofocus />
            {meetings.length > 0 ? (
              <Select label="Meeting (optional)" placeholder="Not tied to a meeting" data={meetings} value={meetingId} onChange={setMeetingId} clearable searchable />
            ) : null}
            <Textarea label="Note (optional)" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} autosize minRows={2} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOpening(false)}>
                Cancel
              </Button>
              <Button loading={saving} onClick={open}>
                Open collection
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Can>
  );
}

export default function CollectionsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <CollectionsContent />
    </Suspense>
  );
}
