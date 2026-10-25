'use client';

import { useEffect, useState } from 'react';
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
  TextInput,
  Textarea,
  Switch,
  Select,
  LoadingOverlay,
  Alert,
  ActionIcon,
  Menu,
  CopyButton,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import {
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Copy,
  Check,
  AlertCircle,
  Building2,
  Star,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import nigerianPaymentsApi, {
  type BankAccount,
  type NigerianBank,
} from '@/lib/api/nigerian-payments';
import { notifications } from '@mantine/notifications';

export default function BankAccountsPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: {
      bankName: '',
      bankCode: '',
      accountName: '',
      accountNumber: '',
      isDefault: false,
      description: '',
    },
    validate: {
      bankName: (value) => (!value ? 'Bank name is required' : null),
      accountName: (value) => (!value ? 'Account name is required' : null),
      accountNumber: (value) => {
        if (!value) return 'Account number is required';
        if (!/^\d{10}$/.test(value)) return 'Account number must be 10 digits';
        return null;
      },
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountsRes, banksRes] = await Promise.all([
        nigerianPaymentsApi.getBankAccounts(),
        nigerianPaymentsApi.getNigerianBanks(),
      ]);
      setAccounts(accountsRes || []);
      setBanks(banksRes || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to load bank accounts',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account);
      form.setValues({
        bankName: account.bankName,
        bankCode: account.bankCode || '',
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        isDefault: account.isDefault,
        description: account.description || '',
      });
    } else {
      setEditingAccount(null);
      form.reset();
    }
    setModalOpened(true);
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setSubmitting(true);
      if (editingAccount) {
        await nigerianPaymentsApi.updateBankAccount(editingAccount.id, values);
        notifications.show({
          title: 'Success',
          message: 'Bank account updated successfully',
          color: 'green',
        });
      } else {
        await nigerianPaymentsApi.createBankAccount(values);
        notifications.show({
          title: 'Success',
          message: 'Bank account created successfully',
          color: 'green',
        });
      }
      setModalOpened(false);
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to save bank account',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (account: BankAccount) => {
    modals.openConfirmModal({
      title: 'Remove Bank Account',
      children: (
        <Text size="sm">
          Members will no longer be told to pay into this account.
          {account.isDefault ? ' Another account will become the default.' : ''} An account with transfers or statements is kept as inactive
          instead of being deleted.
        </Text>
      ),
      labels: { confirm: 'Remove account', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await nigerianPaymentsApi.deleteBankAccount(account.id);
          notifications.show({
            title: 'Success',
            message: result.message,
            color: 'green',
          });
          loadData();
        } catch (error: any) {
          notifications.show({
            title: 'Error',
            message: error.response?.data?.message || 'Failed to delete bank account',
            color: 'red',
          });
        }
      },
    });
  };

  const handleSetDefault = async (account: BankAccount) => {
    try {
      await nigerianPaymentsApi.setDefaultBankAccount(account.id);
      notifications.show({
        title: 'Success',
        message: 'Default bank account updated',
        color: 'green',
      });
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to update default account',
        color: 'red',
      });
    }
  };

  const handleReactivate = async (account: BankAccount) => {
    try {
      await nigerianPaymentsApi.reactivateBankAccount(account.id);
      notifications.show({ title: 'Success', message: 'Bank account reactivated', color: 'green' });
      loadData();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.response?.data?.message || 'Failed to reactivate the account', color: 'red' });
    }
  };

  const activeCount = accounts.filter((account) => account.isActive).length;

  const bankOptions = banks.map((bank) => ({
    value: bank.code,
    label: bank.name,
  }));

  return (
    <Can anyPermissions={[PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.PAYMENT_RECORD, PERMISSIONS.PAYMENT_VIEW]} fallback={<Alert color="red">You don&apos;t have permission to manage bank accounts</Alert>}>
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Bank Accounts</Title>
            <Text size="sm" c="dimmed">
              Members see your active accounts, the default first, when they pay by bank transfer — on the website and in the app. Keep the
              bank, number and name exactly as your bank has them.
            </Text>
          </div>
          <Can anyPermissions={[PERMISSIONS.SETTINGS_EDIT, PERMISSIONS.PAYMENT_RECORD]}>
            <Button
              leftSection={<Plus size={16} />}
              onClick={() => handleOpenModal()}
            >
              Add Bank Account
            </Button>
          </Can>
        </Group>

        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />

          {accounts.length === 0 ? (
            <Stack align="center" py="xl">
              <Building2 size={48} color="gray" />
              <Text size="sm" c="dimmed" ta="center">
                No bank accounts yet. Add the account members should pay into. Until you do, they have nowhere to send a transfer.
              </Text>
              <Can anyPermissions={[PERMISSIONS.SETTINGS_EDIT, PERMISSIONS.PAYMENT_RECORD]}>
                <Button
                  leftSection={<Plus size={16} />}
                  onClick={() => handleOpenModal()}
                  mt="md"
                >
                  Add Bank Account
                </Button>
              </Can>
            </Stack>
          ) : (
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
                        {account.isDefault && (
                          <Tooltip label="Default Account">
                            <Star size={16} color="gold" fill="gold" />
                          </Tooltip>
                        )}
                        <Text fw={500}>{account.bankName}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>{account.accountName}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Text>{account.accountNumber}</Text>
                        <CopyButton value={account.accountNumber}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Copied' : 'Copy'}>
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color={copied ? 'teal' : 'gray'}
                                onClick={copy}
                              >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={account.isActive ? 'green' : 'red'} size="sm">
                        {account.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Can anyPermissions={[PERMISSIONS.SETTINGS_EDIT, PERMISSIONS.PAYMENT_RECORD]}>
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle">
                              <MoreVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {account.isActive && !account.isDefault && (
                              <Menu.Item
                                leftSection={<Star size={14} />}
                                onClick={() => handleSetDefault(account)}
                              >
                                Set as Default
                              </Menu.Item>
                            )}
                            {!account.isActive && (
                              <Menu.Item
                                leftSection={<Check size={14} />}
                                onClick={() => handleReactivate(account)}
                              >
                                Reactivate
                              </Menu.Item>
                            )}
                            <Menu.Item
                              leftSection={<Edit size={14} />}
                              onClick={() => handleOpenModal(account)}
                            >
                              Edit
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              leftSection={<Trash2 size={14} />}
                              color="red"
                              disabled={account.isActive && activeCount <= 1}
                              onClick={() => handleDelete(account)}
                            >
                              {account.isActive ? (activeCount <= 1 ? 'Remove (add another account first)' : 'Remove') : 'Delete'}
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Can>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        {/* Add/Edit Modal */}
        <Modal
          opened={modalOpened}
          onClose={() => setModalOpened(false)}
          title={editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
          size="lg"
        >
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <Select
                label="Bank Name"
                placeholder="Select bank"
                data={bankOptions}
                searchable
                required
                {...form.getInputProps('bankCode')}
                onChange={(value) => {
                  const bank = banks.find((b) => b.code === value);
                  form.setFieldValue('bankCode', value || '');
                  form.setFieldValue('bankName', bank?.name || '');
                }}
              />

              <TextInput
                label="Account Name"
                placeholder="Enter account name"
                required
                {...form.getInputProps('accountName')}
              />

              <TextInput
                label="Account Number"
                placeholder="Enter 10-digit account number"
                required
                maxLength={10}
                {...form.getInputProps('accountNumber')}
              />

              <Textarea
                label="Description"
                placeholder="Optional description"
                rows={3}
                {...form.getInputProps('description')}
              />

              {/* The first account is always the default, and the default only moves by making another account the default. */}
              <Switch
                label="Set as default account"
                description={
                  editingAccount?.isDefault
                    ? 'This is the default account. To change it, make another account the default.'
                    : activeCount === 0 && !editingAccount
                      ? 'Your first account is always the default.'
                      : 'The default is shown to members first.'
                }
                disabled={Boolean(editingAccount?.isDefault) || (activeCount === 0 && !editingAccount)}
                {...form.getInputProps('isDefault', { type: 'checkbox' })}
              />

              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={() => setModalOpened(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={submitting}>
                  {editingAccount ? 'Update' : 'Create'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Can>
  );
}
