'use client';

import { useState } from 'react';
import { Card, Text, Group, Button, Badge, Stack, ActionIcon, Menu, Modal } from '@mantine/core';
import { IconEdit, IconTrash, IconStarFilled, IconStar, IconDots } from '@tabler/icons-react';
import { BankAccount } from '@/lib/api/nigerian-payments';

interface BankAccountCardProps {
  account: BankAccount;
  onEdit: (account: BankAccount) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export function BankAccountCard({ account, onEdit, onDelete, onSetDefault }: BankAccountCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    onDelete(account.id);
    setShowDeleteModal(false);
  };

  return (
    <>
      <Card shadow="sm" padding="lg" withBorder>
        <Group justify="space-between" mb="xs">
          <Group gap="sm">
            {account.isDefault && (
              <Badge color="yellow" variant="light" leftSection={<IconStarFilled size={14} />}>
                Default
              </Badge>
            )}
            <Text fw={600} size="lg">
              {account.bankName}
            </Text>
          </Group>
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDots size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => onEdit(account)}>
                Edit
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconStar size={16} />} 
                onClick={() => onSetDefault(account.id)}
                disabled={account.isDefault}
              >
                {account.isDefault ? 'Default Account' : 'Set as Default'}
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconTrash size={16} />} 
                color="red"
                onClick={handleDelete}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Stack gap="xs">
          <Group gap="xs">
            <Text size="sm" c="dimmed">Account Name:</Text>
            <Text size="sm" fw={500}>{account.accountName}</Text>
          </Group>

          <Group gap="xs">
            <Text size="sm" c="dimmed">Account Number:</Text>
            <Text size="sm" fw={500} className="font-mono">
              {account.accountNumber.slice(0, 4)} **** {account.accountNumber.slice(-4)}
            </Text>
          </Group>

          <Group gap="xs">
            <Text size="sm" c="dimmed">Bank Code:</Text>
            <Text size="sm" fw={500}>{account.bankCode}</Text>
          </Group>

          {account.description && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">Description:</Text>
              <Text size="sm">{account.description}</Text>
            </Group>
          )}

          <Group gap="xs">
            <Text size="sm" c="dimmed">Status:</Text>
            <Badge color={account.isActive ? 'green' : 'red'} variant="light">
              {account.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </Group>
        </Stack>

        <Group justify="space-between" mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          <Text size="xs" c="dimmed">
            Created: {new Date(account.createdAt).toLocaleDateString()}
          </Text>
          <Button size="xs" variant="light" onClick={() => onEdit(account)}>
            Manage
          </Button>
        </Group>
      </Card>

      <Modal
        opened={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Bank Account"
        size="sm"
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to delete the bank account <Text fw={700}>&quot;{account.accountName}&quot;</Text>?
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
