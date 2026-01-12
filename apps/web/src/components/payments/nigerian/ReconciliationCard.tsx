'use client';

import { useState } from 'react';
import { Card, Text, Group, Badge, Stack, ActionIcon, Menu, Modal, Button } from '@mantine/core';
import { IconEye, IconTrash, IconDots } from '@tabler/icons-react';
import { Reconciliation } from '@/lib/api/nigerian-payments';

interface ReconciliationCardProps {
  reconciliation: Reconciliation;
  onView: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ReconciliationCard({ reconciliation, onView, onDelete }: ReconciliationCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(reconciliation.id);
    }
    setShowDeleteModal(false);
  };

  return (
    <>
      <Card shadow="sm" padding="lg" withBorder>
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <Text size="sm" c="dimmed">Bank Entry:</Text>
            <Text size="sm" fw={500} className="font-mono">
              {reconciliation.bankStatementEntryId ? reconciliation.bankStatementEntryId.slice(0, 8) + '...' : 'N/A'}
            </Text>
          </Group>
          <Badge color={reconciliation.status === 'PENDING' ? 'yellow' : reconciliation.status === 'CONFIRMED' ? 'green' : 'red'} variant="light">
            {reconciliation.status}
          </Badge>
        </Group>

        <Stack gap="xs">
          <Group gap="xs">
            <Text size="sm" c="dimmed">Bank Transfer:</Text>
            <Text size="sm" fw={500} className="font-mono">
              {reconciliation.bankTransferId ? reconciliation.bankTransferId.slice(0, 8) + '...' : 'N/A'}
            </Text>
          </Group>

          <Group gap="xs">
            <Text size="sm" c="dimmed">Transaction:</Text>
            <Text size="sm" fw={500} className="font-mono">
              {reconciliation.transactionId ? reconciliation.transactionId.slice(0, 8) + '...' : 'N/A'}
            </Text>
          </Group>

          <Group gap="xs">
            <Text size="sm" c="dimmed">Variance:</Text>
            <Text fw={700} c={reconciliation.variance > 0 ? 'red' : 'green'}>
              ₦{reconciliation.variance.toLocaleString()}
            </Text>
          </Group>

          {reconciliation.confidenceScore !== undefined && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">Confidence:</Text>
              <Badge
                color={reconciliation.confidenceScore > 80 ? 'green' : reconciliation.confidenceScore > 50 ? 'yellow' : 'red'}
                variant="light"
              >
                {reconciliation.confidenceScore}%
              </Badge>
            </Group>
          )}

          {reconciliation.reconciledBy && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">Reconciled By:</Text>
              <Text>{reconciliation.reconciledBy}</Text>
            </Group>
          )}

          {reconciliation.reconciledAt && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">Reconciled At:</Text>
              <Text>{new Date(reconciliation.reconciledAt).toLocaleString()}</Text>
            </Group>
          )}
        </Stack>

        <Group justify="space-between" mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          <Text size="xs" c="dimmed">
            Created: {new Date(reconciliation.createdAt).toLocaleString()}
          </Text>
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDots size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEye size={16} />} onClick={() => onView(reconciliation.id)}>
                View Details
              </Menu.Item>
              {reconciliation.status === 'PENDING' && onDelete && (
                <Menu.Item 
                  leftSection={<IconTrash size={16} />} 
                  color="red"
                  onClick={handleDelete}
                >
                  Delete
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Card>

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
    </>
  );
}
