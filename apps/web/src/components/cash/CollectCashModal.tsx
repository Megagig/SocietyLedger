'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Anchor, Badge, Button, Card, Group, Loader, Modal, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { CheckCircle2 } from 'lucide-react';
import { cashApi, cashErrorCode, cashErrorMessage, formatNaira, type CashPayables, type CashReceipt } from '@/lib/api/cash';
import { membersApi, type Member } from '@/lib/api/members';
import {
  buildReceiptDraft,
  GROUP_TITLES,
  ITEM_KIND_LABELS,
  newIdempotencyKey,
  payableRows,
  type DonationEntry,
  type PayableRow,
} from '@/lib/cash-receipt';

/**
 * CA5 — Collect cash: pick the member, enter what they hand over against what they owe or could put aside, and record one
 * receipt. Safe to retry: a receipt that failed to save stays here with "Not saved — Retry", and a retry never credits the
 * member twice.
 */
export function CollectCashModal({ collectionId, opened, onClose, onRecorded }: { collectionId: number; opened: boolean; onClose: () => void; onRecorded: () => void }) {
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [payables, setPayables] = useState<CashPayables | null>(null);
  const [loadingPayables, setLoadingPayables] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [donation, setDonation] = useState<DonationEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{ message: string; partial: boolean } | null>(null);
  const [done, setDone] = useState<CashReceipt | null>(null);
  // One key per distinct receipt: a pure retry reuses it (so it can't credit twice), an edited receipt gets a fresh one.
  const keyRef = useRef({ signature: '', key: '' });

  // Search the directory as the officer types.
  useEffect(() => {
    if (!opened) return;
    const handle = setTimeout(() => {
      membersApi
        .getMembers({ search: search.trim() || undefined, limit: 15, status: 'active' })
        .then((result) => setMembers(result.members))
        .catch(() => setMembers([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [search, opened]);

  useEffect(() => {
    setPayables(null);
    setAmounts({});
    setDonation(null);
    setFailure(null);
    if (!memberId) return;
    setLoadingPayables(true);
    cashApi
      .getPayables(Number(memberId))
      .then(setPayables)
      .catch((error) => setFailure({ message: cashErrorMessage(error, 'Could not load what this member can pay.'), partial: false }))
      .finally(() => setLoadingPayables(false));
  }, [memberId]);

  const rows = useMemo(() => (payables ? payableRows(payables) : []), [payables]);
  const draft = useMemo(() => buildReceiptDraft(rows, amounts, donation), [rows, amounts, donation]);
  const hasProblems = Object.keys(draft.problems).length > 0;
  const categories = payables?.donations.categories ?? [];
  const allocations = payables?.donations.allocations ?? [];
  const hasAnythingToPay = rows.length > 0 || categories.length > 0;

  const reset = () => {
    setMemberId(null);
    setSearch('');
    setAmounts({});
    setDonation(null);
    setFailure(null);
    setDone(null);
    keyRef.current = { signature: '', key: '' };
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!memberId || draft.items.length === 0 || hasProblems) return;
    const signature = JSON.stringify({ memberId, items: draft.items });
    if (keyRef.current.signature !== signature) keyRef.current = { signature, key: newIdempotencyKey() };

    setSaving(true);
    setFailure(null);
    try {
      const receipt = await cashApi.recordReceipt(collectionId, { memberId: Number(memberId), idempotencyKey: keyRef.current.key, items: draft.items });
      setDone(receipt);
      onRecorded();
    } catch (error) {
      const partial = cashErrorCode(error) === 'PARTIALLY_RECORDED';
      setFailure({ message: cashErrorMessage(error, 'We could not reach the server. Nothing was saved.'), partial });
      if (partial) onRecorded();
    } finally {
      setSaving(false);
    }
  };

  const memberOptions = members.map((m) => ({ value: String(m.id), label: `${m.firstName} ${m.lastName} · ${m.memberId}` }));
  const grouped = (['charges', 'loans', 'savings', 'welfare'] as const)
    .map((group) => ({ group, rows: rows.filter((r) => r.group === group) }))
    .filter((g) => g.rows.length > 0);

  // A render function, not a component: a component defined here would remount on every keystroke and drop the input focus.
  const amountBox = (row: PayableRow) => (
    <Group gap="xs" wrap="nowrap" justify="flex-end">
      {row.suggested && !(amounts[row.key] ?? '') ? (
        <Anchor size="xs" component="button" type="button" onClick={() => setAmounts((a) => ({ ...a, [row.key]: String(row.suggested) }))}>
          Fill {formatNaira(row.suggested)}
        </Anchor>
      ) : null}
      <TextInput
        w={150}
        leftSection="₦"
        placeholder="0"
        inputMode="decimal"
        value={amounts[row.key] ?? ''}
        onChange={(e) => {
          // Read the value now: React clears the event before a state updater runs.
          const text = e.currentTarget.value.replace(/[^0-9.,]/g, '');
          setAmounts((a) => ({ ...a, [row.key]: text }));
        }}
        error={draft.problems[row.label]}
        aria-label={`Amount for ${row.label}`}
      />
    </Group>
  );

  return (
    <Modal opened={opened} onClose={close} title={done ? 'Receipt' : 'Collect cash'} size="lg">
      {done ? (
        <Stack align="center" gap="md">
          <CheckCircle2 size={48} color="var(--mantine-color-green-6)" />
          <Title order={3}>Cash received</Title>
          <Text size="xl" fw={700}>
            {formatNaira(done.total)}
          </Text>
          <Text c="dimmed">
            {done.member.name} · {done.receiptNumber}
          </Text>
          <Table>
            <Table.Tbody>
              {done.items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    {item.label}
                    <Text size="xs" c="dimmed">
                      {ITEM_KIND_LABELS[item.kind]}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {formatNaira(item.amount)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed">
            The member has been credited and told. Keep the cash safe until you lodge it.
          </Text>
          <Group>
            <Button variant="default" onClick={close}>
              Done
            </Button>
            <Button onClick={reset}>Collect from another member</Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="md">
          <Select
            label="Member"
            placeholder="Search by name, member ID, email or phone"
            data={memberOptions}
            value={memberId}
            onChange={setMemberId}
            onSearchChange={setSearch}
            searchValue={search}
            searchable
            clearable
            nothingFoundMessage="No member found"
            filter={({ options }) => options}
          />

          {loadingPayables ? <Loader size="sm" /> : null}

          {memberId && payables && !hasAnythingToPay ? (
            <Text size="sm" c="dimmed">
              This member has nothing outstanding and no savings, welfare fund or donation category to pay into.
            </Text>
          ) : null}

          {grouped.map(({ group, rows: groupRows }) => (
            <Card key={group} withBorder padding="sm">
              <Title order={5} mb="xs">
                {GROUP_TITLES[group]}
              </Title>
              <Stack gap="xs">
                {groupRows.map((row) => (
                  <Group key={row.key} justify="space-between" wrap="nowrap" align="flex-start">
                    <div>
                      <Text fw={500}>{row.label}</Text>
                      <Text size="xs" c="dimmed">
                        {row.hint}
                      </Text>
                    </div>
                    {amountBox(row)}
                  </Group>
                ))}
              </Stack>
            </Card>
          ))}

          {categories.length > 0 ? (
            <Card withBorder padding="sm">
              <Title order={5} mb="xs">
                Donation
              </Title>
              <Stack gap="xs">
                <Group grow>
                  {categories.length > 1 ? (
                    <Select
                      label="Category"
                      data={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                      value={String(donation?.categoryId ?? categories[0]!.id)}
                      onChange={(v) => setDonation((d) => ({ categoryId: Number(v), allocationId: d?.allocationId ?? null, amount: d?.amount ?? '' }))}
                    />
                  ) : null}
                  {allocations.length > 0 ? (
                    <Select
                      label="For"
                      placeholder="General fund"
                      clearable
                      data={allocations.map((a) => ({ value: String(a.id), label: a.name }))}
                      value={donation?.allocationId ? String(donation.allocationId) : null}
                      onChange={(v) => setDonation((d) => ({ categoryId: d?.categoryId ?? categories[0]!.id, allocationId: v ? Number(v) : null, amount: d?.amount ?? '' }))}
                    />
                  ) : null}
                </Group>
                <TextInput
                  label="Amount"
                  leftSection="₦"
                  placeholder="0"
                  inputMode="decimal"
                  value={donation?.amount ?? ''}
                  onChange={(e) => {
                    const text = e.currentTarget.value.replace(/[^0-9.,]/g, '');
                    setDonation((d) => ({ categoryId: d?.categoryId ?? categories[0]!.id, allocationId: d?.allocationId ?? null, amount: text }));
                  }}
                  error={draft.problems.Donation}
                />
              </Stack>
            </Card>
          ) : null}

          {failure ? (
            <Alert color="red" title={failure.partial ? 'Part of this receipt was saved' : 'Not saved'}>
              {failure.message}
              {failure.partial ? (
                <Group mt="sm">
                  <Button size="xs" variant="default" onClick={close}>
                    Check the collection
                  </Button>
                </Group>
              ) : null}
            </Alert>
          ) : null}

          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed">
                Total received
              </Text>
              <Text size="xl" fw={700}>
                {formatNaira(draft.total)}
              </Text>
            </div>
            <Group>
              <Button variant="default" onClick={close}>
                Cancel
              </Button>
              <Button loading={saving} disabled={!memberId || draft.items.length === 0 || hasProblems || (failure?.partial ?? false)} onClick={submit}>
                {failure && !failure.partial ? 'Not saved — Retry' : 'Record receipt'}
              </Button>
            </Group>
          </Group>
          {draft.items.length > 0 && !failure ? (
            <Badge variant="light" color="gray">
              {draft.items.length} payment{draft.items.length === 1 ? '' : 's'} on this receipt
            </Badge>
          ) : null}
        </Stack>
      )}
    </Modal>
  );
}
