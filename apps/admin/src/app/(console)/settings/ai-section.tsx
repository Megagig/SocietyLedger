'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Alert, Button, Card, Divider, Group, NumberInput, SegmentedControl, Skeleton, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { bff } from '@/lib/bff';

type AiSettings = {
  enabled: boolean;
  model: string;
  maxOutputTokens: number;
  creditPriceNaira: number;
  minPurchaseNaira: number;
  allowances: { STARTER: number; PROFESSIONAL: number; ENTERPRISE: number };
  weights: { question: number; reminders: number; report: number };
};
type AiSettingsResponse = { settings: AiSettings; defaults: AiSettings };

type UsageRow = { associationId: number; associationName: string; requests: number; units: number; allowanceUnits: number; creditUnits: number; costUsd: number; creditsSold: number; revenueNaira: number };
type Usage = { from: string; to: string; rows: UsageRow[]; totals: Omit<UsageRow, 'associationId' | 'associationName'> };

const naira = (v: number) => `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dollars = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

function Row({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
      <Stack gap={2} style={{ flex: 1, minWidth: 220 }}>
        <Text size="sm" fw={600}>{label}</Text>
        <Text size="xs" c="dimmed">{description}</Text>
      </Stack>
      {children}
    </Group>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }} p="xl" radius="lg">
      <Stack gap="xs" mb="lg">
        <Text fw={700} size="md">{title}</Text>
        <Text size="sm" c="dimmed">{description}</Text>
      </Stack>
      {children}
    </Card>
  );
}

export function AiSettingsSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['platform-ai-settings'], queryFn: () => bff<AiSettingsResponse>('admin/settings/ai') });
  const [local, setLocal] = useState<AiSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [days, setDays] = useState('30');
  const [rate, setRate] = useState<number | string>(1500);

  useEffect(() => {
    if (q.data && !dirty) setLocal(q.data.settings);
  }, [q.data, dirty]);

  const usage = useQuery({ queryKey: ['platform-ai-usage', days], queryFn: () => bff<Usage>(`admin/ai/usage?days=${days}`) });

  const save = useMutation({
    mutationFn: (settings: AiSettings) => bff<AiSettingsResponse>('admin/settings/ai', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }),
    onSuccess: () => {
      notifications.show({ message: 'AI settings saved. They apply to the next request.', color: 'green' });
      qc.invalidateQueries({ queryKey: ['platform-ai-settings'] });
      setDirty(false);
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  function set(change: Partial<AiSettings>) {
    setLocal((prev) => (prev ? { ...prev, ...change } : prev));
    setDirty(true);
  }
  const num = (v: number | string, fallback: number) => (typeof v === 'number' ? v : fallback);

  if (q.isError) return <Alert color="red" icon={<IconAlertTriangle size={16} />}>{(q.error as Error).message}</Alert>;
  if (q.isLoading || !local) return <Skeleton h={320} radius="lg" />;

  const fx = typeof rate === 'number' && rate > 0 ? rate : 0;
  const t = usage.data?.totals;

  return (
    <Stack gap="xl">
      <Panel title="AI assistant" description="The model, what it costs your clients and how much they get free each day. Changes apply from the next request, with no release needed.">
        <Stack gap="md">
          <Row label="Assistant switched on" description="Turn off to stop the assistant for every association at once, for example if the provider bill is unpaid.">
            <Switch checked={local.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} size="sm" />
          </Row>
          <Divider />
          <Row label="Model" description="The OpenRouter model id, for example deepseek/deepseek-chat. Check the model's price on OpenRouter before changing it.">
            <TextInput value={local.model} onChange={(e) => set({ model: e.currentTarget.value })} w={280} size="sm" />
          </Row>
          <Divider />
          <Row label="Longest answer" description="The most the model may write in one answer. It is what keeps the cost of one request bounded.">
            <NumberInput value={local.maxOutputTokens} onChange={(v) => set({ maxOutputTokens: num(v, 1500) })} min={200} max={8000} allowDecimal={false} suffix=" tokens" w={160} size="sm" />
          </Row>
        </Stack>
      </Panel>

      <Panel title="Credits and prices" description="What a client pays when the day's free requests are used up. Bought credits never expire.">
        <Stack gap="md">
          <Row label="Price of one credit" description="One question or one reminder list costs one credit; a report costs more (below).">
            <NumberInput value={local.creditPriceNaira} onChange={(v) => set({ creditPriceNaira: num(v, 20) })} min={1} decimalScale={2} fixedDecimalScale prefix="₦" w={160} size="sm" />
          </Row>
          <Divider />
          <Row label="Smallest purchase" description="The least one purchase can be, so Paystack's fee stays small against what the client pays.">
            <NumberInput value={local.minPurchaseNaira} onChange={(v) => set({ minPurchaseNaira: num(v, 3000) })} min={100} decimalScale={2} fixedDecimalScale thousandSeparator="," prefix="₦" w={160} size="sm" />
          </Row>
        </Stack>
      </Panel>

      <Panel title="Daily free requests" description="Each association gets this many requests free every day, by plan. The count starts again at midnight, Lagos time.">
        <Stack gap="md">
          {(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const).map((tier, i) => (
            <div key={tier}>
              {i > 0 && <Divider mb="md" />}
              <Row label={tier === 'STARTER' ? 'Starter' : tier === 'PROFESSIONAL' ? 'Pro' : 'Enterprise'} description="Requests per day, free.">
                <NumberInput value={local.allowances[tier]} onChange={(v) => set({ allowances: { ...local.allowances, [tier]: num(v, 0) } })} min={0} allowDecimal={false} w={160} size="sm" />
              </Row>
            </div>
          ))}
        </Stack>
      </Panel>

      <Panel title="What each request costs" description="In requests (credits). A report reads far more data and writes far more than a question, so it costs more.">
        <Stack gap="md">
          {(['question', 'reminders', 'report'] as const).map((kind, i) => (
            <div key={kind}>
              {i > 0 && <Divider mb="md" />}
              <Row label={kind === 'question' ? 'A question' : kind === 'reminders' ? 'A reminders list' : 'A report'} description="Requests taken from the allowance or the credits.">
                <NumberInput value={local.weights[kind]} onChange={(v) => set({ weights: { ...local.weights, [kind]: num(v, 1) } })} min={1} max={100} allowDecimal={false} w={160} size="sm" />
              </Row>
            </div>
          ))}
        </Stack>
      </Panel>

      <Group justify="flex-end" gap="sm">
        {dirty && (
          <Button variant="default" size="sm" disabled={save.isPending} onClick={() => { setLocal(q.data!.settings); setDirty(false); }}>
            Discard
          </Button>
        )}
        <Button size="sm" leftSection={<IconCheck size={14} />} disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(local)}>
          Save AI settings
        </Button>
      </Group>

      <Panel title="AI cost against credits sold" description="What each association's AI use cost you (the model's bill, in dollars) against what it paid for credits (naira). Use it to see whether the prices cover the model.">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap" gap="md">
            <SegmentedControl value={days} onChange={setDays} size="xs" data={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
            <Group gap="xs">
              <Text size="xs" c="dimmed">Naira per dollar</Text>
              <NumberInput value={rate} onChange={setRate} min={1} allowDecimal={false} thousandSeparator="," prefix="₦" w={120} size="xs" />
            </Group>
          </Group>

          {usage.isLoading ? (
            <Skeleton h={160} radius="md" />
          ) : usage.isError ? (
            <Alert color="red" icon={<IconAlertTriangle size={16} />}>{(usage.error as Error).message}</Alert>
          ) : !usage.data || usage.data.rows.length === 0 ? (
            <Text size="sm" c="dimmed">No AI use or credit sales in this period.</Text>
          ) : (
            <>
              {t && (
                <Group gap="xl" wrap="wrap">
                  <Stack gap={0}><Text size="xs" c="dimmed">Model cost</Text><Text fw={700}>{dollars(t.costUsd)}{fx ? ` · ${naira(t.costUsd * fx)}` : ''}</Text></Stack>
                  <Stack gap={0}><Text size="xs" c="dimmed">Credits sold</Text><Text fw={700}>{t.creditsSold.toLocaleString('en-NG')} · {naira(t.revenueNaira)}</Text></Stack>
                  {fx > 0 && <Stack gap={0}><Text size="xs" c="dimmed">Credit sales less model cost</Text><Text fw={700} c={t.revenueNaira - t.costUsd * fx >= 0 ? 'green' : 'red'}>{naira(t.revenueNaira - t.costUsd * fx)}</Text></Stack>}
                </Group>
              )}
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="xs" fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Association</Table.Th>
                      <Table.Th ta="right">Requests</Table.Th>
                      <Table.Th ta="right">Free used</Table.Th>
                      <Table.Th ta="right">Credits used</Table.Th>
                      <Table.Th ta="right">Model cost</Table.Th>
                      <Table.Th ta="right">Credits sold</Table.Th>
                      <Table.Th ta="right">Paid</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {usage.data.rows.map((r) => (
                      <Table.Tr key={r.associationId}>
                        <Table.Td>{r.associationName}</Table.Td>
                        <Table.Td ta="right">{r.requests.toLocaleString('en-NG')}</Table.Td>
                        <Table.Td ta="right">{r.allowanceUnits.toLocaleString('en-NG')}</Table.Td>
                        <Table.Td ta="right">{r.creditUnits.toLocaleString('en-NG')}</Table.Td>
                        <Table.Td ta="right">{dollars(r.costUsd)}</Table.Td>
                        <Table.Td ta="right">{r.creditsSold.toLocaleString('en-NG')}</Table.Td>
                        <Table.Td ta="right">{naira(r.revenueNaira)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </>
          )}
        </Stack>
      </Panel>
    </Stack>
  );
}
