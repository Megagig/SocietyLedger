'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  Stack, SimpleGrid, Group, Text, Button, Badge, Pagination, Tabs, Modal, TextInput, Textarea, Switch,
  SegmentedControl, Card, Progress, ActionIcon, Tooltip, Skeleton,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconCheck, IconDownload, IconUsers, IconDeviceMobile, IconRepeat } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DataTable } from '@/components/DataTable';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Release {
  id: number;
  version: string;
  url: string;
  notes: string | null;
  isCurrent: boolean;
  isActive: boolean;
  createdAt: string;
  _count: { downloads: number };
}

interface Lead {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
  createdAt: string;
  downloads: number;
  lastDownloadAt: string | null;
  lastVersion: string | null;
}

interface LeadsResponse { leads: Lead[]; total: number; totalPages: number }

interface Analytics {
  rangeDays: number;
  currentVersion: string | null;
  totalLeads: number;
  totalDownloads: number;
  newLeads: number;
  downloadsInRange: number;
  repeatPeople: number;
  firstTimePeople: number;
  byRelease: { version: string; isCurrent: boolean; downloads: number }[];
  byDevice: { device: string; downloads: number }[];
  series: { date: string; downloads: number }[];
}

const DEVICE_LABEL: Record<string, string> = { android: 'Android', ios: 'iPhone / iPad', desktop: 'Computer', other: 'Other' };
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview() {
  const [days, setDays] = useState('30');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['app-downloads', 'analytics', days],
    queryFn: () => bff<Analytics>(`admin/app-downloads/analytics?days=${days}`),
  });

  if (isError) return <ErrorState message="Could not load the download analytics." onRetry={() => refetch()} />;
  if (isLoading || !data) return <Skeleton height={320} radius="lg" />;

  const max = Math.max(1, ...data.series.map((s) => s.downloads));
  const deviceTotal = Math.max(1, data.byDevice.reduce((n, d) => n + d.downloads, 0));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {data.currentVersion ? <>Current version offered: <b>{data.currentVersion}</b></> : 'No version is published yet. Add one in Releases.'}
        </Text>
        <SegmentedControl
          value={days}
          onChange={setDays}
          data={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]}
        />
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <StatCard label="Downloads, all time" value={data.totalDownloads} icon={<IconDownload size={18} />} />
        <StatCard label={`Downloads, last ${data.rangeDays} days`} value={data.downloadsInRange} icon={<IconDownload size={18} />} />
        <StatCard label="People who registered" value={data.totalLeads} icon={<IconUsers size={18} />} trend={`${data.newLeads} new in ${data.rangeDays} days`} trendPositive />
        <StatCard label="Came back to download again" value={data.repeatPeople} icon={<IconRepeat size={18} />} trend={`${data.firstTimePeople} downloaded once`} />
      </SimpleGrid>

      <Card p="lg" radius="lg" style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}>
        <Text fw={600} mb="md">Downloads per day</Text>
        <div role="img" aria-label="Downloads per day" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160 }}>
          {data.series.map((s) => (
            <Tooltip key={s.date} label={`${s.date}: ${s.downloads}`} withArrow>
              <div
                style={{
                  flex: 1,
                  minWidth: 2,
                  height: `${Math.max(2, (s.downloads / max) * 100)}%`,
                  background: s.downloads ? 'var(--mantine-color-teal-6)' : 'var(--admin-border)',
                  borderRadius: 2,
                }}
              />
            </Tooltip>
          ))}
        </div>
        <Group justify="space-between" mt={6}>
          <Text size="xs" c="dimmed">{data.series[0]?.date}</Text>
          <Text size="xs" c="dimmed">{data.series[data.series.length - 1]?.date}</Text>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card p="lg" radius="lg" style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}>
          <Text fw={600} mb="md">By version (all time)</Text>
          <Stack gap="xs">
            {data.byRelease.length === 0 && <Text size="sm" c="dimmed">No releases yet.</Text>}
            {data.byRelease.map((r) => (
              <Group key={r.version} justify="space-between">
                <Group gap="xs">
                  <Text size="sm">{r.version}</Text>
                  {r.isCurrent && <Badge size="xs" color="teal">Current</Badge>}
                </Group>
                <Text size="sm" fw={600}>{r.downloads}</Text>
              </Group>
            ))}
          </Stack>
        </Card>

        <Card p="lg" radius="lg" style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}>
          <Group gap="xs" mb="md"><IconDeviceMobile size={18} /><Text fw={600}>Device (last {data.rangeDays} days)</Text></Group>
          <Stack gap="sm">
            {data.byDevice.length === 0 && <Text size="sm" c="dimmed">No downloads in this period.</Text>}
            {data.byDevice.map((d) => (
              <div key={d.device}>
                <Group justify="space-between" mb={2}>
                  <Text size="sm">{DEVICE_LABEL[d.device] ?? d.device}</Text>
                  <Text size="sm" c="dimmed">{d.downloads} ({Math.round((d.downloads / deviceTotal) * 100)}%)</Text>
                </Group>
                <Progress value={(d.downloads / deviceTotal) * 100} color="teal" size="sm" />
              </div>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>

      <Text size="xs" c="dimmed">
        A download is counted when someone submits the form and is given the link. It does not confirm the app finished installing.
      </Text>
    </Stack>
  );
}

// ── Releases ──────────────────────────────────────────────────────────────────

const EMPTY_FORM = { version: '', url: '', notes: '', isActive: true };

function Releases() {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Release | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleting, setDeleting] = useState<Release | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['app-downloads', 'releases'],
    queryFn: () => bff<Release[]>('admin/app-downloads/releases'),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['app-downloads'] });
  };
  const onError = (e: Error) => notifications.show({ color: 'red', title: 'Could not save', message: e.message });
  const json = (method: string, body?: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

  const save = useMutation({
    mutationFn: () => {
      const payload = { version: form.version, url: form.url, notes: form.notes || null, isActive: form.isActive };
      return editing ? bff(`admin/app-downloads/releases/${editing.id}`, json('PUT', payload)) : bff('admin/app-downloads/releases', json('POST', payload));
    },
    onSuccess: () => { refresh(); close(); notifications.show({ color: 'teal', message: 'Release saved' }); },
    onError,
  });
  const makeCurrent = useMutation({
    mutationFn: (id: number) => bff(`admin/app-downloads/releases/${id}/current`, json('POST')),
    onSuccess: () => { refresh(); notifications.show({ color: 'teal', message: 'The website now offers this version' }); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => bff(`admin/app-downloads/releases/${id}`, json('DELETE')),
    onSuccess: () => { refresh(); setDeleting(null); notifications.show({ color: 'teal', message: 'Release deleted' }); },
    onError: (e: Error) => { setDeleting(null); onError(e); },
  });

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); open(); };
  const openEdit = (r: Release) => { setEditing(r); setForm({ version: r.version, url: r.url, notes: r.notes ?? '', isActive: r.isActive }); open(); };

  if (isError) return <ErrorState message="Could not load the releases." onRetry={() => refetch()} />;

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed" maw={640}>
          Upload the APK to your Cloudflare bucket, copy its public link and add it here. The version marked Current is the one the website offers.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openNew}>Add release</Button>
      </Group>

      <DataTable
        loading={isLoading}
        rows={data ?? []}
        rowKey={(r) => r.id}
        emptyMessage="No releases yet. Add the first one to switch the download button on."
        columns={[
          { key: 'version', header: 'Version', render: (r) => <Group gap="xs"><Text size="sm" fw={600}>{r.version}</Text>{r.isCurrent && <Badge color="teal" size="sm">Current</Badge>}{!r.isActive && <Badge color="gray" size="sm">Off</Badge>}</Group> },
          { key: 'url', header: 'Link', render: (r) => <Text size="sm" truncate maw={320} title={r.url}>{r.url}</Text> },
          { key: 'downloads', header: 'Downloads', render: (r) => r._count.downloads },
          { key: 'added', header: 'Added', render: (r) => formatDate(r.createdAt) },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <Group gap={4} justify="flex-end" wrap="nowrap">
                {!r.isCurrent && r.isActive && (
                  <Button size="compact-xs" variant="light" leftSection={<IconCheck size={14} />} loading={makeCurrent.isPending} onClick={() => makeCurrent.mutate(r.id)}>Make current</Button>
                )}
                <ActionIcon variant="subtle" aria-label={`Edit ${r.version}`} onClick={() => openEdit(r)}><IconEdit size={16} /></ActionIcon>
                <ActionIcon variant="subtle" color="red" aria-label={`Delete ${r.version}`} onClick={() => setDeleting(r)}><IconTrash size={16} /></ActionIcon>
              </Group>
            ),
          },
        ]}
      />

      <Modal opened={opened} onClose={close} title={editing ? 'Edit release' : 'Add release'} centered>
        <Stack>
          <TextInput label="Version" placeholder="1.0.0" value={form.version} onChange={(e) => setForm({ ...form, version: e.currentTarget.value })} required />
          <TextInput label="Download link" description="The public link to the APK in your Cloudflare bucket. It must start with https://" placeholder="https://files.example.com/societyledger-1.0.0.apk" value={form.url} onChange={(e) => setForm({ ...form, url: e.currentTarget.value })} required />
          <Textarea label="Release notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} minRows={3} autosize />
          <Switch label="On" description="A release that is off is never offered" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })} />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>Cancel</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!form.version.trim() || !form.url.trim()}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDestructive
        opened={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) remove.mutate(deleting.id); }}
        title="Delete this release?"
        description={`Version ${deleting?.version ?? ''} will be removed. A release that has been downloaded cannot be deleted. Turn it off instead.`}
        confirmLabel="Delete release"
        loading={remove.isPending}
      />
    </Stack>
  );
}

