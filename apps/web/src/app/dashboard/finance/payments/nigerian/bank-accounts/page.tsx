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
  ActionIcon,
  Modal,
  TextInput,
  Select,
  Checkbox,
  Textarea,
  LoadingOverlay,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconArrowLeft,
  IconBuildingBank,
  IconCheck,
} from '@tabler/icons-react';
import Link from 'next/link';
import {
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getNigerianBanks,
  BankAccount,
} from '@/lib/api/nigerian-payments';

export default function BankAccountsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => getBankAccounts(),
  });

  const { data: banksData } = useQuery({
    queryKey: ['nigerian-banks'],
    queryFn: getNigerianBanks,
  });

  const accounts = accountsData?.data?.accounts || [];
  const banks = banksData?.data?.banks || [];

  const form = useForm({
    initialValues: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      bankCode: '',
      isDefault: false,
      description: '',
    },
    validate: {
      bankName: (value) => (!value ? 'Bank name is required' : null),
      accountName: (value) => (!value ? 'Account name is required' : null),
      accountNumber: (value) => {
        if (!value) return 'Account number is required';
        if (value.length !== 10) return 'Account number must be 10 digits';
        if (!/^\d+$/.test(value)) return 'Account number must contain only digits';
        return null;
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: createBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      notifications.show({
        title: 'Success',
        message: 'Bank account created successfully',
        color: 'green',
      });
      closeModal();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to create bank account',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateBankAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      notifications.show({
        title: 'Success',
        message: 'Bank account updated successfully',
        color: 'green',
      });
      closeModal();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to update bank account',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      notifications.show({
        title: 'Success',
        message: 'Bank account deleted successfully',
        color: 'green',
      });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to delete bank account',
        color: 'red',
      });
    },
  });

  const openCreateModal = () => {
    setEditingAccount(null);
    form.reset();
    setModalOpen(true);
  };

  const openEditModal = (account: BankAccount) => {
    setEditingAccount(account);
    form.setValues({
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      bankCode: account.bankCode || '',
      isDefault: account.isDefault,
      description: account.description || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAccount(null);
    form.reset();
  };

  const handleSubmit = (values: typeof form.values) => {
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleBankSelect = (bankName: string | null) => {
    if (bankName) {
      const bank = banks.find((b) => b.name === bankName);
      form.setFieldValue('bankName', bankName);
      if (bank && bank.code !== 'OTHER') {
        form.setFieldValue('bankCode', bank.code);
      } else {
        form.setFieldValue('bankCode', '');
      }
    }
  };

  const isOtherBank = form.values.bankName === 'Other (Enter manually)';

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
            <Title order={2}>Bank Accounts</Title>
            <Text c="dimmed">Manage your association's receiving bank accounts</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Add Bank Account
        </Button>
      </Group>

      <Card padding="lg" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        {accounts.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Bank</Table.Th>
                <Table.Th>Account Name</Table.Th>
                <Table.Th>Account Number</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {accounts.map((account: BankAccount) => (
                <Table.Tr key={account.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <IconBuildingBank size={16} />
                      <Text size="sm" fw={500}>
                        {account.bankName}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>{account.accountName}</Table.Td>
                  <Table.Td>
                    <Text ff="monospace">{account.accountNumber}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {account.isDefault && (
                        <Badge size="sm" color="green">
                          Default
                        </Badge>
                      )}
                      <Badge size="sm" color={account.isActive ? 'blue' : 'gray'}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => openEditModal(account)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleteConfirmId(account.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            No bank accounts configured. Click "Add Bank Account" to create one.
          </Text>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Select
              label="Bank"
              placeholder="Select a bank"
              data={banks.map((b) => b.name)}
              searchable
              value={form.values.bankName}
              onChange={handleBankSelect}
              error={form.errors.bankName}
              required
            />
            {isOtherBank && (
              <TextInput
                label="Custom Bank Name"
                placeholder="Enter the bank name"
                value={form.values.bankName === 'Other (Enter manually)' ? '' : form.values.bankName}
                onChange={(e) => form.setFieldValue('bankName', e.target.value)}
                required
              />
            )}
            <TextInput
              label="Account Name"
              placeholder="Enter account name"
              {...form.getInputProps('accountName')}
              required
            />
            <TextInput
              label="Account Number"
              placeholder="Enter 10-digit account number"
              maxLength={10}
              {...form.getInputProps('accountNumber')}
              required
            />
            <TextInput
              label="Bank Code"
              placeholder={isOtherBank ? "Enter bank code (optional)" : "Bank code (auto-filled)"}
              {...form.getInputProps('bankCode')}
              disabled={!isOtherBank}
            />
            <Textarea
              label="Description"
              placeholder="Optional description"
              {...form.getInputProps('description')}
            />
            <Checkbox
              label="Set as default account"
              {...form.getInputProps('isDefault', { type: 'checkbox' })}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingAccount ? 'Update' : 'Create'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Bank Account"
        size="sm"
      >
        <Stack gap="md">
          <Alert color="red">
            Are you sure you want to delete this bank account? This action cannot be undone.
          </Alert>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteMutation.isPending}
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
