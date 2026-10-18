'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  SimpleGrid, Card, Stack, Group, Text, Button,
  Table, Collapse, Skeleton, Alert, Badge, TextInput,
} from '@mantine/core';
import {
  IconDownload, IconChevronDown, IconChevronRight,
  IconCurrencyDollar, IconActivity, IconAlertCircle,
} from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentDetail {
  id: number;
  reference: string;
  amount: number;
  provider: string;
  completedAt: string;
  memberName: string;
  memberEmail: string | null;
  transactionRef: string | null;
  category: string | null;
}

interface Settlement {
  associationId: number;
  associationName: string;
  subdomain: string;
  totalTransactions: number;
  totalAmount: number;
  amountToTransfer: number;
  platformFee: number;
  payments?: PaymentDetail[];
}

interface Totals {
  totalTransactions: number;
  totalAmount: number;
  amountToTransfer: number;
  platformFee: number;
}

interface SettlementsResponse {
  settlements: Settlement[];
  totals: Totals;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function exportCsv(settlements: Settlement[], totals: Totals, date: string) {
  const rows = [
    ['Association', 'Subdomain', 'Transactions', 'Total Amount', 'Transfer (98%)', 'Platform Fee (2%)'],
    ...settlements.map((s) => [
      s.associationName, s.subdomain, s.totalTransactions,
      s.totalAmount, s.amountToTransfer, s.platformFee,
    ]),
    [],
    ['TOTALS', '', totals.totalTransactions, totals.totalAmount, totals.amountToTransfer, totals.platformFee],
  ];
  const csv = rows.map((r) => r.join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `settlements-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Settlement row ─────────────────────────────────────────────────────────────

function SettlementRow({ s }: { s: Settlement }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
      p="md"
      radius="md"
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Stack gap={2} style={{ flex: 1 }}>
          <Text fw={600}>{s.associationName}</Text>
          <Text size="xs" c="dimmed">
            {s.subdomain} · {s.totalTransactions} transaction{s.totalTransactions !== 1 ? 's' : ''}
          </Text>
        </Stack>

        <Group gap="lg" wrap="wrap">
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="dimmed">Total</Text>
            <Text fw={600} size="sm">{fmtCurrency(s.totalAmount)}</Text>
          </Stack>
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="dimmed">Transfer (98%)</Text>
            <Text fw={600} size="sm" c="green">{fmtCurrency(s.amountToTransfer)}</Text>
          </Stack>
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="dimmed">Fee (2%)</Text>
            <Text fw={600} size="sm" c="violet">{fmtCurrency(s.platformFee)}</Text>
          </Stack>
          <Button
            variant="default"
            size="xs"
            rightSection={expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide' : 'Details'}
          </Button>
        </Group>
      </Group>

      <Collapse in={expanded} mt="md">
        {s.payments?.length ? (
          <Table.ScrollContainer minWidth={520}>
            <Table fz="xs" withTableBorder withColumnBorders={false} verticalSpacing={4}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Reference</Table.Th>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                  <Table.Th>Time</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {s.payments.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td style={{ fontFamily: 'monospace' }} c="dimmed">{p.reference}</Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={500}>{p.memberName}</Text>
                      {p.memberEmail && <Text size="xs" c="dimmed">{p.memberEmail}</Text>}
                    </Table.Td>
                    <Table.Td c="dimmed">{p.category ?? '—'}</Table.Td>
                    <Table.Td ta="right" fw={600}>{fmtCurrency(p.amount)}</Table.Td>
                    <Table.Td c="dimmed">{fmtDateTime(p.completedAt)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <Text size="sm" c="dimmed">No payment details available.</Text>
        )}
      </Collapse>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettlementsPage() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);

  const q = useQuery({
    queryKey: ['settlements', selectedDate],
    queryFn: () =>
      bff<SettlementsResponse>(`admin/payment-settlements/daily?date=${selectedDate}`),
  });

  const settlements = q.data?.settlements ?? [];
  const totals = q.data?.totals;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Payment Settlements"
        description="Daily breakdown of payments to settle with each association"
        actions={
          <Group gap="sm">
            <TextInput
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.currentTarget.value)}
              max={today}
              size="sm"
              w={160}
            />
            <Button
              variant="default"
              size="sm"
              leftSection={<IconDownload size={14} />}
              disabled={!totals || settlements.length === 0}
              onClick={() => totals && exportCsv(settlements, totals, selectedDate)}
            >
              Export CSV
            </Button>
          </Group>
        }
      />

      {/* Summary cards */}
      {q.isLoading ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} radius="lg" />)}
        </SimpleGrid>
      ) : totals ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <StatCard
            label="Total Transactions"
            value={totals.totalTransactions.toLocaleString()}
            icon={<IconActivity size={16} />}
          />
          <StatCard
            label="Total Amount"
            value={fmtCurrency(totals.totalAmount)}
            icon={<IconCurrencyDollar size={16} />}
          />
          <StatCard
            label="To Transfer (98%)"
            value={fmtCurrency(totals.amountToTransfer)}
            icon={<IconCurrencyDollar size={16} />}
          />
          <StatCard
            label="Platform Fee (2%)"
            value={fmtCurrency(totals.platformFee)}
            icon={<IconCurrencyDollar size={16} />}
          />
        </SimpleGrid>
      ) : null}

      {/* Settlement list */}
      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Stack gap="sm">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={72} radius="md" />)}
        </Stack>
      ) : settlements.length === 0 ? (
        <Card
          style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
          p="xl"
          radius="lg"
          ta="center"
        >
          <Text c="dimmed">No payments for {selectedDate}</Text>
          <Text size="xs" c="dimmed" mt={4}>Try selecting a different date</Text>
        </Card>
      ) : (
        <Stack gap="sm">
          {settlements.map((s) => (
            <SettlementRow key={s.associationId} s={s} />
          ))}
        </Stack>
      )}

      {/* Instructions */}
      {settlements.length > 0 && (
        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" radius="md">
          <Text size="sm" fw={600} mb={4}>Settlement instructions</Text>
          <Stack gap={2}>
            {[
              'Review the settlements for the selected date',
              'Transfer the "Transfer (98%)" amount to each association\'s bank account',
              'Keep the "Platform Fee (2%)" in your account',
              `Use reference format: SETTLE-${selectedDate}-[AssocID]`,
              'Export CSV for your records',
            ].map((step, i) => (
              <Text key={i} size="xs">
                {i + 1}. {step}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