// ── Leads ─────────────────────────────────────────────────────────────────────

function Leads() {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['app-downloads', 'leads', debounced, page],
    queryFn: () => bff<LeadsResponse>(`admin/app-downloads/leads?page=${page}&pageSize=20${debounced ? `&search=${encodeURIComponent(debounced)}` : ''}`),
  });

  async function exportLeads(format: 'csv' | 'xlsx') {
    setExporting(format);
    try {
      const res = await fetch(`/bff/admin/app-downloads/leads/export?format=${format}${debounced ? `&search=${encodeURIComponent(debounced)}` : ''}`);
      if (!res.ok) throw new Error('The export failed. Please try again.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `app-download-leads-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notifications.show({ color: 'red', title: 'Export failed', message: e instanceof Error ? e.message : 'Please try again.' });
    } finally {
      setExporting(null);
    }
  }

  if (isError) return <ErrorState message="Could not load the leads." onRetry={() => refetch()} />;

  return (
    <Stack>
      <Group>
        <TextInput placeholder="Search name, email or phone" value={search} onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }} style={{ flex: 1, minWidth: 220 }} />
        <Button variant="default" leftSection={<IconDownload size={16} />} loading={exporting === 'csv'} onClick={() => exportLeads('csv')}>Export CSV</Button>
        <Button variant="default" leftSection={<IconDownload size={16} />} loading={exporting === 'xlsx'} onClick={() => exportLeads('xlsx')}>Export Excel</Button>
      </Group>

      <Text size="xs" c="dimmed">
        {data ? `${data.total} ${data.total === 1 ? 'person' : 'people'}. ` : ''}Exports include everyone matching the search. Each export is recorded in the audit log.
      </Text>

      <DataTable
        loading={isLoading}
        rows={data?.leads ?? []}
        rowKey={(l) => l.id}
        emptyMessage="Nobody has downloaded the app yet."
        columns={[
          { key: 'name', header: 'Name', render: (l) => `${l.firstName} ${l.lastName}` },
          { key: 'email', header: 'Email', render: (l) => l.email },
          { key: 'phone', header: 'Phone', render: (l) => l.phone },
          { key: 'downloads', header: 'Downloads', render: (l) => l.downloads },
          { key: 'version', header: 'Last version', render: (l) => l.lastVersion ?? '—' },
          { key: 'last', header: 'Last download', render: (l) => formatDate(l.lastDownloadAt) },
          { key: 'joined', header: 'First seen', render: (l) => formatDate(l.createdAt) },
        ]}
      />

      {data && data.totalPages > 1 && <Pagination value={page} onChange={setPage} total={data.totalPages} />}
    </Stack>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DownloadsPage() {
  return (
    <>
      <PageHeader title="App Downloads" description="The Android app link on the website, the people who download it, and how it is doing." />
      <Tabs defaultValue="overview" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="releases">Releases</Tabs.Tab>
          <Tabs.Tab value="leads">Leads</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview"><Overview /></Tabs.Panel>
        <Tabs.Panel value="releases"><Releases /></Tabs.Panel>
        <Tabs.Panel value="leads"><Leads /></Tabs.Panel>
      </Tabs>
    </>
  );
}
