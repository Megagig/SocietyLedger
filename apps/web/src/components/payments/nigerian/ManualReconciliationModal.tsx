'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  Title,
  Text,
  Group,
  Button,
  Stack,
  Card,
  Badge,
  SimpleGrid,
  Loader,
  Alert,
  ScrollArea,
  Checkbox,
  TextInput,
  NumberInput
} from '@mantine/core';
import { 
  IconArrowRight,
  IconRefresh,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import nigerianPaymentsApi, { BankStatementEntry, BankTransfer } from '@/lib/api/nigerian-payments';

interface ManualReconciliationModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ManualReconciliationModal({ opened, onClose, onSuccess }: ManualReconciliationModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [unmatchedEntries, setUnmatchedEntries] = useState<BankStatementEntry[]>([]);
  const [unmatchedTransfers, setUnmatchedTransfers] = useState<BankTransfer[]>([]);
  
  const [selectedEntry, setSelectedEntry] = useState<BankStatementEntry | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<BankTransfer | null>(null);
  
  const [manualAmount, setManualAmount] = useState<number | ''>('');
  const [manualReference, setManualReference] = useState('');

  useEffect(() => {
    if (opened) {
      loadData();
    }
  }, [opened]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load unmatched bank statement entries
      const entriesResponse = await nigerianPaymentsApi.getStatementEntries({
        matchStatus: 'UNMATCHED',
        limit: 50
      });
      setUnmatchedEntries(entriesResponse.data);
      
      // Load unmatched bank transfers
      const transfersResponse = await nigerianPaymentsApi.getBankTransfers({
        status: 'PENDING',
        limit: 50
      });
      setUnmatchedTransfers(transfersResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async () => {
    if (!selectedEntry || !selectedTransfer) {
      setError('Please select both a bank statement entry and a bank transfer to match');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await nigerianPaymentsApi.createReconciliation({
        bankStatementEntryId: selectedEntry.id,
        bankTransferId: selectedTransfer.id
      });
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create reconciliation');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateVariance = () => {
    if (!selectedEntry || !selectedTransfer) return null;
    return selectedEntry.amount - selectedTransfer.amount;
  };

  const getVarianceColor = () => {
    const variance = calculateVariance();
    if (variance === null) return 'gray';
    if (variance === 0) return 'green';
    return 'red';
  };

  const getMatchConfidence = () => {
    if (!selectedEntry || !selectedTransfer) return 0;
    
    const variance = Math.abs(calculateVariance() || 0);
    const amountDiffRatio = variance / selectedEntry.amount;
    
    if (amountDiffRatio < 0.01) return 95; // Less than 1% difference
    if (amountDiffRatio < 0.05) return 80; // Less than 5% difference
    if (amountDiffRatio < 0.1) return 60;  // Less than 10% difference
    return 30; // More than 10% difference
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Manual Reconciliation"
      size="xl"
      padding="xl"
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" title="Error" icon={<IconX />}>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader size="xl" />
          </div>
        ) : (
          <>
            {/* Match Summary */}
            {(selectedEntry && selectedTransfer) && (
              <Card shadow="sm" padding="md" withBorder>
                <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
                  <Stack align="center" gap="xs">
                    <Text size="sm" c="dimmed">Variance</Text>
                    <Text size="xl" fw={700} c={getVarianceColor()}>
                      {calculateVariance() !== null ? `₦${Math.abs(calculateVariance() || 0).toLocaleString()}` : '-'}
                    </Text>
                  </Stack>

                  <Stack align="center" gap="xs">
                    <Text size="sm" c="dimmed">Match Confidence</Text>
                    <Badge
                      size="lg"
                      color={getMatchConfidence() >= 80 ? 'green' : getMatchConfidence() >= 50 ? 'yellow' : 'red'}
                    >
                      {getMatchConfidence()}%
                    </Badge>
                  </Stack>

                  <Stack align="center" gap="xs">
                    <Text size="sm" c="dimmed">Action</Text>
                    <Button 
                      leftSection={<IconCheck size={20} />} 
                      onClick={handleMatch}
                      loading={submitting}
                      disabled={calculateVariance() !== null && Math.abs(calculateVariance() || 0) > 100}
                    >
                      Match
                    </Button>
                  </Stack>
                </SimpleGrid>
              </Card>
            )}

            {/* Bank Statement Entries */}
            <div>
              <Title order={4} mb="md">
                Unmatched Bank Statement Entries ({unmatchedEntries.length})
              </Title>
              <ScrollArea h={200}>
                <Stack gap="sm">
                  {unmatchedEntries.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="xl">
                      No unmatched bank statement entries found
                    </Text>
                  ) : (
                    unmatchedEntries.map((entry) => (
                      <Card
                        key={entry.id}
                        shadow="sm"
                        padding="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          border: selectedEntry?.id === entry.id ? '2px solid #228be6' : undefined
                        }}
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <Group justify="space-between">
                          <Stack gap="xs">
                            <Group gap="xs">
                              <Text fw={600}>₦{entry.amount.toLocaleString()}</Text>
                              <Badge size="sm" variant="light">
                                {new Date(entry.date).toLocaleDateString()}
                              </Badge>
                            </Group>
                            <Text size="sm" lineClamp={1}>{entry.description}</Text>
                            <Text size="xs" c="dimmed" className="font-mono">{entry.reference}</Text>
                          </Stack>
                          <Checkbox
                            checked={selectedEntry?.id === entry.id}
                            onChange={() => setSelectedEntry(entry)}
                          />
                        </Group>
                      </Card>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </div>

            {/* Arrow Icon */}
            <div className="flex justify-center">
              <IconArrowRight size={32} className="text-blue-500" />
            </div>

            {/* Bank Transfers */}
            <div>
              <Title order={4} mb="md">
                Unmatched Bank Transfers ({unmatchedTransfers.length})
              </Title>
              <ScrollArea h={200}>
                <Stack gap="sm">
                  {unmatchedTransfers.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="xl">
                      No unmatched bank transfers found
                    </Text>
                  ) : (
                    unmatchedTransfers.map((transfer) => (
                      <Card
                        key={transfer.id}
                        shadow="sm"
                        padding="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          border: selectedTransfer?.id === transfer.id ? '2px solid #228be6' : undefined
                        }}
                        onClick={() => setSelectedTransfer(transfer)}
                      >
                        <Group justify="space-between">
                          <Stack gap="xs">
                            <Group gap="xs">
                              <Text fw={600}>₦{transfer.amount.toLocaleString()}</Text>
                              <Badge size="sm" variant="light">
                                {transfer.senderBankName}
                              </Badge>
                            </Group>
                            <Text size="sm">{transfer.senderAccountNumber}</Text>
                            <Text size="xs" c="dimmed">{transfer.narration || transfer.reference}</Text>
                          </Stack>
                          <Checkbox
                            checked={selectedTransfer?.id === transfer.id}
                            onChange={() => setSelectedTransfer(transfer)}
                          />
                        </Group>
                      </Card>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </div>

            {/* Manual Match Section */}
            <Card shadow="sm" padding="md" withBorder>
              <Title order={5} mb="sm">Manual Match (Optional)</Title>
              <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
                <NumberInput
                  label="Manual Amount"
                  placeholder="Enter amount"
                  value={manualAmount}
                  onChange={(value) => setManualAmount(typeof value === 'number' ? value : parseFloat(value) || '')}
                  prefix="₦"
                  decimalScale={2}
                />
                <TextInput
                  label="Manual Reference"
                  placeholder="Enter reference"
                  value={manualReference}
                  onChange={(e) => setManualReference(e.currentTarget.value)}
                />
              </SimpleGrid>
            </Card>

            {/* Actions */}
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={loadData} leftSection={<IconRefresh size={20} />}>
                Refresh
              </Button>
              <Button variant="light" onClick={onClose}>
                Cancel
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
