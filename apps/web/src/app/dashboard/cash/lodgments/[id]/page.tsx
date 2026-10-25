'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Anchor, Badge, Button, Card, Group, Image, LoadingOverlay, Modal, SimpleGrid, Stack, Table, Text, Textarea, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Can } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/lib/permissions';
import { cashApi, cashErrorMessage, formatNaira, LODGMENT_STATUS_COLOR, LODGMENT_STATUS_LABEL, type CashLodgment } from '@/lib/api/cash';
import { CashNav } from '@/components/cash/CashNav';
import { HelpLink } from '@/components/docs/HelpLink';

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Group justify="space-between" py={6}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right">
        {value && value.trim() ? value : '–'}
      </Text>
    </Group>
  );
}

/** CA8 — one lodgment: the slip, where it went, what it covers, and Verify / Reject for a different officer. */
export default function LodgmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const userId = useAuthStore((state) => state.user?.id);

  const [lodgment, setLodgment] = useState<CashLodgment | null>(null);
  const [slip, setSlip] = useState<{ url: string; mimeType: string; filename: string } | null>(null);
  const [slipFailed, setSlipFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await cashApi.getLodgment(id);
      setLodgment(data);
      if (data.hasSlip) {
        cashApi
          .getSlipLink(id)
          .then(setSlip)
          .catch(() => setSlipFailed(true));
      }
    } catch (error) {
      notifications.show({ title: 'Could not load the lodgment', message: cashErrorMessage(error, 'Try again.'), color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const own = lodgment !== null && Number(lodgment.lodgedBy.id) === Number(userId);
  const pending = lodgment?.status === 'PENDING';

  const decide = async (status: 'VERIFIED' | 'REJECTED') => {
    if (status === 'REJECTED' && reason.trim().length < 3) {
      notifications.show({ title: 'Say why', message: 'A short reason is needed so the officer can fix it.', color: 'red' });
      return;
    }
    setBusy(true);
    try {
      await cashApi.decideLodgment(id, { status, reason: status === 'REJECTED' ? reason.trim() : undefined });
      notifications.show({ title: status === 'VERIFIED' ? 'Lodgment verified' : 'Lodgment rejected', message: status === 'VERIFIED' ? 'The cash is now in the bank in the books.' : 'The cash is back with the officer to lodge again.', color: 'green' });
    } catch (error) {
      // Someone else may have decided it first — the message says so, and reloading shows where it really stands.
      notifications.show({ title: 'Could not save your decision', message: cashErrorMessage(error, 'Try again.'), color: 'red' });
    } finally {
      setBusy(false);
      setVerifying(false);
      setRejecting(false);
      setReason('');
      void load();
    }
  };

  return (
    <Can anyPermissions={[PERMISSIONS.CASH_COLLECT, PERMISSIONS.CASH_LODGE, PERMISSIONS.CASH_VERIFY, PERMISSIONS.CASH_VIEW]}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Lodgment</Title>
            {lodgment ? (
              <Group gap="xs">
                <Badge color={LODGMENT_STATUS_COLOR[lodgment.status]} variant="light">
                  {LODGMENT_STATUS_LABEL[lodgment.status]}
                </Badge>
                <Text size="sm" c="dimmed">
                  {lodgment.lodgedBy.name} · paid in {new Date(lodgment.depositDate).toLocaleDateString()}
                </Text>
              </Group>
            ) : null}
          </div>
          <Group>
            <HelpLink />
            {pending ? (
              <Can permission={PERMISSIONS.CASH_VERIFY}>
                {own ? null : (
                  <>
                    <Button variant="light" color="red" onClick={() => setRejecting(true)}>
                      Reject
                    </Button>
                    <Button onClick={() => setVerifying(true)}>Verify lodgment</Button>
                  </>
                )}
              </Can>
            ) : null}
          </Group>
        </Group>

        <CashNav />

        <div style={{ position: 'relative', minHeight: 120 }}>
          <LoadingOverlay visible={loading} />
          {lodgment ? (
            <Stack gap="lg">
              <Text size="xl" fw={700}>
                {formatNaira(lodgment.amount)}
              </Text>

              {pending && own ? <Alert color="blue">You made this lodgment, so another officer has to check it.</Alert> : null}
              {lodgment.status === 'REJECTED' && lodgment.rejectionReason ? (
                <Alert color="red" title="Rejected">
                  {lodgment.rejectionReason}
                  {own ? <Text size="sm">The cash is back in your hand. Fix the problem and lodge it again.</Text> : null}
                </Alert>
              ) : null}
              {lodgment.status === 'VERIFIED' && lodgment.verifiedAt ? (
                <Alert color="green">
                  Verified{lodgment.verifiedBy ? ` by ${lodgment.verifiedBy.name}` : ''} on {new Date(lodgment.verifiedAt).toLocaleDateString()}.
                </Alert>
              ) : null}
              {lodgment.shortfall > 0 ? (
                <Alert color="yellow" title="Lodged short">
                  {formatNaira(lodgment.shortfall)} less than was collected.
                  {lodgment.shortfallReason ? ` Reason given: ${lodgment.shortfallReason}` : ''}
                </Alert>
              ) : null}

              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <Card withBorder padding="lg">
                  <Title order={4} mb="sm">
                    Deposit slip
                  </Title>
                  {!lodgment.hasSlip ? (
                    <Text size="sm" c="dimmed">
                      No deposit slip was attached.
                    </Text>
                  ) : slipFailed ? (
                    <Text size="sm" c="red">
                      We couldn&apos;t load the deposit slip. Reload the page to try again.
                    </Text>
                  ) : !slip ? (
                    <Text size="sm" c="dimmed">
                      Loading the slip…
                    </Text>
                  ) : slip.mimeType.startsWith('image/') ? (
                    <Anchor href={slip.url} target="_blank" rel="noopener noreferrer">
                      <Image src={slip.url} alt="Deposit slip" radius="md" fit="contain" mah={420} onError={() => setSlipFailed(true)} />
                    </Anchor>
                  ) : (
                    <Button component="a" href={slip.url} target="_blank" rel="noopener noreferrer" variant="light">
                      Open {slip.filename}
                    </Button>
                  )}
                </Card>

                <Card withBorder padding="lg">
                  <Title order={4} mb="xs">
                    Paid into
                  </Title>
                  <Fact label="Bank" value={lodgment.bankAccount.bankName} />
                  <Fact label="Account name" value={lodgment.bankAccount.accountName} />
                  <Fact label="Account number" value={lodgment.bankAccount.accountNumber} />
                  <Fact label="Bank reference" value={lodgment.bankReference} />
                </Card>
              </SimpleGrid>

              <Card withBorder padding="lg">
                <Title order={4} mb="sm">
                  Cash it covers
                </Title>
                <Table>
                  <Table.Tbody>
                    {lodgment.collections.map((c) => (
                      <Table.Tr key={c.id}>
                        <Table.Td>
                          <Anchor component={Link} href={`/dashboard/cash/collections/${c.id}`}>
                            {c.title}
                          </Anchor>
                        </Table.Td>
                        <Table.Td ta="right" fw={600}>
                          {formatNaira(c.amount)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    <Table.Tr>
                      <Table.Td c="dimmed">Should have been lodged</Table.Td>
                      <Table.Td ta="right" fw={600}>
                        {formatNaira(lodgment.expectedAmount)}
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          ) : null}
        </div>

        <Modal opened={verifying} onClose={() => setVerifying(false)} title="Verify this lodgment?">
          <Stack>
            <Text size="sm">
              Check that this amount appears on the bank statement. Verifying moves the cash from the officer&apos;s hand into the bank in the books. You can&apos;t undo it.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setVerifying(false)}>
                Not yet
              </Button>
              <Button loading={busy} onClick={() => decide('VERIFIED')}>
                Verify lodgment
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Modal opened={rejecting} onClose={() => setRejecting(false)} title="Reject this lodgment?">
          <Stack>
            <Text size="sm">Use this when the amount isn&apos;t on the bank statement or the slip doesn&apos;t match. The cash goes back to the officer to lodge again.</Text>
            <Textarea label="Reason" placeholder="Why are you rejecting this lodgment?" value={reason} onChange={(e) => setReason(e.currentTarget.value)} autosize minRows={2} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setRejecting(false)}>
                Not yet
              </Button>
              <Button color="red" loading={busy} onClick={() => decide('REJECTED')}>
                Reject lodgment
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Can>
  );
}
