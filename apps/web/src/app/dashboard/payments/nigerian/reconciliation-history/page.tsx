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
  Badge,
  Loader,
  Alert,
  Pagination,
  Modal,
  Select
} from '@mantine/core';
import { 
  IconRefresh, 
  IconEye, 
  IconCheck,
  IconX,
  IconAlertTriangle
} from '@tabler/icons-react';
import nigerianPaymentsApi, { Reconciliation } from '@/lib/api/nigerian-payments';

export default function ReconciliationHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<Reconciliation | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const pageSize = 10;

  useEffect(() => {
    loadReconciliations();
  }, [page, statusFilter]);

  const loadReconciliations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await nigerianPaymentsApi.getReconciliations({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
      });
      setReconciliations(response.data);
      setTotal(response.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load reconciliations');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (value: string | null) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleViewDetail = (rec: Reconciliation) => {
    setShowDetailModal(rec);
  };

  const handleDelete = () => {
    if (!showDetailModal) return;
    if (!confirm('Are you sure you want to delete this reconciliation?')) {
      return;
    }
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!showDetailModal) return;
    try {
      await nigerianPaymentsApi.deleteReconciliation(showDetailModal.id);
      setShowDetailModal(null);
      setShowDeleteModal(false);
      loadReconciliations();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete reconciliation');
    }
  };

  const handleConfirm = async () => {
    if (!showDetailModal) return;
    try {
      await nigerianPaymentsApi.confirmReconciliation(showDetailModal.id);
      setShowDetailModal(null);
      loadReconciliations();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to confirm reconciliation');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const statusOptions = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  if (loading && reconciliations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Group justify="space-between" mb="md">
        <Title order={2}>Reconciliation History</Title>
        <Button onClick={() => router.push('/dashboard/payments/nigerian/reconciliation')}>
          Back to Dashboard
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
          <Select
            placeholder="Filter by status"
            data={statusOptions}
            value={statusFilter}
            onChange={handleStatusFilter}
            clearable
          />
        </Group>
      </Card>

      {/* Reconciliations Table */}
      {reconciliations.length === 0 && !loading ? (
        <Card shadow="sm" padding="xl" withBorder>
          <Stack align="center" gap="md">
            <IconAlertTriangle size={48} className="text-gray-400" />
            <Text c="dimmed" ta="center">
              No reconciliations found. Go to the reconciliation dashboard to create matches.
            </Text>
            <Button onClick={() => router.push('/dashboard/payments/nigerian/reconciliation')} variant="light">
              Go to Reconciliation
            </Button>
          </Stack>
        </Card>
      ) : (
        <>
          <Card shadow="sm" padding="0" withBorder>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Bank Entry</Table.Th>
                  <Table.Th>Bank Transfer</Table.Th>
                  <Table.Th>Transaction</Table.Th>
                  <Table.Th>Variance</Table.Th>
                  <Table.Th>Confidence</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reconciliations.map((rec) => (
                  <Table.Tr key={rec.id}>
                    <Table.Td>{new Date(rec.createdAt).toLocaleDateString()}</Table.Td>
                    <Table.Td>
                      {rec.bankStatementEntryId ? (
                        <Text size="sm" fw={500} className="font-mono">
                          {rec.bankStatementEntryId.slice(0, 8)}...
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {rec.bankTransferId ? (
                        <Text size="sm" fw={500} className="font-mono">
                          {rec.bankTransferId.slice(0, 8)}...
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {rec.transactionId ? (
                        <Text size="sm" fw={500} className="font-mono">
                          {rec.transactionId.slice(0, 8)}...
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td fw={700} c={rec.variance > 0 ? 'red' : 'green'}>
                      ₦{rec.variance.toLocaleString()}
                    </Table.Td>
                    <Table.Td>
                      {rec.confidenceScore !== undefined && (
                        <Badge
                          color={rec.confidenceScore > 80 ? 'green' : rec.confidenceScore > 50 ? 'yellow' : 'red'}
                          variant="light"
                        >
                          {rec.confidenceScore}%
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          rec.status === 'PENDING' ? 'yellow' :
                          rec.status === 'CONFIRMED' ? 'green' :
                          'red'
                        }
                        variant="light"
                      >
                        {rec.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="subtle" onClick={() => handleViewDetail(rec)}>
                        <IconEye size={16} className="mr-1" />
                        View
                      </Button>
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

      {/* Detail Modal */}
      {showDetailModal && (
        <Modal
          opened={!!showDetailModal}
          onClose={() => setShowDetailModal(null)}
          title="Reconciliation Details"
          size="lg"
        >
          <Stack gap="md">
            <Group gap="xs" mb="md">
              <Text size="sm" c="dimmed">Date:</Text>
              <Text>{new Date(showDetailModal.createdAt).toLocaleString()}</Text>
            </Group>

            <Group gap="xs" mb="md">
              <Text size="sm" c="dimmed">Bank Entry:</Text>
              <Text className="font-mono">
                {showDetailModal.bankStatementEntryId || 'N/A'}
              </Text>
            </Group>

            <Group gap="xs" mb="md">
              <Text size="sm" c="dimmed">Bank Transfer:</Text>
              <Text className="font-mono">
                {showDetailModal.bankTransferId || 'N/A'}
              </Text>
            </Group>

            <Group gap="xs" mb="md">
              <Text size="sm" c="dimmed">Transaction:</Text>
              <Text className="font-mono">
                {showDetailModal.transactionId || 'N/A'}
              </Text>
            </Group>

            <Group gap="xs" mb="md">
              <Text size="sm" c="dimmed">Variance:</Text>
              <Text fw={700} c={showDetailModal.variance > 0 ? 'red' : 'green'}>
                ₦{showDetailModal.variance.toLocaleString()}
              </Text>
            </Group>

            {showDetailModal.confidenceScore !== undefined && (
              <Group gap="xs" mb="md">
                <Text size="sm" c="dimmed">Confidence Score:</Text>
                <Badge
                  color={showDetailModal.confidenceScore > 80 ? 'green' : showDetailModal.confidenceScore > 50 ? 'yellow' : 'red'}
                  variant="light"
                >
                  {showDetailModal.confidenceScore}%
                </Badge>
              </Group>
            )}

            <Group gap="xs" mb="md">
              <Text size="sm" c="dimmed">Status:</Text>
              <Badge
                color={
                  showDetailModal.status === 'PENDING' ? 'yellow' :
                  showDetailModal.status === 'CONFIRMED' ? 'green' :
                  'red'
                }
                variant="light"
              >
                {showDetailModal.status}
              </Badge>
            </Group>

            {showDetailModal.reconciledBy && (
              <Group gap="xs" mb="md">
                <Text size="sm" c="dimmed">Reconciled By:</Text>
                <Text>{showDetailModal.reconciledBy}</Text>
              </Group>
            )}

            {showDetailModal.reconciledAt && (
              <Group gap="xs" mb="md">
                <Text size="sm" c="dimmed">Reconciled At:</Text>
                <Text>{new Date(showDetailModal.reconciledAt).toLocaleString()}</Text>
              </Group>
            )}

            <Group justify="flex-end" mt="xl">
              <Button variant="subtle" onClick={() => setShowDetailModal(null)}>
                Close
              </Button>
              {showDetailModal.status === 'PENDING' && (
                <>
                  <Button color="green" onClick={handleConfirm} className="mr-xs">
                    <IconCheck size={18} className="mr-1" />
                    Confirm
                  </Button>
                  <Button color="red" onClick={handleDelete} className="mr-xs">
                    <IconX size={18} className="mr-1" />
                    Delete
                  </Button>
                </>
              )}
            </Group>
          </Stack>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        opened={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Reconciliation"
        size="sm"
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to delete this reconciliation?
          </Text>
          <Text size="sm" c="dimmed">
            This action cannot be undone.
          </Text>
          <Group justify="flex-end" mt="xl">
            <Button variant="subtle" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={confirmDelete}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
