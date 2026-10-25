'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, Group, LoadingOverlay, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { cashApi, cashErrorMessage, formatNaira, type CashOverview } from '@/lib/api/cash';
import { CashNav } from '@/components/cash/CashNav';
import { HelpLink } from '@/components/docs/HelpLink';

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {formatNaira(value)}
      </Text>
      {hint ? (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

/** CA1 — Cash: what the officer holds, what is lodged and waiting, and (for those who watch cash) every officer's position. */
export default function CashOverviewPage() {
  const [overview, setOverview] = useState<CashOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cashApi
      .getOverview()
      .then(setOverview)
      .catch((error) => notifications.show({ title: 'Could not load cash', message: cashErrorMessage(error, 'Try again.'), color: 'red' }))
      .finally(() => setLoading(false));
  }, []);

  const mine = overview?.mine;

  return (
    <Can anyPermissions={[PERMISSIONS.CASH_COLLECT, PERMISSIONS.CASH_LODGE, PERMISSIONS.CASH_VERIFY, PERMISSIONS.CASH_VIEW]}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Cash Collections</Title>
            <Text size="sm" c="dimmed">
              Cash collected from members at meetings, paid into the bank, and checked by a second officer
            </Text>
          </div>
          <HelpLink />
        </Group>

        <CashNav />

        <div style={{ position: 'relative', minHeight: 120 }}>
          <LoadingOverlay visible={loading} />
          {overview ? (
            <Stack gap="lg">
              {mine ? (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                  <Figure label="Cash in your hand" value={mine.inHand} />
                  <Figure label="Ready to lodge" value={mine.readyToLodge} hint="On closed collections" />
                  <Figure label="On open collections" value={mine.inOpenCollections} hint="Close the collection to lodge it" />
                  <Figure label="Lodged, awaiting check" value={mine.awaitingCheck} hint="Paid in; a second officer checks it" />
                </SimpleGrid>
              ) : null}

              {mine?.overdue ? (
                <Alert color="yellow" icon={<AlertTriangle size={18} />} title="Lodge this cash">
                  {formatNaira(mine.readyToLodge)} was collected and closed {mine.daysUnlodged} days ago and is not lodged yet. Your association expects cash to be
                  lodged within {overview.dueDays} {overview.dueDays === 1 ? 'day' : 'days'}.
                </Alert>
              ) : null}

              <Group>
                <Can permission={PERMISSIONS.CASH_COLLECT}>
                  <Button component={Link} href="/dashboard/cash/collections?new=1">
                    Open a collection
                  </Button>
                </Can>
                <Can permission={PERMISSIONS.CASH_LODGE}>
                  <Button component={Link} href="/dashboard/cash/lodge" variant="light">
                    Lodge cash
                  </Button>
                </Can>
                <Can anyPermissions={[PERMISSIONS.CASH_VERIFY]}>
                  <Button component={Link} href="/dashboard/cash/lodgments" variant="light" color={overview.lodgmentsToVerify > 0 ? 'yellow' : 'gray'}>
                    {overview.lodgmentsToVerify > 0 ? `${overview.lodgmentsToVerify} lodgment${overview.lodgmentsToVerify === 1 ? '' : 's'} to check` : 'Lodgments'}
                  </Button>
                </Can>
              </Group>

              {overview.totals ? (
                <Card withBorder padding="lg">
                  <Group justify="space-between" mb="sm">
                    <Title order={4}>Every officer</Title>
                    <Text size="sm" c="dimmed">
                      {formatNaira(overview.totals.inHand)} in hand · {formatNaira(overview.totals.awaitingCheck)} awaiting check
                    </Text>
                  </Group>
                  {overview.officers.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      No officer is holding collected cash right now.
                    </Text>
                  ) : (
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Officer</Table.Th>
                          <Table.Th>In hand</Table.Th>
                          <Table.Th>Awaiting check</Table.Th>
                          <Table.Th>Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {overview.officers.map((p) => (
                          <Table.Tr key={p.officer.id}>
                            <Table.Td>{p.officer.name}</Table.Td>
                            <Table.Td fw={600}>{formatNaira(p.inHand)}</Table.Td>
                            <Table.Td>{formatNaira(p.awaitingCheck)}</Table.Td>
                            <Table.Td>
                              {p.overdue ? (
                                <Badge color="red" variant="light">
                                  Not lodged for {p.daysUnlodged} days
                                </Badge>
                              ) : p.inHand > 0 ? (
                                <Badge color="yellow" variant="light">
                                  Holding cash
                                </Badge>
                              ) : (
                                <Badge color="gray" variant="light">
                                  Lodged
                                </Badge>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Card>
              ) : null}
            </Stack>
          ) : null}
        </div>
      </Stack>
    </Can>
  );
}
