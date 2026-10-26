'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  Alert, Badge, Button, Card, Checkbox, Divider, Group, Modal, MultiSelect, NumberInput, SimpleGrid, Skeleton, Stack, Switch, Table, Text, TextInput, Textarea,
} from '@mantine/core';
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { ReasonField } from '@/components/ReasonField';
import { formatShortDate } from '@/lib/format';
import {
  billingKeys, currentVersion, draftVersion, formatKobo, koboToNairaInput, nairaToKobo, send, versionLabel,
  type BuilderAddon, type BuilderPlan, type BuilderVersion, type CatalogInfo, type PublishPreview,
} from '@/lib/billing';

type Kind = 'plan' | 'addon';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function VersionedEditor({ kind, id }: { kind: Kind; id: number }) {
  const qc = useQueryClient();
  const listKey = kind === 'plan' ? billingKeys.plans : billingKeys.addons;
  const base = `admin/billing/${kind === 'plan' ? 'plans' : 'addons'}/${id}`;

  const listQ = useQuery({ queryKey: listKey, queryFn: () => bff<(BuilderPlan | BuilderAddon)[]>(`admin/billing/${kind === 'plan' ? 'plans' : 'addons'}`) });
  const catalogQ = useQuery({ queryKey: billingKeys.catalog, queryFn: () => bff<CatalogInfo>('admin/billing/catalog') });
  const plansQ = useQuery({ queryKey: billingKeys.plans, queryFn: () => bff<BuilderPlan[]>('admin/billing/plans'), enabled: kind === 'addon' });

  const item = listQ.data?.find((x) => x.id === id);
  const refresh = () => qc.invalidateQueries({ queryKey: ['billing'] });

  // ---- details (name, copy, visibility)
  const [meta, setMeta] = useState({ name: '', description: '', highlights: '', badgeLabel: '', isPublic: false, isActive: true, isRecommended: false, sortOrder: 0, eligiblePlanIds: [] as string[] });
  const [metaReason, setMetaReason] = useState('');
  useEffect(() => {
    if (!item) return;
    setMeta({
      name: item.name,
      description: item.description ?? '',
      highlights: (item.highlights ?? []).join('\n'),
      badgeLabel: 'badgeLabel' in item ? item.badgeLabel ?? '' : '',
      isPublic: item.isPublic,
      isActive: item.isActive,
      isRecommended: 'isRecommended' in item ? item.isRecommended : false,
      sortOrder: item.sortOrder,
      eligiblePlanIds: 'eligiblePlans' in item ? item.eligiblePlans.map((e) => String(e.plan.id)) : [],
    });
  }, [item]);

  const saveMeta = useMutation({
    mutationFn: () =>
      send(base, 'PATCH', {
        name: meta.name,
        description: meta.description.trim() ? meta.description.trim() : null,
        highlights: meta.highlights.split('\n').map((s) => s.trim()).filter(Boolean),
        ...(kind === 'plan' ? { badgeLabel: meta.badgeLabel.trim() ? meta.badgeLabel.trim() : null, isRecommended: meta.isRecommended } : { eligiblePlanIds: meta.eligiblePlanIds.map(Number) }),
        isPublic: meta.isPublic,
        isActive: meta.isActive,
        sortOrder: meta.sortOrder,
        ...(metaReason.trim() ? { reason: metaReason.trim() } : {}),
      }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Saved. The website and checkout now show this.' });
      setMetaReason('');
      void refresh();
    },
    onError: (e) => notifications.show({ color: 'red', message: errorText(e) }),
  });

  // ---- draft terms
  const published = item ? currentVersion(item) : undefined;
  const draft = item ? draftVersion(item) : undefined;
  const [terms, setTerms] = useState({ monthly: '', annual: '', members: '' as number | '', moduleCodes: [] as string[], featureCodes: [] as string[], note: '' });
  useEffect(() => {
    const v = draft ?? published;
    if (!v) return;
    setTerms({
      monthly: koboToNairaInput(v.priceMonthlyKobo),
      annual: koboToNairaInput(v.priceAnnualKobo),
      members: typeof v.limits?.members === 'number' ? v.limits.members : '',
      moduleCodes: v.moduleCodes,
      featureCodes: v.featureCodes,
      note: v.changeNote ?? '',
    });
  }, [draft, published]);

  const monthlyKobo = nairaToKobo(terms.monthly);
  const annualKobo = nairaToKobo(terms.annual);
  const termsValid = monthlyKobo !== null && annualKobo !== null;

  const startDraft = useMutation({
    mutationFn: () => send(`${base}/draft`, 'POST'),
    onSuccess: () => { notifications.show({ color: 'blue', message: 'Draft started. Customers do not see it until you publish.' }); void refresh(); },
    onError: (e) => notifications.show({ color: 'red', message: errorText(e) }),
  });
  const saveDraft = useMutation({
    mutationFn: () =>
      send(`${base}/draft`, 'PATCH', {
        priceMonthlyKobo: monthlyKobo,
        priceAnnualKobo: annualKobo,
        limits: terms.members === '' ? {} : { members: terms.members },
        moduleCodes: terms.moduleCodes,
        featureCodes: terms.featureCodes,
        changeNote: terms.note,
      }),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Draft saved.' }); void refresh(); },
    onError: (e) => notifications.show({ color: 'red', message: errorText(e) }),
  });
  const discard = useMutation({
    mutationFn: () => send(`${base}/draft`, 'DELETE'),
    onSuccess: () => { notifications.show({ color: 'gray', message: 'Draft discarded.' }); void refresh(); },
    onError: (e) => notifications.show({ color: 'red', message: errorText(e) }),
  });

  // ---- publish
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishReason, setPublishReason] = useState('');
  const previewQ = useQuery({
    queryKey: ['billing', 'publish-preview', kind, id, draft?.id, draft?.priceMonthlyKobo, draft?.priceAnnualKobo],
    queryFn: () => bff<PublishPreview>(`${base}/preview-publish`),
    enabled: publishOpen && kind === 'plan' && !!draft,
  });
  const publish = useMutation({
    mutationFn: () => send<{ version: number }>(`${base}/publish`, 'POST', { reason: publishReason }),
    onSuccess: () => {
      notifications.show({ color: 'green', title: 'Published', message: 'New sign-ups and renewals now use these terms. Existing subscribers keep theirs until you migrate them.' });
      setPublishOpen(false);
      setPublishReason('');
      void refresh();
    },
    onError: (e) => notifications.show({ color: 'red', message: errorText(e) }),
  });

  const catalog = catalogQ.data;
  const featuresByModule = useMemo(() => {
    const map = new Map<string, CatalogInfo['features']>();
    for (const f of catalog?.features ?? []) map.set(f.moduleCode, [...(map.get(f.moduleCode) ?? []), f]);
    return map;
  }, [catalog]);

  if (listQ.isLoading || catalogQ.isLoading) return <Skeleton h={400} radius="lg" />;
  if (listQ.isError) return <ErrorState message="Failed to load" onRetry={() => listQ.refetch()} />;
  if (!item || !catalog) return <ErrorState message={`${kind === 'plan' ? 'Plan' : 'Add-on'} not found`} onRetry={() => listQ.refetch()} />;

  const editing = !!draft;
  const toggle = (list: string[], code: string) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  const noun = kind === 'plan' ? 'plan' : 'add-on';
  const yearlyAtMonthly = monthlyKobo !== null ? monthlyKobo * 12 : null;

  return (
    <Stack gap="xl">
      <Button component={Link} href="/plans" variant="subtle" leftSection={<IconArrowLeft size={14} />} w="fit-content" size="xs">
        Back to Plans
      </Button>
      <PageHeader
        title={
          <Group gap="sm">
            {item.name}
            <Badge variant="light" color={item.isArchived ? 'gray' : item.isPublic && item.isActive ? 'green' : 'yellow'}>
              {item.isArchived ? 'Archived' : item.isPublic && item.isActive ? 'On sale' : item.isActive ? 'Hidden' : 'Deactivated'}
            </Badge>
            {'isOnboardingPlan' in item && item.isOnboardingPlan && <Badge variant="outline">Given to new associations</Badge>}
          </Group>
        }
        description={`Code: ${item.code}. Changes to copy and visibility apply at once. Changes to prices, modules and limits are made in a draft and published as a new version.`}
      />

      {/* ------------------------------------------------------------------ details */}
      <Card style={card} p="xl" radius="lg">
        <Stack gap="md">
          <Text fw={600}>Details and visibility</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.currentTarget.value })} />
            {kind === 'plan' && <TextInput label="Ribbon text" description="For example: Most popular" value={meta.badgeLabel} onChange={(e) => setMeta({ ...meta, badgeLabel: e.currentTarget.value })} />}
            {kind === 'addon' && (
              <MultiSelect
                label="Available on plans"
                description="Leave empty to offer it on every plan."
                data={(plansQ.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
                value={meta.eligiblePlanIds}
                onChange={(v) => setMeta({ ...meta, eligiblePlanIds: v })}
              />
            )}
          </SimpleGrid>
          <Textarea label="Description" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.currentTarget.value })} autosize minRows={2} maxRows={5} />
          <Textarea label="Highlights shown on the pricing card" description="One per line, up to 12." value={meta.highlights} onChange={(e) => setMeta({ ...meta, highlights: e.currentTarget.value })} autosize minRows={3} maxRows={10} />
          <Group gap="xl">
            <Switch label="Shown on the public pricing pages" checked={meta.isPublic} onChange={(e) => setMeta({ ...meta, isPublic: e.currentTarget.checked })} disabled={item.isArchived} />
            <Switch label="Can be bought" checked={meta.isActive} onChange={(e) => setMeta({ ...meta, isActive: e.currentTarget.checked })} disabled={item.isArchived} />
            {kind === 'plan' && <Switch label="Recommended (highlighted)" checked={meta.isRecommended} onChange={(e) => setMeta({ ...meta, isRecommended: e.currentTarget.checked })} disabled={item.isArchived} />}
            <NumberInput label="Display order" value={meta.sortOrder} onChange={(v) => setMeta({ ...meta, sortOrder: Number(v) || 0 })} min={0} w={120} />
          </Group>
          <ReasonField label="Reason (optional, kept in the audit trail)" required={false} value={metaReason} onChange={setMetaReason} />
          <Group>
            <Button onClick={() => saveMeta.mutate()} loading={saveMeta.isPending} disabled={item.isArchived}>Save details</Button>
          </Group>
        </Stack>
      </Card>

      {/* ------------------------------------------------------------------ commercial terms */}
      <Card style={card} p="xl" radius="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={600}>Prices, limits and what is included</Text>
              <Text size="sm" c="dimmed">
                {editing ? `You are editing a draft (${versionLabel(draft!)}). Customers do not see it until you publish.` : published ? `Showing ${versionLabel(published)}, which is on sale now.` : 'Nothing is published yet.'}
              </Text>
            </Stack>
            {!editing && !item.isArchived && (
              <Button variant="light" onClick={() => startDraft.mutate()} loading={startDraft.isPending}>
                Edit terms (start a draft)
              </Button>
            )}
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput
              label="Monthly price (₦)"
              value={terms.monthly}
              onChange={(e) => setTerms({ ...terms, monthly: e.currentTarget.value })}
              disabled={!editing}
              error={terms.monthly && monthlyKobo === null ? 'Enter an amount like 10000 or 10000.50' : undefined}
              description={monthlyKobo !== null ? formatKobo(monthlyKobo) : undefined}
            />
            <TextInput
              label="Annual price (₦)"
              value={terms.annual}
              onChange={(e) => setTerms({ ...terms, annual: e.currentTarget.value })}
              disabled={!editing}
              error={terms.annual && annualKobo === null ? 'Enter an amount like 100000' : undefined}
              description={annualKobo !== null ? `${formatKobo(annualKobo)}${yearlyAtMonthly !== null && annualKobo < yearlyAtMonthly ? ` (saves ${formatKobo(yearlyAtMonthly - annualKobo)} a year)` : ''}` : undefined}
            />
            {catalog.limits.map((l) => (
              <NumberInput
                key={l.key}
                label={l.label}
                description="Leave empty for unlimited"
                value={terms.members}
                onChange={(v) => setTerms({ ...terms, members: v === '' ? '' : Number(v) })}
                min={0}
                allowDecimal={false}
                disabled={!editing}
              />
            ))}
          </SimpleGrid>

          <Divider />
          <Text fw={500} size="sm">Modules and features included</Text>
          <Stack gap="sm">
            {catalog.modules.map((m) => {
              const on = m.isCore || terms.moduleCodes.includes(m.code);
              const feats = featuresByModule.get(m.code) ?? [];
              return (
                <Card key={m.code} withBorder p="sm" radius="md">
                  <Checkbox
                    label={<Text fw={500} size="sm">{m.name}{m.isCore ? ' (always included)' : ''}</Text>}
                    description={m.description ?? undefined}
                    checked={on}
                    disabled={!editing || m.isCore}
                    onChange={() => setTerms({ ...terms, moduleCodes: toggle(terms.moduleCodes, m.code) })}
                  />
                  {feats.length > 0 && (
                    <Group gap="md" mt="xs" ml="xl">
                      {feats.map((f) => (
                        <Checkbox
                          key={f.code}
                          size="xs"
                          label={f.name}
                          checked={f.isCore || terms.featureCodes.includes(f.code)}
                          disabled={!editing || f.isCore || !on}
                          onChange={() => setTerms({ ...terms, featureCodes: toggle(terms.featureCodes, f.code) })}
                        />
                      ))}
                    </Group>
                  )}
                </Card>
              );
            })}
          </Stack>

          {editing && (
            <>
              <TextInput label="Note about this change" description="Shown in the version history." value={terms.note} onChange={(e) => setTerms({ ...terms, note: e.currentTarget.value })} />
              <Group>
                <Button variant="default" onClick={() => saveDraft.mutate()} loading={saveDraft.isPending} disabled={!termsValid}>Save draft</Button>
                <Button
                  onClick={async () => {
                    if (termsValid) await saveDraft.mutateAsync().catch(() => undefined);
                    setPublishOpen(true);
                  }}
                  disabled={!termsValid}
                >
                  Review and publish
                </Button>
                <Button variant="subtle" color="red" onClick={() => discard.mutate()} loading={discard.isPending}>Discard draft</Button>
              </Group>
            </>
          )}
        </Stack>
      </Card>

      {/* ------------------------------------------------------------------ history */}
      <Card style={card} p="xl" radius="lg">
        <Text fw={600} mb="md">Version history</Text>
        <Table withRowBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Version</Table.Th><Table.Th>Status</Table.Th><Table.Th>Monthly</Table.Th><Table.Th>Annual</Table.Th>
              <Table.Th>{kind === 'plan' ? 'Subscribers' : 'Holders'}</Table.Th><Table.Th>Published</Table.Th><Table.Th>Note</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {item.versions.map((v: BuilderVersion) => (
              <Table.Tr key={v.id}>
                <Table.Td>v{v.version}</Table.Td>
                <Table.Td><Badge size="sm" variant="light" color={v.status === 'PUBLISHED' ? 'green' : v.status === 'DRAFT' ? 'blue' : 'gray'}>{v.status === 'PUBLISHED' ? 'On sale' : v.status === 'DRAFT' ? 'Draft' : 'Replaced'}</Badge></Table.Td>
                <Table.Td>{formatKobo(v.priceMonthlyKobo)}</Table.Td>
                <Table.Td>{formatKobo(v.priceAnnualKobo)}</Table.Td>
                <Table.Td>{(v.subscribers ?? v.holders ?? 0).toLocaleString('en-NG')}</Table.Td>
                <Table.Td>{v.publishedAt ? formatShortDate(v.publishedAt) : '-'}</Table.Td>
                <Table.Td><Text size="xs" c="dimmed">{v.changeNote ?? ''}</Text></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {kind === 'plan' && item.versions.filter((v) => v.status !== 'DRAFT').length > 1 && (
          <Text size="sm" c="dimmed" mt="sm">Subscribers stay on the version they bought. To move them, use Migrations on the Plans page.</Text>
        )}
      </Card>

      {/* ------------------------------------------------------------------ publish dialog */}
      <Modal opened={publishOpen} onClose={() => setPublishOpen(false)} title={`Publish this ${noun}`} size="lg">
        <Stack gap="md">
          {kind === 'plan' && previewQ.isLoading && <Skeleton h={120} />}
          {kind === 'plan' && previewQ.isError && <Alert color="red" icon={<IconAlertCircle size={16} />}>{errorText(previewQ.error)}</Alert>}
          {kind === 'plan' && previewQ.data && (
            <Stack gap="xs">
              <Text size="sm">
                This publishes <b>v{previewQ.data.toVersion}</b>{previewQ.data.fromVersion ? <> and replaces <b>v{previewQ.data.fromVersion}</b> for new sales.</> : '.'}
              </Text>
              <Table withRowBorders={false} fz="sm">
                <Table.Tbody>
                  <Table.Tr><Table.Td>Monthly price</Table.Td><Table.Td>{formatKobo(previewQ.data.price.monthly.from)} to <b>{formatKobo(previewQ.data.price.monthly.to)}</b></Table.Td></Table.Tr>
                  <Table.Tr><Table.Td>Annual price</Table.Td><Table.Td>{formatKobo(previewQ.data.price.annual.from)} to <b>{formatKobo(previewQ.data.price.annual.to)}</b></Table.Td></Table.Tr>
                  {previewQ.data.modulesAdded.length > 0 && <Table.Tr><Table.Td>Modules added</Table.Td><Table.Td>{previewQ.data.modulesAdded.join(', ')}</Table.Td></Table.Tr>}
                  {previewQ.data.modulesRemoved.length > 0 && <Table.Tr><Table.Td>Modules removed</Table.Td><Table.Td>{previewQ.data.modulesRemoved.join(', ')}</Table.Td></Table.Tr>}
                  {previewQ.data.featuresAdded.length > 0 && <Table.Tr><Table.Td>Features added</Table.Td><Table.Td>{previewQ.data.featuresAdded.join(', ')}</Table.Td></Table.Tr>}
                  {previewQ.data.featuresRemoved.length > 0 && <Table.Tr><Table.Td>Features removed</Table.Td><Table.Td>{previewQ.data.featuresRemoved.join(', ')}</Table.Td></Table.Tr>}
                  <Table.Tr><Table.Td>Current subscribers</Table.Td><Table.Td><b>{previewQ.data.subscribersOnCurrentVersion}</b> keep their current terms until you migrate them</Table.Td></Table.Tr>
                </Table.Tbody>
              </Table>
              {previewQ.data.blockers.map((b) => <Alert key={b} color="red" icon={<IconAlertCircle size={16} />}>{b}</Alert>)}
              {previewQ.data.warnings.map((w) => <Alert key={w} color="yellow" icon={<IconAlertCircle size={16} />}>{w}</Alert>)}
            </Stack>
          )}
          {kind === 'addon' && <Text size="sm">Publishing makes this version the one new buyers get. Current holders keep what they bought.</Text>}
          <ReasonField
            label={kind === 'plan' && previewQ.data && !previewQ.data.hasPublished ? 'Reason (optional for a first publish)' : 'Reason (required, kept in the audit trail)'}
            required={!(kind === 'plan' && previewQ.data && !previewQ.data.hasPublished)}
            value={publishReason}
            onChange={setPublishReason}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button
              onClick={() => publish.mutate()}
              loading={publish.isPending}
              disabled={(kind === 'plan' && (!previewQ.data || previewQ.data.blockers.length > 0)) || (publishReason.trim().length < 10 && !(kind === 'plan' && previewQ.data && !previewQ.data.hasPublished))}
            >
              Publish
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
