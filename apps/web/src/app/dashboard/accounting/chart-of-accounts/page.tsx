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
import { DrillLink } from '@/components/reports/DrillLink';
import { entryHref, ledgerHref } from '@/lib/accounting-drill';

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
      isActive: true,
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
      isActive: account.isActive,
    });
    open();
  };

  const handleSubmit = (values: typeof form.values) => {
    if (editingAccount) {
      updateMutation.mutate({
        id: editingAccount.id,
        data: {
          name: values.name,
          subType: values.subType || null,
          description: values.description || null,
          // Clearing the parent takes the account out from under it
          parentId: values.parentId ? parseInt(values.parentId) : null,
          ...(editingAccount.isSystemAccount ? {} : { isActive: values.isActive }),
        },
      });
      return;
    }
    const { isActive: _unused, ...rest } = values;
    createMutation.mutate({
      ...rest,
      parentId: values.parentId ? parseInt(values.parentId) : undefined,
      subType: values.subType || undefined,
    });
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
      minimumFractionDigits: 2,
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
          Manage your association&apos;s account structure
        </p>
      </div>

      {/* Actions Bar */}
      <Card withBorder padding="md" mb="xl" className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              placeholder="Filter by type"
              data={[{ value: '', label: 'All Types' }, ...ACCOUNT_TYPES]}
              value={filterType}
              onChange={setFilterType}
              clearable
              leftSection={<IconFilter size={16} />}
              className="w-full sm:w-[200px]"
            />
            <Switch
              label="Show inactive"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.currentTarget.checked)}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {accounts.length === 0 && (
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => initializeMutation.mutate()}
                loading={initializeMutation.isPending}
                className="w-full sm:w-auto"
              >
                Initialize Standard Accounts
              </Button>
            )}
            <Button leftSection={<IconPlus size={16} />} onClick={open} className="w-full sm:w-auto">
              Add Account
            </Button>
          </div>
        </div>
      </Card>

      {/* Accounts Table */}
      {accounts.length === 0 ? (
        <Alert icon={<IconReceipt size={20} />} title="No Accounts Found" color="blue">
          <Text size="sm" mb="md">
            Your chart of accounts is empty. Click &quot;Initialize Standard Accounts&quot; to set up a standard chart of accounts, or add accounts manually.
          </Text>
        </Alert>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {accounts.map((account) => (
              <Card key={account.id} withBorder padding="sm" className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Text fw={600}>{account.code}</Text>
                    <Text size="sm"><DrillLink href={ledgerHref({ accountId: account.id, title: account.name })} label={account.name}>{account.name}</DrillLink></Text>
                    {account.description && (
                      <Text size="xs" c="dimmed" mt={2}>{account.description}</Text>
                    )}
                  </div>
                  <Menu position="bottom-end" withArrow>
                    <Menu.Target>
                      <ActionIcon variant="subtle" aria-label={`Actions for ${account.name}`}>
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
                      {!account.isSystemAccount && (
                        <Menu.Item
                          leftSection={<IconTrash size={14} />}
                          color="red"
                          onClick={() => deleteMutation.mutate(account.id)}
                        >
                          Delete
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge color={getTypeColor(account.type)} variant="light" size="sm">
                    {account.type}
                  </Badge>
                  <Badge color={account.isActive ? 'green' : 'gray'} variant="dot" size="sm">
                    {account.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <Text size="xs" c="dimmed">
                    {account.subType?.replace(/_/g, ' ') || '-'}
                  </Text>
                  <Text fw={500}>
                    {account.balance !== undefined ? (<DrillLink href={Number(account.balance) !== 0 ? ledgerHref({ accountId: account.id, title: account.name }) : undefined} label={account.name}>{formatCurrency(account.balance)}</DrillLink>) : '-'}
                  </Text>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <Card withBorder padding={0} className="hidden md:block">
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
                      <Text><DrillLink href={ledgerHref({ accountId: account.id, title: account.name })} label={account.name}>{account.name}</DrillLink></Text>
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
                        {account.balance !== undefined ? (<DrillLink href={Number(account.balance) !== 0 ? ledgerHref({ accountId: account.id, title: account.name }) : undefined} label={account.name}>{formatCurrency(account.balance)}</DrillLink>) : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={account.isActive ? 'green' : 'gray'} variant="dot">
                        {account.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon variant="subtle" aria-label={`Actions for ${account.name}`}>
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
                          {!account.isSystemAccount && (
                            <Menu.Item
                              leftSection={<IconTrash size={14} />}
                              color="red"
                              onClick={() => deleteMutation.mutate(account.id)}
                            >
                              Delete
                            </Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </>
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

            {editingAccount && !editingAccount.isSystemAccount && (
              <Switch
                label="In use"
                description="Switch off an account you no longer post to. Its past entries stay."
                checked={form.values.isActive}
                onChange={(e) => form.setFieldValue('isActive', e.currentTarget.checked)}
              />
            )}
            {editingAccount?.isSystemAccount && (
              <Text size="xs" c="dimmed">
                This is a built-in account. You can rename it, describe it and move it, but its code and type stay, and it cannot be switched off or deleted.
              </Text>
            )}

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
