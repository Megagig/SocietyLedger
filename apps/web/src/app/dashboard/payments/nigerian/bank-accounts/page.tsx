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
  Modal,
  TextInput,
  Select,
  Switch,
  Loader,
  Alert,
  ActionIcon,
  Menu
} from '@mantine/core';
import { 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconBuildingBank, 
  IconRefresh,
  IconStar,
  IconStarFilled,
  IconDotsVertical
} from '@tabler/icons-react';
import nigerianPaymentsApi, { BankAccount } from '@/lib/api/nigerian-payments';

export default function BankAccountsList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState({
    bankName: '',
    bankCode: '',
    accountName: '',
    accountNumber: '',
    description: '',
    isDefault: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const accounts = await nigerianPaymentsApi.getBankAccounts();
      setAccounts(accounts);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAccount(null);
    setFormData({
      bankName: '',
      bankCode: '',
      accountName: '',
      accountNumber: '',
      description: '',
      isDefault: false,
    });
    setShowCreateModal(true);
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      bankName: account.bankName,
      bankCode: account.bankCode || '',
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      description: account.description || '',
      isDefault: account.isDefault,
    });
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) {
      return;
    }
    try {
      await nigerianPaymentsApi.deleteBankAccount(id);
      loadAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete bank account');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await nigerianPaymentsApi.setDefaultBankAccount(id);
      loadAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to set default bank account');
    }
  };

  const handleFormSubmit = async () => {
    try {
      setSubmitting(true);
      if (editingAccount) {
        await nigerianPaymentsApi.updateBankAccount(editingAccount.id, formData);
      } else {
        await nigerianPaymentsApi.createBankAccount(formData);
      }
      setShowCreateModal(false);
      setEditingAccount(null);
      loadAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save bank account');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Group justify="space-between" mb="md">
        <Title order={2}>Bank Accounts</Title>
        <Button leftSection={<IconPlus size={20} />} onClick={handleCreate}>
          Add Bank Account
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Error" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {accounts.length === 0 && !loading ? (
        <Card shadow="sm" padding="xl" withBorder>
          <Stack align="center" gap="md">
            <IconBuildingBank size={48} className="text-gray-400" />
            <Text c="dimmed" ta="center">
              No bank accounts found. Add your first bank account to get started.
            </Text>
            <Button onClick={handleCreate} variant="light">
              Add Bank Account
            </Button>
          </Stack>
        </Card>
      ) : (
        <Card shadow="sm" padding="0" withBorder>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Bank Name</Table.Th>
                <Table.Th>Account Name</Table.Th>
                <Table.Th>Account Number</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {accounts.map((account) => (
                <Table.Tr key={account.id}>
                  <Table.Td>
                    <Group gap="xs">
                      {account.isDefault && <IconStarFilled size={16} className="text-yellow-500" />}
                      <Text fw={500}>{account.bankName}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>{account.accountName}</Table.Td>
                  <Table.Td className="font-mono">{account.accountNumber}</Table.Td>
                  <Table.Td>
                    <Badge color={account.isActive ? 'green' : 'red'}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconDotsVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => handleEdit(account)}>
                          Edit
                        </Menu.Item>
                        {!account.isDefault && (
                          <Menu.Item leftSection={<IconStar size={14} />} onClick={() => handleSetDefault(account.id)}>
                            Set as Default
                          </Menu.Item>
                        )}
                        <Menu.Divider />
                        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => handleDelete(account.id)}>
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        opened={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingAccount(null);
        }}
        title={editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Bank Name"
            placeholder="Enter bank name"
            value={formData.bankName}
            onChange={(e) => setFormData({ ...formData, bankName: e.currentTarget.value })}
            required
          />
          <TextInput
            label="Bank Code"
            placeholder="Enter bank code"
            value={formData.bankCode}
            onChange={(e) => setFormData({ ...formData, bankCode: e.currentTarget.value })}
          />
          <TextInput
            label="Account Name"
            placeholder="Enter account name"
            value={formData.accountName}
            onChange={(e) => setFormData({ ...formData, accountName: e.currentTarget.value })}
            required
          />
          <TextInput
            label="Account Number"
            placeholder="Enter 10-digit account number"
            value={formData.accountNumber}
            onChange={(e) => setFormData({ ...formData, accountNumber: e.currentTarget.value })}
            maxLength={10}
            required
          />
          <TextInput
            label="Description"
            placeholder="Optional description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
          />
          <Switch
            label="Set as default account"
            checked={formData.isDefault}
            onChange={(e) => setFormData({ ...formData, isDefault: e.currentTarget.checked })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleFormSubmit} loading={submitting}>
              {editingAccount ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
