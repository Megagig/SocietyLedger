'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Checkbox, FileInput, Group, LoadingOverlay, Select, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { Upload } from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { cashApi, cashErrorMessage, formatNaira, type CashLodgable } from '@/lib/api/cash';
import { parseNaira } from '@/lib/cash-receipt';
import { nigerianPaymentsApi, type BankAccount } from '@/lib/api/nigerian-payments';
import { CashNav } from '@/components/cash/CashNav';
import { HelpLink } from '@/components/docs/HelpLink';

/**
 * CA6 — Lodge cash: record cash you paid into a bank account, with a photo of the slip. Another officer checks it against the
 * bank statement; until then it shows as "lodged, awaiting check" and is out of your hands.
 */
export default function LodgeCashPage() {
  const router = useRouter();
  const [lodgable, setLodgable] = useState<CashLodgable | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [depositDate, setDepositDate] = useState<Date | null>(new Date());
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [slip, setSlip] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([cashApi.getLodgable(), nigerianPaymentsApi.getBankAccounts()])
      .then(([l, a]) => {
        setLodgable(l);
        const active = a.filter((x) => x.isActive);
        setAccounts(active);
        const preferred = active.find((x) => x.isDefault) ?? active[0];
        if (preferred) setAccountId(String(preferred.id));
      })
      .catch((error) => notifications.show({ title: 'Could not load', message: cashErrorMessage(error, 'Try again.'), color: 'red' }))
      .finally(() => setLoading(false));
  }, []);

  const collections = lodgable?.collections ?? [];
  const chosen = collections.filter((c) => !excluded.includes(c.id));
  const expected = Math.round(chosen.reduce((sum, c) => sum + c.remaining, 0) * 100) / 100;

  // Until the officer types their own figure, the amount follows what they should lodge.
  useEffect(() => {
    if (!amountTouched) setAmount(expected > 0 ? String(expected) : '');
  }, [expected, amountTouched]);

  const parsed = parseNaira(amount);
  const short = parsed !== null ? Math.max(0, Math.round((expected - parsed) * 100) / 100) : 0;
  const problem = useMemo(() => {
    if (chosen.length === 0) return 'Choose at least one collection to lodge.';
    if (!accountId) return 'Choose the account you paid into.';
    if (parsed === null) return 'Enter the amount you paid in, above ₦0.';
    if (parsed > expected + 0.001) return `You can lodge at most ${formatNaira(expected)} — that is all the cash you hold.`;
    if (short > 0 && !reason.trim()) return 'You are lodging less than you collected. Say why.';
    if (!depositDate) return 'Choose the date you paid it in.';
    if (!slip) return 'Attach a photo of the deposit slip.';
    return null;
  }, [chosen.length, accountId, parsed, expected, short, reason, depositDate, slip]);

  const submit = async () => {
    if (problem || parsed === null || !slip || !depositDate || !accountId) {
      notifications.show({ title: 'Not ready yet', message: problem ?? 'Check the details.', color: 'red' });
      return;
    }
    setSaving(true);
    try {
      const created = await cashApi.recordLodgment({
        bankAccountId: Number(accountId),
        amount: parsed,
        depositDate: depositDate.toISOString(),
        bankReference: reference.trim() || undefined,
        shortfallReason: reason.trim() || undefined,
        collectionIds: excluded.length > 0 ? chosen.map((c) => c.id) : undefined,
        slip,
      });
      notifications.show({ title: 'Lodgment recorded', message: 'Another officer will check it against the bank statement.', color: 'green' });
      router.push(`/dashboard/cash/lodgments/${created.id}`);
    } catch (error) {
      notifications.show({ title: 'Could not record the lodgment', message: cashErrorMessage(error, 'Try again.'), color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Can permission={PERMISSIONS.CASH_LODGE}>
      <Stack gap="lg" maw={720}>
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Lodge cash</Title>
            <Text size="sm" c="dimmed">
              Pay the cash into one of your association&apos;s bank accounts first, then record it here with a photo of the deposit slip. Another officer will check it against the
              bank statement.
            </Text>
          </div>
          <HelpLink />
        </Group>

        <CashNav />

        <div style={{ position: 'relative', minHeight: 120 }}>
          <LoadingOverlay visible={loading} />
          {!loading && collections.length === 0 ? (
            <Alert color="blue" title="No cash to lodge">
              Close a collection first — cash from an open collection can&apos;t be lodged until you close it.
            </Alert>
          ) : null}
          {!loading && collections.length > 0 && accounts.length === 0 ? (
            <Alert color="yellow" title="No bank account yet">
              Ask the administrator to add the association&apos;s bank account under Payments → Bank Accounts, then lodge the cash.
            </Alert>
          ) : null}

          {collections.length > 0 && accounts.length > 0 ? (
            <Stack gap="md">
              <Card withBorder padding="lg">
                <Title order={4} mb="sm">
                  Cash you are lodging
                </Title>
                <Stack gap="xs">
                  {collections.map((c) => (
                    <Checkbox
                      key={c.id}
                      checked={!excluded.includes(c.id)}
                      onChange={() => setExcluded((current) => (current.includes(c.id) ? current.filter((x) => x !== c.id) : [...current, c.id]))}
                      label={`${c.title} · ${formatNaira(c.remaining)}`}
                    />
                  ))}
                </Stack>
                <Group justify="space-between" mt="md">
                  <Text size="sm" c="dimmed">
                    You should lodge
                  </Text>
                  <Text fw={700} size="lg">
                    {formatNaira(expected)}
                  </Text>
                </Group>
              </Card>

              <Card withBorder padding="lg">
                <Title order={4} mb="sm">
                  The deposit
                </Title>
                <Stack gap="md">
                  <Select
                    label="Paid into"
                    data={accounts.map((a) => ({ value: String(a.id), label: `${a.bankName} · ${a.accountNumber}${a.isDefault ? ' (default)' : ''}` }))}
                    value={accountId}
                    onChange={setAccountId}
                  />
                  <TextInput
                    label="Amount you paid in"
                    description="What the deposit slip shows."
                    leftSection="₦"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      setAmountTouched(true);
                      setAmount(e.currentTarget.value.replace(/[^0-9.,]/g, ''));
                    }}
                  />
                  {short > 0 ? (
                    <Alert color="yellow" title={`${formatNaira(short)} short of what you collected`}>
                      <Textarea label="Why is it short?" placeholder="For example: ₦2,000 spent on refreshments, receipt kept" value={reason} onChange={(e) => setReason(e.currentTarget.value)} autosize minRows={2} />
                    </Alert>
                  ) : null}
                  <DatePickerInput label="Date paid in" value={depositDate} onChange={setDepositDate} maxDate={new Date()} />
                  <TextInput label="Bank reference (optional)" description="The teller number or reference on the slip." value={reference} onChange={(e) => setReference(e.currentTarget.value)} />
                  <FileInput
                    label="Deposit slip"
                    description="A clear photo of the slip (JPG, PNG or PDF, up to 5 MB)."
                    placeholder="Choose the slip"
                    leftSection={<Upload size={16} />}
                    accept="image/jpeg,image/png,image/gif,application/pdf"
                    value={slip}
                    onChange={setSlip}
                    clearable
                  />
                </Stack>
              </Card>

              <Group justify="flex-end">
                {problem ? (
                  <Text size="sm" c="dimmed">
                    {problem}
                  </Text>
                ) : null}
                <Button loading={saving} disabled={problem !== null} onClick={submit}>
                  Record lodgment
                </Button>
              </Group>
            </Stack>
          ) : null}
        </div>
      </Stack>
    </Can>
  );
}
