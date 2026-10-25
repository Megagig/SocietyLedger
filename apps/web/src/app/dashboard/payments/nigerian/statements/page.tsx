'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Group, Loader, Pagination, Table, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { StatementImporter } from '@/components/payments/reconciliation/StatementImporter';
import { nigerianPaymentsApi } from '@/lib/api/nigerian-payments';

const day = (value: string) => new Date(value).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

/** Bank statements: import a CSV or Excel statement, and see the ones already imported. */
export default function StatementsPage() {
  const [page, setPage] = useState(1);
  const imports = useQuery({ queryKey: ['reconciliation', 'imports', page], queryFn: () => nigerianPaymentsApi.getStatementImports({ page, limit: 10 }), retry: false });
  const rows = imports.data?.imports ?? [];

  return (
    <div>
      <Button component={Link} href="/dashboard/payments/nigerian/reconciliation" variant="subtle" leftSection={<IconArrowLeft size={16} />} mb="md">
        Back to Reconciliation
      </Button>
      <Title order={2} mb="xs">
        Import a bank statement
      </Title>
      <Text c="dimmed" mb="lg">
        Upload the statement from your bank, check how it was read, and import only the lines that are new.
      </Text>

      <StatementImporter onImported={() => setPage(1)} />

      <Title order={3} mt="xl" mb="md">
        Statements imported
      </Title>
      {imports.isLoading ? <Loader /> : null}
      {imports.isError ? <Alert color="red">Could not load the imported statements.</Alert> : null}
      <Card withBorder padding="md" className="overflow-x-auto">
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>File</Table.Th>
              <Table.Th>Account</Table.Th>
              <Table.Th>Imported</Table.Th>
              <Table.Th>Money-in lines</Table.Th>
              <Table.Th>Skipped</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((i) => (
              <Table.Tr key={i.id}>
                <Table.Td>{i.filename}</Table.Td>
                <Table.Td>
                  {i.bankAccount.bankName} · {i.bankAccount.accountNumber}
                </Table.Td>
                <Table.Td>{day(i.importDate)}</Table.Td>
                <Table.Td>
                  {i.matchedEntries + i.unmatchedEntries}{' '}
                  {i.unmatchedEntries > 0 ? (
                    <Badge color="yellow" variant="light" ml="xs">
                      {i.unmatchedEntries} to match
                    </Badge>
                  ) : (
                    <Badge color="green" variant="light" ml="xs">
                      All matched
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>{i.skippedEntries > 0 ? `${i.skippedEntries} already imported` : '—'}</Table.Td>
              </Table.Tr>
            ))}
            {!imports.isLoading && rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="md">
                    No statements imported yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Card>
      {imports.data && imports.data.pagination.totalPages > 1 ? (
        <Group justify="center" mt="md">
          <Pagination total={imports.data.pagination.totalPages} value={page} onChange={setPage} />
        </Group>
      ) : null}
    </div>
  );
}
