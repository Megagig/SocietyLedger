'use client';

import { useState } from 'react';
import { Modal, Stack, Group, Text, Button, Badge, Progress, Alert, ScrollArea, Checkbox, Card } from '@mantine/core';
import { IconCheck, IconX, IconAlertTriangle } from '@tabler/icons-react';
import nigerianPaymentsApi from '@/lib/api/nigerian-payments';

interface ProposedMatch {
  bankStatementEntryId: string;
  bankTransferId?: string;
  transactionId?: string;
  variance: number;
  confidenceScore: number;
}

interface AutoMatchPreviewProps {
  matches: ProposedMatch[];
  onApply: (matches: ProposedMatch[]) => void;
  onCancel: () => void;
}

export function AutoMatchPreview({ matches, onApply, onCancel }: AutoMatchPreviewProps) {
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMatch = (id: string) => {
    setSelectedMatches(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedMatches(matches.map(m => m.bankStatementEntryId));
  };

  const handleApply = async () => {
    if (selectedMatches.length === 0) {
      setError('Please select at least one match to apply');
      return;
    }

    setApplying(true);
    try {
      await onApply(matches.filter(m => selectedMatches.includes(m.bankStatementEntryId)));
      onCancel();
    } catch (err: any) {
      setError(err.message || 'Failed to apply matches');
    } finally {
      setApplying(false);
    }
  };

  const highConfidenceMatches = matches.filter(m => m.confidenceScore >= 80);
  const mediumConfidenceMatches = matches.filter(m => m.confidenceScore >= 50 && m.confidenceScore < 80);
  const lowConfidenceMatches = matches.filter(m => m.confidenceScore < 50);

  const lowConfidenceLabel = 'Low Confidence (<50%):';

  return (
    <Modal
      opened={true}
      onClose={onCancel}
      title="Auto-Match Results Preview"
      size="xl"
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertTriangle />} mb="md" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Group justify="space-between" mb="md">
          <Text fw={600}>
            Found {matches.length} potential matches
          </Text>
          <Button size="xs" variant="subtle" onClick={toggleAll}>
            {selectedMatches.length === matches.length ? 'Deselect All' : 'Select All'}
          </Button>
        </Group>

        {/* Summary */}
        <Card shadow="sm" padding="md" withBorder mb="md">
          <Group gap="xs">
            <Text size="sm" c="dimmed">High Confidence (80%+):</Text>
            <Badge color="green" variant="light">{highConfidenceMatches.length}</Badge>
          </Group>
          <Group gap="xs">
            <Text size="sm" c="dimmed">Medium Confidence (50-79%):</Text>
            <Badge color="yellow" variant="light">{mediumConfidenceMatches.length}</Badge>
          </Group>
          <Group gap="xs">
            <Text size="sm" c="dimmed">{lowConfidenceLabel}</Text>
            <Badge color="red" variant="light">{lowConfidenceMatches.length}</Badge>
          </Group>
        </Card>

        {/* Matches List */}
        <ScrollArea h={400}>
          <Stack gap="xs">
            {highConfidenceMatches.map((match) => (
              <Card
                key={match.bankStatementEntryId}
                shadow="xs"
                padding="md"
                withBorder
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => toggleMatch(match.bankStatementEntryId)}
              >
                <Group justify="space-between" mb="xs">
                  <Checkbox
                    checked={selectedMatches.includes(match.bankStatementEntryId)}
                    onChange={() => toggleMatch(match.bankStatementEntryId)}
                  />
                  <Badge color="green" variant="light" size="sm">
                    {match.confidenceScore}%
                  </Badge>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500}>Entry:</Text>
                  <Text className="font-mono">{match.bankStatementEntryId.slice(0, 8)}...</Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500}>Transfer:</Text>
                  <Text className="font-mono">{match.bankTransferId ? match.bankTransferId.slice(0, 8) + '...' : 'N/A'}</Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500}>Transaction:</Text>
                  <Text className="font-mono">{match.transactionId ? match.transactionId.slice(0, 8) + '...' : 'N/A'}</Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" c="dimmed">Variance:</Text>
                  <Text fw={700} c={match.variance > 0 ? 'red' : 'green'}>
                    ₦{match.variance.toLocaleString()}
                  </Text>
                </Group>
              </Card>
            ))}

            {mediumConfidenceMatches.map((match) => (
              <Card
                key={match.bankStatementEntryId}
                shadow="xs"
                padding="md"
                withBorder
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => toggleMatch(match.bankStatementEntryId)}
              >
                <Group justify="space-between" mb="xs">
                  <Checkbox
                    checked={selectedMatches.includes(match.bankStatementEntryId)}
                    onChange={() => toggleMatch(match.bankStatementEntryId)}
                  />
                  <Badge color="yellow" variant="light" size="sm">
                    {match.confidenceScore}%
                  </Badge>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500}>Entry:</Text>
                  <Text className="font-mono">{match.bankStatementEntryId.slice(0, 8)}...</Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500}>Transfer:</Text>
                  <Text className="font-mono">{match.bankTransferId ? match.bankTransferId.slice(0, 8) + '...' : 'N/A'}</Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500}>Transaction:</Text>
                  <Text className="font-mono">{match.transactionId ? match.transactionId.slice(0, 8) + '...' : 'N/A'}</Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" c="dimmed">Variance:</Text>
                  <Text fw={700} c={match.variance > 0 ? 'red' : 'green'}>
                    ₦{match.variance.toLocaleString()}
                  </Text>
                </Group>
              </Card>
            ))}

            {lowConfidenceMatches.map((match) => (
              <Card
                key={match.bankStatementEntryId}
                shadow="xs"
                padding="md"
                withBorder
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => toggleMatch(match.bankStatementEntryId)}
              >
                <Group justify="space-between" mb="xs">
                  <Checkbox
                    checked={selectedMatches.includes(match.bankStatementEntryId)}
                    onChange={() => toggleMatch(match.bankStatementEntryId)}
                  />
                  <Badge color="red" variant="light" size="sm">
                    {match.confidenceScore}%
                  </Badge>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500}>Entry:</Text>
                  <Text className="font-mono">{match.bankStatementEntryId.slice(0, 8)}...</Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500}>Transfer:</Text>
                  <Text className="font-mono">{match.bankTransferId ? match.bankTransferId.slice(0, 8) + '...' : 'N/A'}</Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500}>Transaction:</Text>
                  <Text className="font-mono">{match.transactionId ? match.transactionId.slice(0, 8) + '...' : 'N/A'}</Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" c="dimmed">Variance:</Text>
                  <Text fw={700} c={match.variance > 0 ? 'red' : 'green'}>
                    ₦{match.variance.toLocaleString()}
                  </Text>
                </Group>
              </Card>
            ))}
          </Stack>
        </ScrollArea>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={onCancel} disabled={applying}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            loading={applying}
            disabled={selectedMatches.length === 0}
            leftSection={applying ? null : <IconCheck size={18} />}
          >
            Apply {selectedMatches.length} Match{selectedMatches.length !== 1 ? 'es' : ''}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
