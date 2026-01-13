'use client';

import { useState } from 'react';
import { Button, Menu, ActionIcon, Modal, Stack, Group, Text, Textarea } from '@mantine/core';
import { IconEye, IconEdit, IconTrash, IconDots } from '@tabler/icons-react';
import { BankTransfer } from '@/lib/api/nigerian-payments';

interface TransferActionsProps {
  transfer: BankTransfer;
  onView: (id: string) => void;
  onEdit?: (transfer: BankTransfer) => void;
  onDelete?: (id: string) => void;
}

export function TransferActions({ transfer, onView, onEdit, onDelete }: TransferActionsProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(transfer.id);
    }
    setShowDeleteModal(false);
  };

  return (
    <>
      <Menu shadow="md" width={200} position="bottom-end">
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray">
            <IconDots size={20} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconEye size={16} />} onClick={() => onView(transfer.id)}>
            View Details
          </Menu.Item>
          {transfer.status === 'PENDING' && onEdit && (
            <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => setShowEditModal(true)}>
              Edit
            </Menu.Item>
          )}
          {transfer.status === 'PENDING' && onDelete && (
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

      {/* Delete Confirmation Modal */}
      <Modal
        opened={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Bank Transfer"
        size="sm"
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to delete this bank transfer?
          </Text>
          <Group gap="xs" mb="md">
            <Text size="sm" fw={500}>Reference:</Text>
            <Text size="sm">{transfer.reference}</Text>
          </Group>
          <Group gap="xs" mb="md">
            <Text size="sm" fw={500}>Amount:</Text>
            <Text size="sm" fw={700} c="green">₦{transfer.amount.toLocaleString()}</Text>
          </Group>
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
