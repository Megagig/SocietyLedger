'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Text,
  Badge,
  Loader,
  Alert,
  Button,
  Table,
  Modal,
  TextInput,
  Select,
  ActionIcon,
  Menu,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { DateInput } from '@mantine/dates';
import { IconPlus, IconCalendarStats, IconDotsVertical, IconLock, IconLockOpen, IconLockSquare } from '@tabler/icons-react';
import { accountingApi, AccountingPeriod } from '@/lib/api/accounting';
import { toast } from '@/lib/toast';

const PERIOD_TYPE_OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

export default function AccountingPeriodsPage() {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const form = useForm({
    initialValues: {
      name: '',
      periodType: 'month' as 'month' | 'quarter' | 'year',
      startDate: null as Date | null,
      endDate: null as Date | null,
    },
    validate: {
      name: (value) => (!value ? 'Period name is required' : null),
      startDate: (value) => (!value ? 'Start date is required' : null),
      endDate: (value, values) =>
        !value ? 'End date is required' : values.startDate && value <= values.startDate ? 'End date must be after start date' : null,
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting-periods'],
    queryFn: () => accountingApi.getPeriods(),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      accountingApi.createPeriod({
        name: values.name,
        periodType: values.periodType,
        startDate: values.startDate!.toISOString(),
        endDate: values.endDate!.toISOString(),
      }),
    onSuccess: () => {
      toast.success('Accounting period created');
      queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
      close();
      form.reset();
    },
    onError: (err: any) => toast.apiError(err, 'Failed to create accounting period'),
  });

  const closeMutation = useMutation({
    mutationFn: (id: number) => accountingApi.closePeriod(id),
    onSuccess: () => {
      toast.success('Period closed');
      queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
    },
    onError: (err: any) => toast.apiError(err, 'Failed to close period'),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: number) => accountingApi.reopenPeriod(id),
    onSuccess: () => {
      toast.success('Period reopened');
      queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
    },
    onError: (err: any) => toast.apiError(err, 'Failed to reopen period'),
  });

  const lockMutation = useMutation({
    mutationFn: (id: number) => accountingApi.lockPeriod(id),
    onSuccess: () => {
      toast.success('Period locked — this cannot be undone');
      queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
    },
    onError: (err: any) => toast.apiError(err, 'Failed to lock period'),
  });

  useEffect(() => {
    if (error) toast.apiError(error, 'Failed to load accounting periods');
  }, [error]);

  const periods: AccountingPeriod[] = data?.data || [];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = { OPEN: 'green', CLOSED: 'orange', LOCKED: 'dark' };
    return colors[status] || 'gray';
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString();

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
          Accounting Periods
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Open, close and lock periods to control which dates new journal entries can be posted into
        </p>
      </div>

      <Card withBorder padding="md" mb="xl" className="p-3 sm:p-4">
        <div className="flex justify-end">
          <Button leftSection={<IconPlus size={16} />} onClick={open} className="w-full sm:w-auto">
            New Period
          </Button>
        </div>
      </Card>

      {periods.length === 0 ? (
        <Alert icon={<IconCalendarStats size={20} />} title="No Accounting Periods" color="blue">
          <Text size="sm">
            No accounting periods have been created yet. Entries can be posted to any date until a period is defined.
            Click &quot;New Period&quot; to start controlling which dates are open for posting.
          </Text>
        </Alert>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {periods.map((period) => (
              <Card key={period.id} withBorder padding="sm" className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Text fw={600}>{period.name}</Text>
                    <Text size="xs" c="dimmed">{formatDate(period.startDate)} - {formatDate(period.endDate)}</Text>
                  </div>
                  <PeriodActionsMenu
                    period={period}
                    onClose={() => closeMutation.mutate(period.id)}
                    onReopen={() => reopenMutation.mutate(period.id)}
                    onLock={() => lockMutation.mutate(period.id)}
                  />
                </div>
                <Badge color={getStatusColor(period.status)} variant="light" size="sm">
                  {period.status}
                </Badge>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <Card withBorder padding={0} className="hidden md:block">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Period</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={80}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {periods.map((period) => (
                  <Table.Tr key={period.id}>
                    <Table.Td><Text fw={500}>{period.name}</Text></Table.Td>
                    <Table.Td><Text size="sm" className="capitalize">{period.periodType}</Text></Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatDate(period.startDate)} - {formatDate(period.endDate)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(period.status)} variant="light" size="sm">
                        {period.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <PeriodActionsMenu
                        period={period}
                        onClose={() => closeMutation.mutate(period.id)}
                        onReopen={() => reopenMutation.mutate(period.id)}
                        onLock={() => lockMutation.mutate(period.id)}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </>
      )}

      <Modal opened={opened} onClose={close} title="New Accounting Period" size="md">
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <div className="space-y-4">
            <TextInput
              label="Period Name"
              placeholder="e.g. January 2026"
              required
              {...form.getInputProps('name')}
            />
            <Select
              label="Period Type"
              data={PERIOD_TYPE_OPTIONS}
              required
              {...form.getInputProps('periodType')}
            />
            <DateInput label="Start Date" required {...form.getInputProps('startDate')} />
            <DateInput label="End Date" required {...form.getInputProps('endDate')} />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="default" onClick={close}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create Period</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PeriodActionsMenu({
  period,
  onClose,
  onReopen,
  onLock,
}: {
  period: AccountingPeriod;
  onClose: () => void;
  onReopen: () => void;
  onLock: () => void;
}) {
  if (period.status === 'LOCKED') {
    return null;
  }

  return (
    <Menu position="bottom-end" withArrow>
      <Menu.Target>
        <ActionIcon variant="subtle">
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {period.status === 'OPEN' && (
          <Menu.Item leftSection={<IconLock size={14} />} onClick={onClose}>
            Close Period
          </Menu.Item>
        )}
        {period.status === 'CLOSED' && (
          <>
            <Menu.Item leftSection={<IconLockOpen size={14} />} onClick={onReopen}>
              Reopen Period
            </Menu.Item>
            <Menu.Item leftSection={<IconLockSquare size={14} />} color="red" onClick={onLock}>
              Lock Permanently
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
