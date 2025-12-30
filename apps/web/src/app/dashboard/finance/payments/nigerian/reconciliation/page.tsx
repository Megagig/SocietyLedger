'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Table,
  Badge,
  Modal,
  Select,
  Textarea,
  LoadingOverlay,
  Pagination,
  Alert,
  Paper,
  SimpleGrid,
  ThemeIcon,
  Progress,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconWand,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconArrowsExchange,
  IconRefresh,
} from '@tabler/icons-react';
import Link from 'next/link';
import {
  getReconciliations,
  confirmReconciliation,
  runAutoMatch,
  applyAutoMatches,
  Reconciliation,
  AutoMatchResult,
} from '@/lib/api/nigerian-payments';

export default function ReconciliationPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [autoMatchModalOpen, setAutoMatchModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<Reconciliation | null>(null);
  const [autoMatchResults, setAutoMatchResults] = useState<AutoMatchResult | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<AutoMatchResult['matches']>([]);

  const { data: reconciliationsData, isLoading } = useQuery({
    queryKey: ['reconciliations', page, statusFilter],
    queryFn: () =>
      getReconciliations({
        page,
        limit: 20,
        status: statusFilter || undefined,
      }),
  });

  const reconciliations = reconciliationsData?.data?.reconciliations || [];
  const pagination = reconciliationsData?.data?.pagination;

  const autoMatchMutation = useMutation({
    mutationFn: runAutoMatch,
    onSuccess: (data) => {
      setAutoMatchResults(data.data);
      setSelectedMatches(data.data.matches.filter((m) => m.confidence >= 80));
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to run auto-match',
        color: 'red',
      });
    },
  });

  const applyMatchesMutation = useMutation({
    mutationFn: applyAutoMatches,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['statement-entries'] });
      notifications.show({
        title: 'Success',
        message: `Applied ${data.data?.successful || 0} matches successfully`,
        color: 'green',
      });
      setAutoMatchModalOpen(false);
      setAutoMatchResults(null);
      setSelectedMatches([]);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to apply matches',
        color: 'red',
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: 'CONFIRMED' | 'DISPUTED'; notes?: string } }) =>
      confirmReconciliation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
      notifications.show({
        title: 'Success',
        message: 'Reconciliation updated successfully',
        color: 'green',
      });
      setConfirmModalOpen(false);
      setSelectedReconciliation(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to update reconciliation',
        color: 'red',
      });
    },
  });

  const handleRunAutoMatch = () => {
    setAutoMatchModalOpen(true);
    autoMatchMutation.mutate();
  };

  const handleApplyMatches = () => {
    if (selectedMatches.length > 0) {
      applyMatchesMutation.mutate(selectedMatches);
    }
  };

  const handleConfirm = (status: 'CONFIRMED' | 'DISPUTED') => {
    if (selectedReconciliation) {
      confirmMutation.mutate({
        id: selectedReconciliation.id,
        data: { status },
      });
    }
  };

  const toggleMatchSelection = (match: AutoMatchResult['matches'][0]) => {
    const isSelected = selectedMatches.some(
      (m) => m.transactionId === match.transactionId && m.bankTransferId === match.bankTransferId
    );
    if (isSelected) {
      setSelectedMatches(
        selectedMatches.filter(
          (m) => !(m.transactionId === match.transactionId && m.bankTransferId === match.bankTransferId)
        )
      );
    } else {
      setSelectedMatches([...selectedMatches, match]);
    }
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'yellow';
      case 'CONFIRMED':
        return 'green';
      case 'DISPUTED':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getMatchTypeColor = (type: string) => {
    switch (type) {
      case 'AUTO_REFERENCE':
        return 'green';
      case 'AUTO_AMOUNT':
        return 'blue';
      case 'MANUAL':
        return 'violet';
      default:
        return 'gray';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'green';
    if (confidence >= 70) return 'yellow';
    return 'red';
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            component={Link}
            href="/dashboard/finance/payments/nigerian"
          >
            Back
          </Button>
          <div>
            <Title order={2}>Payment Reconciliation</Title>
            <Text c="dimmed">Match bank transfers and statement entries to transactions</Text>
          </div>
        </Group>
        <Button leftSection={<IconWand size={16} />} onClick={handleRunAutoMatch}>
          Run Auto-Match
        </Button>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Pending
              </Text>
              <Text size="xl" fw={700}>
                {reconciliations.filter((r: Reconciliation) => r.status === 'PENDING').length}
              </Text>
            </div>
            <ThemeIcon size="lg" radius="md" variant="light" color="yellow">
              <IconAlertCircle size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Confirmed
              </Text>
              <Text size="xl" fw={700}>
                {reconciliations.filter((r: Reconciliation) => r.status === 'CONFIRMED').length}
              </Text>
            </div>
            <ThemeIcon size="lg" radius="md" variant="light" color="green">
              <IconCheck size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Disputed
              </Text>
              <Text size="xl" fw={700}>
                {reconciliations.filter((r: Reconciliation) => r.status === 'DISPUTED').length}
              </Text>
            </div>
            <ThemeIcon size="lg" radius="md" variant="light" color="red">
              <IconX size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Filters */}
      <Paper p="md" radius="md" withBorder>
        <Group>
          <Select
            placeholder="Filter by status"
            data={[
              { value: '', label: 'All Statuses' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'DISPUTED', label: 'Disputed' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
          />
          <Button
            variant="subtle"
            leftSection={<IconRefresh size={16} />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['reconciliations'] })}
          >
            Refresh
          </Button>
        </Group>
      </Paper>

      <Card padding="lg" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        {reconciliations.length > 0 ? (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Transaction</Table.Th>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Match Type</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reconciliations.map((rec: Reconciliation) => (
                  <Table.Tr key={rec.id}>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {rec.transaction?.referenceNumber || `TXN-${rec.transactionId}`}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {rec.transaction?.member
                          ? `${rec.transaction.member.firstName} ${rec.transaction.member.lastName}`
                          : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {formatCurrency(rec.matchedAmount)}
                      </Text>
                      {Number(rec.variance) !== 0 && (
                        <Text size="xs" c="red">
                          Variance: {formatCurrency(rec.variance)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getMatchTypeColor(rec.matchType)} size="sm">
                        {rec.matchType.replace('_', ' ')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(rec.status)} size="sm">
                        {rec.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {rec.status === 'PENDING' && (
                        <Group gap="xs">
                          <Button
                            size="xs"
                            color="green"
                            variant="light"
                            onClick={() => {
                              setSelectedReconciliation(rec);
                              setConfirmModalOpen(true);
                            }}
                          >
                            Review
                          </Button>
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {pagination && pagination.totalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination value={page} onChange={setPage} total={pagination.totalPages} />
              </Group>
            )}
          </>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            No reconciliations found. Run auto-match to find potential matches.
          </Text>
        )}
      </Card>

      {/* Auto-Match Modal */}
      <Modal
        opened={autoMatchModalOpen}
        onClose={() => {
          setAutoMatchModalOpen(false);
          setAutoMatchResults(null);
          setSelectedMatches([]);
        }}
        title="Auto-Match Results"
        size="xl"
      >
        <Stack gap="md">
          {autoMatchMutation.isPending ? (
            <Group justify="center" py="xl">
              <LoadingOverlay visible />
              <Text>Searching for matches...</Text>
            </Group>
          ) : autoMatchResults ? (
            <>
              <Alert color={autoMatchResults.matched > 0 ? 'green' : 'yellow'}>
                Found {autoMatchResults.matched} potential matches, {autoMatchResults.unmatched} unmatched
              </Alert>

              {autoMatchResults.matches.length > 0 ? (
                <>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Select</Table.Th>
                        <Table.Th>Transaction ID</Table.Th>
                        <Table.Th>Source</Table.Th>
                        <Table.Th>Match Type</Table.Th>
                        <Table.Th>Confidence</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {autoMatchResults.matches.map((match, index) => {
                        const isSelected = selectedMatches.some(
                          (m) =>
                            m.transactionId === match.transactionId &&
                            m.bankTransferId === match.bankTransferId
                        );
                        return (
                          <Table.Tr
                            key={index}
                            style={{ cursor: 'pointer' }}
                            onClick={() => toggleMatchSelection(match)}
                            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
                          >
                            <Table.Td>
                              <input type="checkbox" checked={isSelected} readOnly />
                            </Table.Td>
                            <Table.Td>TXN-{match.transactionId}</Table.Td>
                            <Table.Td>
                              {match.bankTransferId
                                ? `Transfer #${match.bankTransferId}`
                                : `Statement #${match.statementEntryId}`}
                            </Table.Td>
                            <Table.Td>
                              <Badge color={getMatchTypeColor(match.matchType)} size="sm">
                                {match.matchType.replace('_', ' ')}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <Progress
                                  value={match.confidence}
                                  size="sm"
                                  color={getConfidenceColor(match.confidence)}
                                  style={{ width: 60 }}
                                />
                                <Text size="xs">{match.confidence}%</Text>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>

                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      {selectedMatches.length} of {autoMatchResults.matches.length} selected
                    </Text>
                    <Group>
                      <Button
                        variant="subtle"
                        onClick={() => setSelectedMatches(autoMatchResults.matches)}
                      >
                        Select All
                      </Button>
                      <Button variant="subtle" onClick={() => setSelectedMatches([])}>
                        Clear Selection
                      </Button>
                    </Group>
                  </Group>
                </>
              ) : (
                <Text c="dimmed" ta="center" py="md">
                  No matches found. Try importing more bank statements or recording more transfers.
                </Text>
              )}

              <Group justify="flex-end" mt="md">
                <Button
                  variant="subtle"
                  onClick={() => {
                    setAutoMatchModalOpen(false);
                    setAutoMatchResults(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApplyMatches}
                  loading={applyMatchesMutation.isPending}
                  disabled={selectedMatches.length === 0}
                >
                  Apply {selectedMatches.length} Matches
                </Button>
              </Group>
            </>
          ) : null}
        </Stack>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        opened={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setSelectedReconciliation(null);
        }}
        title="Review Reconciliation"
        size="md"
      >
        {selectedReconciliation && (
          <Stack gap="md">
            <Paper p="md" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Transaction</Text>
                  <Text size="sm" fw={500}>
                    {selectedReconciliation.transaction?.referenceNumber || `TXN-${selectedReconciliation.transactionId}`}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Amount</Text>
                  <Text size="sm" fw={500}>{formatCurrency(selectedReconciliation.matchedAmount)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Match Type</Text>
                  <Badge color={getMatchTypeColor(selectedReconciliation.matchType)} size="sm">
                    {selectedReconciliation.matchType.replace('_', ' ')}
                  </Badge>
                </Group>
                {Number(selectedReconciliation.variance) !== 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Variance</Text>
                    <Text size="sm" c="red" fw={500}>{formatCurrency(selectedReconciliation.variance)}</Text>
                  </Group>
                )}
              </Stack>
            </Paper>

            <Alert color="blue">
              Confirming this reconciliation will mark the transaction as paid and create a payment record.
            </Alert>

            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconX size={16} />}
                onClick={() => handleConfirm('DISPUTED')}
                loading={confirmMutation.isPending}
              >
                Dispute
              </Button>
              <Button
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={() => handleConfirm('CONFIRMED')}
                loading={confirmMutation.isPending}
              >
                Confirm
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
