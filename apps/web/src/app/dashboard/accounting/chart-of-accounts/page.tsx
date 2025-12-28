'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Text,
  Group,
  Badge,
  Stack,
  Loader,
  Alert,
  Button,
  Table,
  Modal,
  TextInput,
  Select,
  Textarea,
  ActionIcon,
  Menu,
  Switch,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconReceipt,
  IconLock,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconFilter,
} from '@tabler/icons-react';
import { accountingApi, ChartOfAccount } from '@/lib/api/accounting';
import { toast } from '@/lib/toast';

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
];

const SUB_TYPES: Record<string, { value: string; label: string }[]> = {
  ASSET: [
    { value: 'current_asset', label: 'Current Asset' },
    { value: 'fixed_asset', label: 'Fixed Asset' },
    { value: 'other_asset', label: 'Other Asset' },
  ],
  LIABILITY: [
    { value: 'current_liability', label: 'Current Liability' },
    { value: 'long_term_liability', label: 'Long-term Liability' },
  ],
  EQUITY: [
    { value: 'equity', label: 'Equity' },
  ],
  INCOME: [
    { value: 'operating_income', label: 'Operating Income' },
    { value: 'other_income', label: 'Other Income' },
  ],
  EXPENSE: [
    { value: 'operating_expense', label: 'Operating Expense' },
    { value: 'program_expense', label: 'Program Expense' },
    { value: 'other_expense', label: 'Other Expense' },
  ],
};

export default function ChartOfAccountsPage() {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      type: 'ASSET',
      subType: '',
      description: '',
      parentId: '',
      normalBalance: 'DEBIT',
    },
    validate: {
      code: (value) => (!value ? 'Account code is required' : null),
      name: (value) => (!value ? 'Account name is required' : null),
    },
  });

  const { data: accountsData, isLoading, error, refetch } = useQuery({
    queryKey: ['chart-of-accounts', filterType, showInactive],
    queryFn: () =>
      accountingApi.getChartOfAccounts({
        type: filterType || undefined,
        isActive: showInactive ? undefined : true,
        includeBalances: true,
      }),
    retry: false,
  });

  const initializeMutation = useMutation({
    mutationFn: () => accountingApi.initializeChartOfAccounts(),
    onSuccess: () => {
      toast.success('Chart of accounts initialized successfully');
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to initialize chart of accounts');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => accountingApi.createAccount(data),
    onSuccess: () => {
      toast.success('Account created successfully');
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      close();
      form.reset();
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to create account');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => accountingApi.updateAccount(id, data),
    onSuccess: () => {
      toast.success('Account updated successfully');
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      close();
      setEditingAccount(null);
      form.reset();
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to update account');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountingApi.deleteAccount(id),
    onSuccess: () => {
      toast.success('Account deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to delete account');
    },
  });

  useEffect(() => {
    if (error) {
      toast.apiError(error, 'Failed to load chart of accounts');
    }
  }, [error]);

  const accounts: ChartOfAccount[] = accountsData?.data || [];

  const handleEdit = (account: ChartOfAccount) => {
    setEditingAccount(account);
    form.setValues({
      code: account.code,
      name: account.name,
      type: account.type,
      subType: account.subType || '',
      description: account.description || '',
      parentId: account.parentId?.toString() || '',
      normalBalance: account.normalBalance,
    });
    open();
  };

  const handleSubmit = (values: typeof form.values) => {
    const data = {
      ...values,
      parentId: values.parentId ? parseInt(values.parentId) : undefined,
      subType: values.subType || undefined,
    };

    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleClose = () => {
    close();
    setEditingAccount(null);
    form.reset();
  };

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ASSET: 'blue',
      LIABILITY: 'red',
      EQUITY: 'purple',
      INCOME: 'green',
      EXPENSE: 'orange',
    };
    return colors[type] || 'gray';
  };

  const parentOptions = accounts
    .filter((a) => a.isActive && (!editingAccount || a.id !== editingAccount.id))
    .map((a) => ({ value: a.id.toString(), label: `${a.code} - ${a.name}` }));

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Chart of Accounts
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your association's account structure
        </p>
      </div>

      {/* Actions Bar */}
      <Card withBorder padding="md" mb="xl">
        <Group justify="space-between">
          <Group>
            <Select
              placeholder="Filter by type"
              data={[{ value: '', label: 'All Types' }, ...ACCOUNT_TYPES]}
              value={filterType}
              onChange={setFilterType}
              clearable
              leftSection={<IconFilter size={16} />}
              w={200}
            />
            <Switch
              label="Show inactive"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.currentTarget.checked)}
            />
          </Group>
          <Group>
            {accounts.length === 0 && (
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => initializeMutation.mutate()}
                loading={initializeMutation.isPending}
              >
                Initialize Standard Accounts
              </Button>
            )}
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Add Account
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Accounts Table */}
      {accounts.length === 0 ? (
        <Alert icon={<IconReceipt size={20} />} title="No Accounts Found" color="blue">
          <Text size="sm" mb="md">
            Your chart of accounts is empty. Click "Initialize Standard Accounts" to set up a standard chart of accounts, or add accounts manually.
          </Text>
        </Alert>
      ) : (
        <Card withBorder padding={0}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Sub-Type</Table.Th>
                <Table.Th>Balance</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th w={60}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {accounts.map((account) => (
                <Table.Tr key={account.id}>
                  <Table.Td>
                    <Text fw={500}>{account.code}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text>{account.name}</Text>
                    {account.description && (
                      <Text size="xs" c="dimmed">{account.description}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getTypeColor(account.type)} variant="light">
                      {account.type}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {account.subType?.replace(/_/g, ' ') || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>
                      {account.balance !== undefined ? formatCurrency(account.balance) : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={account.isActive ? 'green' : 'gray'} variant="dot">
                      {account.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {!account.isSystemAccount && (
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon variant="subtle">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEdit size={14} />}
                            onClick={() => handleEdit(account)}
                          >
                            Edit
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={() => deleteMutation.mutate(account.id)}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        opened={opened}
        onClose={handleClose}
        title={editingAccount ? 'Edit Account' : 'Add Account'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Account Code"
              placeholder="e.g., 1100"
              required
              disabled={!!editingAccount}
              {...form.getInputProps('code')}
            />

            <TextInput
              label="Account Name"
              placeholder="e.g., Cash and Cash Equivalents"
              required
              {...form.getInputProps('name')}
            />

            <Select
              label="Account Type"
              data={ACCOUNT_TYPES}
              required
              disabled={!!editingAccount}
              {...form.getInputProps('type')}
            />

            <Select
              label="Sub-Type"
              data={SUB_TYPES[form.values.type] || []}
              placeholder="Select sub-type"
              clearable
              {...form.getInputProps('subType')}
            />

            <Select
              label="Parent Account"
              data={parentOptions}
              placeholder="Select parent account"
              clearable
              searchable
              {...form.getInputProps('parentId')}
            />

            <Select
              label="Normal Balance"
              data={[
                { value: 'DEBIT', label: 'Debit' },
                { value: 'CREDIT', label: 'Credit' },
              ]}
              disabled={!!editingAccount}
              {...form.getInputProps('normalBalance')}
            />

            <Textarea
              label="Description"
              placeholder="Optional description"
              {...form.getInputProps('description')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={handleClose}>
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
    </div>
  );
}
