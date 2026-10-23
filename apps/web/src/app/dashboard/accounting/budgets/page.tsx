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
  Textarea,
  Select,
  NumberInput,
  ActionIcon,
  Menu,
  Progress,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { DateInput } from '@mantine/dates';
import {
  IconPlus,
  IconCalculator,
  IconDotsVertical,
  IconEdit,
  IconCheck,
  IconEye,
  IconChartBar,
  IconTrash,
} from '@tabler/icons-react';
import { accountingApi, Budget, ChartOfAccount } from '@/lib/api/accounting';
import { toast } from '@/lib/toast';
import Link from 'next/link';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [varianceOpened, { open: openVariance, close: closeVariance }] = useDisclosure(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => ({
    value: (currentYear - 2 + i).toString(),
    label: (currentYear - 2 + i).toString(),
  }));

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      fiscalYear: currentYear,
      startDate: new Date(currentYear, 0, 1),
      endDate: new Date(currentYear, 11, 31),
      items: [] as { accountId: string; annualAmount: number; notes: string }[],
    },
    validate: {
      name: (value) => (!value ? 'Budget name is required' : null),
      items: (value) => (value.length === 0 ? 'At least one budget item is required' : null),
    },
  });

  const { data: budgetsData, isLoading, error } = useQuery({
    queryKey: ['budgets', filterStatus, filterYear],
    queryFn: () =>
      accountingApi.getBudgets({
        status: filterStatus || undefined,
        fiscalYear: filterYear ? parseInt(filterYear) : undefined,
        limit: 50,
      }),
    retry: false,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts-expense'],
    queryFn: () => accountingApi.getChartOfAccounts({ type: 'EXPENSE', isActive: true }),
  });

  const { data: varianceData, isLoading: varianceLoading } = useQuery({
    queryKey: ['budget-variance', selectedBudget?.id],
    queryFn: () => selectedBudget ? accountingApi.getBudgetVariance(selectedBudget.id) : null,
    enabled: !!selectedBudget && varianceOpened,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => accountingApi.createBudget(data),
    onSuccess: () => {
      toast.success('Budget created successfully');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      close();
      form.reset();
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to create budget');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => accountingApi.approveBudget(id),
    onSuccess: () => {
      toast.success('Budget approved successfully');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to approve budget');
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => accountingApi.activateBudget(id),
    onSuccess: () => {
      toast.success('Budget activated successfully');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to activate budget');
    },
  });

  useEffect(() => {
    if (error) {
      toast.apiError(error, 'Failed to load budgets');
    }
  }, [error]);

  const budgets: Budget[] = budgetsData?.data?.budgets || [];
  const accounts: ChartOfAccount[] = accountsData?.data || [];

  const accountOptions = accounts.map((a) => ({
    value: a.id.toString(),
    label: `${a.code} - ${a.name}`,
  }));

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'gray',
      PENDING_APPROVAL: 'yellow',
      APPROVED: 'blue',
      ACTIVE: 'green',
      CLOSED: 'dark',
    };
    return colors[status] || 'gray';
  };

  const handleAddItem = () => {
    form.insertListItem('items', { accountId: '', annualAmount: 0, notes: '' });
  };

  const handleRemoveItem = (index: number) => {
    form.removeListItem('items', index);
  };

  const handleSubmit = (values: typeof form.values) => {
    const data = {
      name: values.name,
      description: values.description || undefined,
      fiscalYear: values.fiscalYear,
      startDate: values.startDate.toISOString(),
      endDate: values.endDate.toISOString(),
      items: values.items
        .filter((item) => item.accountId && item.annualAmount > 0)
        .map((item) => ({
          accountId: parseInt(item.accountId),
          annualAmount: item.annualAmount,
          notes: item.notes || undefined,
        })),
    };

    createMutation.mutate(data);
  };

  const handleViewVariance = (budget: Budget) => {
    setSelectedBudget(budget);
    openVariance();
  };

  const totalBudgetAmount = form.values.items.reduce((sum, item) => sum + (item.annualAmount || 0), 0);

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
          Budget Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create budgets and track actual vs budget variance
        </p>
      </div>

      {/* Actions Bar */}
      <Card withBorder padding="md" mb="xl" className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              placeholder="Filter by status"
              data={STATUS_OPTIONS}
              value={filterStatus}
              onChange={(value) => setFilterStatus(value || '')}
              className="w-full sm:w-[180px]"
            />
            <Select
              placeholder="Filter by year"
              data={[{ value: '', label: 'All Years' }, ...yearOptions]}
              value={filterYear}
              onChange={(value) => setFilterYear(value || '')}
              className="w-full sm:w-[150px]"
            />
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={open} className="w-full sm:w-auto">
            New Budget
          </Button>
        </div>
      </Card>

      {/* Budgets Table */}
      {budgets.length === 0 ? (
        <Alert icon={<IconCalculator size={20} />} title="No Budgets Found" color="blue">
          <Text size="sm">
            No budgets found. Click &quot;New Budget&quot; to create your first budget.
          </Text>
        </Alert>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {budgets.map((budget) => (
              <Card key={budget.id} withBorder padding="sm" className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Text fw={600}>{budget.name}</Text>
                    {budget.description && (
                      <Text size="xs" c="dimmed" mt={2}>{budget.description}</Text>
                    )}
                  </div>
                  <Menu position="bottom-end" withArrow>
                    <Menu.Target>
                      <ActionIcon variant="subtle">
                        <IconDotsVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconChartBar size={14} />}
                        onClick={() => handleViewVariance(budget)}
                      >
                        View Variance
                      </Menu.Item>
                      {budget.status === 'DRAFT' && (
                        <Menu.Item
                          leftSection={<IconCheck size={14} />}
                          onClick={() => approveMutation.mutate(budget.id)}
                        >
                          Approve
                        </Menu.Item>
                      )}
                      {budget.status === 'APPROVED' && (
                        <Menu.Item
                          leftSection={<IconCheck size={14} />}
                          color="green"
                          onClick={() => activateMutation.mutate(budget.id)}
                        >
                          Activate
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge color={getStatusColor(budget.status)} variant="light" size="sm">
                    {budget.status}
                  </Badge>
                  <Badge variant="outline" size="sm">{budget.fiscalYear}</Badge>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <Text size="xs" c="dimmed">Period</Text>
                    <Text size="xs">
                      {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                    </Text>
                  </div>
                  <div className="flex justify-between">
                    <Text size="xs" c="dimmed">Total Budget</Text>
                    <Text size="sm" fw={500}>{formatCurrency(budget.totalBudget)}</Text>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <Card withBorder padding={0} className="hidden md:block">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Fiscal Year</Table.Th>
                  <Table.Th>Period</Table.Th>
                  <Table.Th>Total Budget</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={80}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {budgets.map((budget) => (
                  <Table.Tr key={budget.id}>
                    <Table.Td>
                      <Text fw={500}>{budget.name}</Text>
                      {budget.description && (
                        <Text size="xs" c="dimmed">{budget.description}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text>{budget.fiscalYear}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{formatCurrency(budget.totalBudget)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(budget.status)} variant="light">
                        {budget.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon variant="subtle">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconChartBar size={14} />}
                            onClick={() => handleViewVariance(budget)}
                          >
                            View Variance
                          </Menu.Item>
                          {budget.status === 'DRAFT' && (
                            <Menu.Item
                              leftSection={<IconCheck size={14} />}
                              onClick={() => approveMutation.mutate(budget.id)}
                            >
                              Approve
                            </Menu.Item>
                          )}
                          {budget.status === 'APPROVED' && (
                            <Menu.Item
                              leftSection={<IconCheck size={14} />}
                              color="green"
                              onClick={() => activateMutation.mutate(budget.id)}
                            >
                              Activate
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

      {/* Create Budget Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title="Create New Budget"
        size="xl"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Group grow>
              <TextInput
                label="Budget Name"
                placeholder="e.g., Annual Operating Budget 2025"
                required
                {...form.getInputProps('name')}
              />
              <NumberInput
                label="Fiscal Year"
                min={2020}
                max={2100}
                required
                {...form.getInputProps('fiscalYear')}
              />
            </Group>

            <Group grow>
              <DateInput
                label="Start Date"
                required
                {...form.getInputProps('startDate')}
              />
              <DateInput
                label="End Date"
                required
                {...form.getInputProps('endDate')}
              />
            </Group>

            <Textarea
              label="Description"
              placeholder="Optional description"
              {...form.getInputProps('description')}
            />

            <Text fw={600} mt="md">Budget Items</Text>

            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Account</Table.Th>
                  <Table.Th w={180}>Annual Amount</Table.Th>
                  <Table.Th>Notes</Table.Th>
                  <Table.Th w={50}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {form.values.items.map((_, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Select
                        data={accountOptions}
                        placeholder="Select account"
                        searchable
                        {...form.getInputProps(`items.${index}.accountId`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        min={0}
                        decimalScale={2}
                        thousandSeparator=","
                        prefix="₦"
                        {...form.getInputProps(`items.${index}.annualAmount`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        placeholder="Notes"
                        {...form.getInputProps(`items.${index}.notes`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Td>
                    <Button variant="subtle" size="xs" onClick={handleAddItem}>
                      + Add Item
                    </Button>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={700}>{formatCurrency(totalBudgetAmount)}</Text>
                  </Table.Td>
                  <Table.Td colSpan={2}></Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending}
                disabled={form.values.items.length === 0}
              >
                Create Budget
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Variance Modal */}
      <Modal
        opened={varianceOpened}
        onClose={closeVariance}
        title={`Budget Variance: ${selectedBudget?.name}`}
        size="xl"
      >
        {varianceLoading ? (
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        ) : varianceData?.data ? (
          <Stack gap="md">
            {/* Summary */}
            <Card withBorder padding="md">
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">Total Budget</Text>
                  <Text size="lg" fw={700}>{formatCurrency(varianceData.data.summary.totalBudget)}</Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Total Actual</Text>
                  <Text size="lg" fw={700}>{formatCurrency(varianceData.data.summary.totalActual)}</Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Variance</Text>
                  <Text
                    size="lg"
                    fw={700}
                    c={parseFloat(String(varianceData.data.summary.totalVariance)) >= 0 ? 'green' : 'red'}
                  >
                    {formatCurrency(varianceData.data.summary.totalVariance)}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">% Used</Text>
                  <Text size="lg" fw={700}>
                    {(100 - varianceData.data.summary.variancePercentage).toFixed(1)}%
                  </Text>
                </div>
              </Group>
              <Progress
                value={100 - varianceData.data.summary.variancePercentage}
                size="lg"
                mt="md"
                color={
                  varianceData.data.summary.variancePercentage < 0
                    ? 'red'
                    : varianceData.data.summary.variancePercentage < 10
                    ? 'yellow'
                    : 'green'
                }
              />
            </Card>

            {/* Items Table */}
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Account</Table.Th>
                  <Table.Th>Budget</Table.Th>
                  <Table.Th>Actual</Table.Th>
                  <Table.Th>Variance</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {varianceData.data.items.map((item: any) => (
                  <Table.Tr key={item.accountId}>
                    <Table.Td>
                      <Text size="sm">{item.accountCode} - {item.accountName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatCurrency(item.budgetAmount)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatCurrency(item.actualAmount)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        c={parseFloat(String(item.variance)) >= 0 ? 'green' : 'red'}
                      >
                        {formatCurrency(item.variance)} ({item.variancePercentage.toFixed(1)}%)
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          item.status === 'under'
                            ? 'green'
                            : item.status === 'over'
                            ? 'red'
                            : 'yellow'
                        }
                        variant="light"
                      >
                        {item.status === 'under' ? 'Under Budget' : item.status === 'over' ? 'Over Budget' : 'On Track'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        ) : (
          <Text c="dimmed">No variance data available</Text>
        )}
      </Modal>
    </div>
  );
}
