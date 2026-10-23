'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Badge, Button, Card, Group, LoadingOverlay, Modal, SimpleGrid, Stack, Table, Text, Textarea, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/lib/permissions';
import { cashApi, cashErrorMessage, formatNaira, type CashCollectionDetail, type CashReceipt } from '@/lib/api/cash';
import { CashNav } from '@/components/cash/CashNav';
import { CollectCashModal } from '@/components/cash/CollectCashModal';
import { HelpLink } from '@/components/docs/HelpLink';

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {formatNaira(value)}
      </Text>
    </Card>
  );
}

/** CA4 — one collection: what was taken, receipt by receipt, with Collect cash, Close and (for a second officer) Void. */
export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const userId = useAuthStore((state) => state.user?.id);
  const { can } = usePermissions();

  const [collection, setCollection] = useState<CashCollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const [voiding, setVoiding] = useState<CashReceipt | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCollection(await cashApi.getCollection(id));
    } catch (error) {
      notifications.show({ title: 'Could not load the collection', message: cashErrorMessage(error, 'Try again.'), color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOpen = collection?.status === 'OPEN';
  const isMine = collection !== undefined && collection !== null && Number(collection.collectedBy.id) === Number(userId);

  const close = async () => {
    setCloseBusy(true);
    try {
      await cashApi.closeCollection(id);
      notifications.show({ title: 'Collection closed', message: 'You can now lodge the cash.', color: 'green' });
      setClosing(false);
    } catch (error) {
      notifications.show({ title: 'Could not close the collection', message: cashErrorMessage(error, 'Try again.'), color: 'red' });
      setClosing(false);
    } finally {
      setCloseBusy(false);
      void load();
    }
  };

  const voidReceipt = async () => {
    if (!voiding) return;
    if (voidReason.trim().length < 3) {
      notifications.show({ title: 'Say why', message: 'A short reason is needed to void a receipt.', color: 'red' });
      return;
    }
    setVoidBusy(true);
    try {
      await cashApi.voidReceipt(voiding.id, voidReason.trim());
      notifications.show({ title: 'Receipt voided', message: "The member's balance has been put back.", color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Could not void the receipt', message: cashErrorMessage(error, 'Try again.'), color: 'red' });
    } finally {
      setVoidBusy(false);
      setVoiding(null);
      setVoidReason('');
      void load();
    }
  };

  const canVoid = (receipt: CashReceipt) => can(PERMISSIONS.CASH_VERIFY) && isOpen && receipt.status === 'ACTIVE' && Number(receipt.createdBy.id) !== Number(userId);

  return (
    <Can anyPermissions={[PERMISSIONS.CASH_COLLECT, PERMISSIONS.CASH_LODGE, PERMISSIONS.CASH_VERIFY, PERMISSIONS.CASH_VIEW]}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>{collection?.title ?? 'Collection'}</Title>
            {collection ? (
              <Group gap="xs">
                <Badge color={isOpen ? 'blue' : 'gray'} variant="light">
                  {isOpen ? 'Open' : 'Closed'}
                </Badge>
                <Text size="sm" c="dimmed">
                  {collection.collectedBy.name} · opened {new Date(collection.openedAt).toLocaleDateString()}
                  {collection.closedAt ? ` · closed ${new Date(collection.closedAt).toLocaleDateString()}` : ''}
                </Text>
              </Group>
            ) : null}
          </div>
          <Group>
            <HelpLink />
            {isOpen && isMine ? (
              <Can permission={PERMISSIONS.CASH_COLLECT}>
                <Button onClick={() => setCollecting(true)}>Collect cash</Button>
                {collection && collection.receipts.some((r) => r.status === 'ACTIVE') ? (
                  <Button variant="light" onClick={() => setClosing(true)}>
                    Close collection
                  </Button>
                ) : null}
              </Can>
            ) : null}
            {collection && !isOpen && isMine && collection.toLodge > 0 ? (
              <Can permission={PERMISSIONS.CASH_LODGE}>
                <Button component={Link} href="/dashboard/cash/lodge">
                  Lodge this cash
                </Button>
              </Can>
            ) : null}
          </Group>
        </Group>

        <CashNav />

        <div style={{ position: 'relative', minHeight: 120 }}>
          <LoadingOverlay visible={loading} />
          {collection ? (
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <Figure label="Collected" value={collection.collected} />
                <Figure label="Already lodged" value={collection.lodged} />
                <Figure label="Still to lodge" value={collection.toLodge} />
              </SimpleGrid>

              {collection.notes ? (
                <Text size="sm" c="dimmed">
                  {collection.notes}
                </Text>
              ) : null}

              <Card withBorder padding="lg">
                <Title order={4} mb="sm">
                  Receipts{collection.receipts.length > 0 ? ` · ${collection.receipts.length}` : ''}
                </Title>
                {collection.receipts.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {isOpen && isMine ? 'No receipts yet. Select Collect cash when a member hands you money.' : 'No receipts in this collection.'}
                  </Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Member</Table.Th>
                        <Table.Th>Paid for</Table.Th>
                        <Table.Th>Receipt</Table.Th>
                        <Table.Th>Time</Table.Th>
                        <Table.Th>Total</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {collection.receipts.map((r) => (
                        <Table.Tr key={r.id} style={r.status === 'VOIDED' ? { opacity: 0.6 } : undefined}>
                          <Table.Td fw={500}>{r.member.name}</Table.Td>
                          <Table.Td>
                            {r.items.map((i) => i.label).join(', ')}
                            {r.status === 'VOIDED' && r.voidReason ? (
                              <Text size="xs" c="red">
                                Voided: {r.voidReason}
                              </Text>
                            ) : null}
                          </Table.Td>
                          <Table.Td>{r.receiptNumber}</Table.Td>
                          <Table.Td>{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Table.Td>
                          <Table.Td fw={600}>{formatNaira(r.total)}</Table.Td>
                          <Table.Td>
                            {r.status === 'VOIDED' ? (
                              <Badge color="red" variant="light">
                                Voided
                              </Badge>
                            ) : canVoid(r) ? (
                              <Button size="xs" variant="subtle" color="red" onClick={() => setVoiding(r)}>
                                Void
                              </Button>
                            ) : null}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Card>
            </Stack>
          ) : null}
        </div>

        <CollectCashModal collectionId={id} opened={collecting} onClose={() => setCollecting(false)} onRecorded={() => void load()} />

        <Modal opened={closing} onClose={() => setClosing(false)} title="Close this collection?">
          <Stack>
            <Text size="sm">Once it is closed you can&apos;t add or void receipts in it. Then you can lodge the cash into the bank.</Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setClosing(false)}>
                Not yet
              </Button>
              <Button loading={closeBusy} onClick={close}>
                Close collection
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Modal opened={voiding !== null} onClose={() => setVoiding(null)} title="Void this receipt?">
          <Stack>
            <Alert color="yellow">The member&apos;s balance goes back as it was and they are told why. Use this for a wrong member or a wrong amount.</Alert>
            <Textarea label="Reason" placeholder="For example: recorded against the wrong member" value={voidReason} onChange={(e) => setVoidReason(e.currentTarget.value)} autosize minRows={2} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setVoiding(null)}>
                Keep it
              </Button>
              <Button color="red" loading={voidBusy} onClick={voidReceipt}>
                Void receipt
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Can>
  );
}
