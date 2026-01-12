'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  Title, 
  Text, 
  Group, 
  Button, 
  Stack,
  Table,
  Select,
  TextInput,
  Loader,
  Alert,
  Pagination,
  Badge,
  Modal
} from '@mantine/core';
import { 
  IconRefresh, 
  IconSearch, 
  IconFilter, 
  IconCheck,
  IconX
} from '@tabler/icons-react';
import nigerianPaymentsApi, { BankStatementEntry } from '@/lib/api/nigerian-payments';

export default function StatementEntriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<BankStatementEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [matchStatusFilter, setMatchStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const pageSize = 10;

  useEffect(() => {
    loadEntries();
  }, [page, matchStatusFilter, searchQuery]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await nigerianPaymentsApi.getStatementEntries({
        page,
        limit: pageSize,
        matchStatus: matchStatusFilter || undefined,
        search: searchQuery || undefined,
      });
      setEntries(response.data);
      setTotal(response.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load statement entries');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleStatusFilter = (value: string | null) => {
    setMatchStatusFilter(value);
    setPage(1);
  };

  const toggleEntrySelection = (id: string) => {
    setSelectedEntries(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedEntries(entries.map(e => e.id));
  };

  const clearSelection = () => {
    setSelectedEntries([]);
  };

  const handleManualMatch = () => {
    if (selectedEntries.length === 0) {
      alert('Please select at least one entry to match');
      return;
    }
    setShowMatchModal(true);
  };

  const totalPages = Math.ceil(total / pageSize);

  const statusOptions = [
    { value: 'UNMATCHED', label: 'Unmatched' },
    { value: 'AUTO_MATCHED', label: 'Auto-Matched' },
    { value: 'MANUALLY_MATCHED', label: 'Manually Matched' },
  ];

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Group justify="space-between" mb="md">
        <Title order={2}>Statement Entries</Title>
        <Button onClick={() => router.push('/dashboard/payments/nigerian/reconciliation')}>
          Go to Reconciliation
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Error" icon={<IconRefresh />} mb="md" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card shadow="sm" padding="md" withBorder mb="md">
        <Group gap="md">
          <TextInput
            placeholder="Search by description or reference..."
            leftSection={<IconSearch size={18} />}
            value={searchQuery}
            onChange={(e) => handleSearch(e.currentTarget.value)}
            rightSection={searchQuery && (
              <Button size="xs" variant="subtle" onClick={() => handleSearch('')}>
                <IconFilter size={14} />
              </Button>
            )}
          />

          <Select
            placeholder="Filter by match status"
            data={statusOptions}
            value={matchStatusFilter}
            onChange={handleStatusFilter}
            clearable
          />
        </Group>
      </Card>

      {/* Selection Actions */}
      {selectedEntries.length > 0 && (
        <Group mb="md">
          <Button variant="subtle" onClick={clearSelection}>
            Clear Selection ({selectedEntries.length})
          </Button>
          <Button onClick={selectAll} variant="subtle">
            Select All ({entries.length})
          </Button>
          <Button onClick={handleManualMatch} color="blue">
            Match Selected ({selectedEntries.length})
          </Button>
        </Group>
      )}

      {/* Entries Table */}
      {entries.length === 0 && !loading ? (
        <Card shadow="sm" padding="xl" withBorder>
          <Stack align="center" gap="md">
            <IconSearch size={48} className="text-gray-400" />
            <Text c="dimmed" ta="center">
              No statement entries found. Import a bank statement to get started.
            </Text>
            <Button onClick={() => router.push('/dashboard/payments/nigerian/statements')} variant="light">
              Import Statement
            </Button>
          </Stack>
        </Card>
      ) : (
        <>
          <Card shadow="sm" padding="0" withBorder>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <input
                      type="checkbox"
                      checked={selectedEntries.length === entries.length && entries.length > 0}
                      onChange={selectAll}
                      className="cursor-pointer"
                    />
                  </Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Reference</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Balance</Table.Th>
                  <Table.Th>Match Status</Table.Th>
                  <Table.Th>Reconciliation</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {entries.map((entry) => (
                  <Table.Tr key={entry.id}>
                    <Table.Td w={40}>
                      <input
                        type="checkbox"
                        checked={selectedEntries.includes(entry.id)}
                        onChange={() => toggleEntrySelection(entry.id)}
                        className="cursor-pointer"
                      />
                    </Table.Td>
                    <Table.Td>{new Date(entry.date).toLocaleDateString()}</Table.Td>
                    <Table.Td>{entry.description}</Table.Td>
                    <Table.Td className="font-mono">{entry.reference}</Table.Td>
                    <Table.Td fw={700} c="green">₦{entry.amount.toLocaleString()}</Table.Td>
                    <Table.Td>{entry.balance ? `₦${entry.balance.toLocaleString()}` : '-'}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          entry.matchStatus === 'UNMATCHED' ? 'red' :
                          entry.matchStatus === 'AUTO_MATCHED' ? 'green' :
                          'blue'
                        }
                        variant="light"
                      >
                        {entry.matchStatus}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {entry.reconciliationId ? (
                        <Button size="xs" variant="subtle" onClick={() => router.push(`/dashboard/payments/nigerian/reconciliation`)}>
                          View
                        </Button>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
              mt="md"
            />
          )}
        </>
      )}

      {/* Manual Match Modal */}
      <Modal
        opened={showMatchModal}
        onClose={() => setShowMatchModal(false)}
        title="Manual Reconciliation"
        size="lg"
      >
        <Stack gap="md">
          <Text>
            You have selected <Text fw={700}>{selectedEntries.length}</Text> statement entries for manual reconciliation.
          </Text>
          <Text size="sm" c="dimmed">
            This will create reconciliation records linking these entries to bank transfers or transactions.
          </Text>
          <Group justify="flex-end" mt="xl">
            <Button variant="subtle" onClick={() => setShowMatchModal(false)}>
              Cancel
            </Button>
            <Button color="blue" onClick={() => setShowMatchModal(false)}>
              Proceed to Reconciliation
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
