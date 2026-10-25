'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, FileInput, Group, Modal, Select, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { nigerianPaymentsApi, type ColumnKey, type ColumnMapping, type StatementPreview } from '@/lib/api/nigerian-payments';

const money = (value: unknown) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value) || 0);
const day = (value: string) => new Date(value).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

const COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'credit', label: 'Money in (credit)' },
  { key: 'debit', label: 'Money out (debit)' },
  { key: 'amount', label: 'One amount column' },
  { key: 'reference', label: 'Reference' },
  { key: 'balance', label: 'Balance' },
];
const NONE = '-';
const SOURCE = { saved: 'Remembered from this bank account’s last statement', detected: 'Recognised from the file', manual: 'Set by you' } as const;

const errorText = (error: unknown, fallback: string) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/**
 * Import a bank statement: choose the bank account and the file (CSV or Excel), check how its columns were read, and import only
 * the lines that are new. The server reads the file and shows what it understood before anything is saved.
 */
export function StatementImporter({ onImported }: { onImported?: () => void }) {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [choices, setChoices] = useState<Partial<Record<ColumnKey, string>>>({});
  const [confirming, setConfirming] = useState(false);

  const accounts = useQuery({ queryKey: ['bank-accounts', 'active'], queryFn: () => nigerianPaymentsApi.getBankAccounts() });
  const options = (accounts.data ?? []).filter((a) => a.isActive).map((a) => ({ value: String(a.id), label: `${a.bankName} · ${a.accountNumber}` }));
  const account = accountId ?? (options.length === 1 ? options[0]!.value : null);

  const toMapping = (c: Partial<Record<ColumnKey, string>>): ColumnMapping => {
    const mapping: ColumnMapping = {};
    for (const [key, value] of Object.entries(c) as Array<[ColumnKey, string]>) if (value && value !== NONE) mapping[key] = Number(value);
    return mapping;
  };

  const read = useMutation({
    mutationFn: (vars: { file: File; account: string; mapping?: ColumnMapping; headerRow?: number }) =>
      nigerianPaymentsApi.previewStatement({ bankAccountId: Number(vars.account), file: vars.file, mapping: vars.mapping, headerRow: vars.headerRow }),
    onSuccess: (data) => {
      setPreview(data);
      const next: Partial<Record<ColumnKey, string>> = {};
      for (const c of COLUMNS) next[c.key] = data.layout.mapping[c.key] === undefined ? NONE : String(data.layout.mapping[c.key]);
      setChoices(next);
    },
    onError: () => setPreview(null),
  });

  const save = useMutation({
    mutationFn: () =>
      nigerianPaymentsApi.importStatement({
        bankAccountId: Number(account),
        file: file!,
        mapping: preview?.layout.source === 'manual' ? toMapping(choices) : undefined,
        headerRow: preview?.layout.headerRow,
      }),
    onSuccess: (result) => {
      setConfirming(false);
      notifications.show({
        title: 'Statement imported',
        message: `${result.entriesCreated} ${result.entriesCreated === 1 ? 'line' : 'lines'} added${result.alreadyImported > 0 ? `, ${result.alreadyImported} were already imported` : ''}.`,
        color: 'green',
      });
      setFile(null);
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      onImported?.();
    },
    onError: (error) => {
      setConfirming(false);
      notifications.show({ title: 'Could not import', message: errorText(error, 'Could not import the statement. Try again.'), color: 'red' });
    },
  });

  const pick = (next: File | null) => {
    setFile(next);
    setPreview(null);
    if (next && account) read.mutate({ file: next, account });
  };

  const headerOptions = [{ value: NONE, label: 'Not in this file' }, ...(preview?.layout.headers ?? []).map((h, i) => ({ value: String(i), label: h || `Column ${i + 1}` }))];
  const change = (key: ColumnKey, value: string | null) => {
    const next = { ...choices, [key]: value ?? NONE };
    setChoices(next);
    if (file && account && preview) read.mutate({ file, account, mapping: toMapping(next), headerRow: preview.layout.headerRow });
  };

  const counts = preview?.counts;
  const readError = read.isError ? errorText(read.error, 'Could not read this file. Try again.') : '';

  return (
    <Stack gap="lg">
      <Card withBorder padding="lg">
        <Stack gap="md">
          <Text fw={600}>Which statement</Text>
          <Select
            label="Bank account"
            placeholder={options.length === 0 ? 'Add a bank account first' : 'Choose the account'}
            data={options}
            value={account}
            onChange={(v) => {
              setAccountId(v);
              if (file && v) read.mutate({ file, account: v });
            }}
            data-testid="import-account"
          />
          <FileInput
            label="Statement file"
            description="A CSV or Excel (.xlsx) statement downloaded from your bank. PDF statements can’t be read reliably."
            placeholder="Choose the file"
            accept=".csv,.txt,.xlsx"
            value={file}
            onChange={pick}
            clearable
          />
          {read.isPending ? <Text size="sm" c="dimmed">Reading the statement…</Text> : null}
          {readError ? <Alert color="red" title="This file could not be read">{readError}</Alert> : null}
        </Stack>
      </Card>

      {preview && counts ? (
        <>
          <Card withBorder padding="lg">
            <Text fw={600} mb="sm">What we found</Text>
            <Group gap="xl" wrap="wrap">
              <div><Text size="xs" c="dimmed">Lines in the file</Text><Text fw={700}>{counts.lines}</Text></div>
              <div><Text size="xs" c="dimmed">Money received</Text><Text fw={700}>{counts.credits}</Text></div>
              <div><Text size="xs" c="dimmed">Already imported</Text><Text fw={700}>{counts.alreadyImported}</Text></div>
              <div><Text size="xs" c="dimmed">New lines</Text><Text fw={700} c={counts.newLines > 0 ? 'green' : 'orange'}>{counts.newLines}</Text></div>
              {counts.newCreditTotal ? <div><Text size="xs" c="dimmed">New money received</Text><Text fw={700} c="green">{money(counts.newCreditTotal)}</Text></div> : null}
              {preview.period.startDate && preview.period.endDate ? <div><Text size="xs" c="dimmed">Period</Text><Text fw={700}>{day(preview.period.startDate)} to {day(preview.period.endDate)}</Text></div> : null}
            </Group>
            {counts.unreadable > 0 ? (
              <Alert color="yellow" mt="md">
                {counts.unreadable} {counts.unreadable === 1 ? 'line' : 'lines'} couldn’t be read and will be left out.{preview.unreadableRows[0] ? ` For example, row ${preview.unreadableRows[0].row}: ${preview.unreadableRows[0].reason}` : ''}
              </Alert>
            ) : null}
            {counts.newLines === 0 && preview.problems.length === 0 ? <Alert color="blue" mt="md">Every line in this file was imported before, so there is nothing to add.</Alert> : null}
          </Card>

          <Card withBorder padding="lg">
            <Group justify="space-between" mb="xs">
              <Text fw={600}>How the columns were read</Text>
              <Badge variant="light">{SOURCE[preview.layout.source]}</Badge>
            </Group>
            <Text size="sm" c="dimmed" mb="md">Change a column if it is wrong.</Text>
            {preview.problems.map((p) => <Alert key={p} color="red" mb="sm">{p}</Alert>)}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COLUMNS.map((c) => (
                <Select key={c.key} label={c.label} data={headerOptions} value={choices[c.key] ?? NONE} onChange={(v) => change(c.key, v)} allowDeselect={false} />
              ))}
            </div>
          </Card>

          {preview.sample.length > 0 ? (
            <Card withBorder padding="lg" className="overflow-x-auto">
              <Text fw={600} mb="sm">The first lines</Text>
              <Table striped>
                <Table.Thead>
                  <Table.Tr><Table.Th>Date</Table.Th><Table.Th>Description</Table.Th><Table.Th>Reference</Table.Th><Table.Th ta="right">In</Table.Th><Table.Th ta="right">Out</Table.Th></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {preview.sample.map((s) => (
                    <Table.Tr key={s.row}>
                      <Table.Td>{day(s.transactionDate)}</Table.Td>
                      <Table.Td>{s.description}</Table.Td>
                      <Table.Td>{s.reference ?? '—'}</Table.Td>
                      <Table.Td ta="right" c="green">{s.creditAmount ? money(s.creditAmount) : ''}</Table.Td>
                      <Table.Td ta="right">{s.debitAmount ? money(s.debitAmount) : ''}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          ) : null}

          <Group justify="flex-end">
            <Button disabled={!preview.canImport} loading={save.isPending} onClick={() => setConfirming(true)}>
              {counts.newLines > 0 ? `Import ${counts.newLines} ${counts.newLines === 1 ? 'line' : 'lines'}` : 'Import statement'}
            </Button>
          </Group>
        </>
      ) : null}

      <Modal opened={confirming} onClose={() => setConfirming(false)} title="Import this statement?" centered>
        <Stack>
          <Text size="sm">
            {counts?.newLines} new {counts?.newLines === 1 ? 'line' : 'lines'} will be added
            {counts && counts.alreadyImported > 0 ? ` and ${counts.alreadyImported} that were imported before will be skipped` : ''}. Nothing is recorded as a payment until a match is confirmed.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirming(false)}>Not yet</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>Import</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
