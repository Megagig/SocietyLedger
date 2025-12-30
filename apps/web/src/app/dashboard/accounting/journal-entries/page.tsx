'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
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
  ActionIcon,
  Menu,
  NumberInput,
  Paper,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { DateInput } from '@mantine/dates';
import {
  IconPlus,
  IconFileAnalytics,
  IconDotsVertical,
  IconEdit,
  IconCheck,
  IconX,
  IconSend,
  IconEye,
  IconTrash,
} from '@tabler/icons-react';
import { accountingApi, ChartOfAccount, JournalEntry, JournalEntryLine } from '@/lib/api/accounting';
import { toast } from '@/lib/toast';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'POSTED', label: 'Posted' },
];

export default function JournalEntriesPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || '';
  
  const [opened, { open, close }] = useDisclosure(false);
  const [viewOpened, { open: openView, close: closeView }] = useDisclosure(false);
  const [approvalOpened, { open: openApproval, close: closeApproval }] = useDisclosure(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);
  const [search, setSearch] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);

  const form = useForm({
    initialValues: {
      entryDate: new Date(),
      description: '',
      reference: '',
      lines: [
        { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
        { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
      ] as { accountId: string; debitAmount: number; creditAmount: number; description: string }[],
    },
    validate: {
      description: (value) => (!value ? 'Description is required' : null),
      lines: {
        accountId: (value) => (!value ? 'Account is required' : null),
      },
    },
  });

  const { data: entriesData, isLoading, error } = useQuery({
    queryKey: ['journal-entries', filterStatus, search],
    queryFn: () =>
      accountingApi.getJournalEntries({
        status: filterStatus || undefined,
        search: search || undefined,
        limit: 50,
      }),
    retry: false,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts-active'],
    queryFn: () => accountingApi.getChartOfAccounts({ isActive: true }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => accountingApi.createJournalEntry(data),
    onSuccess: () => {
      toast.success('Journal entry created successfully');
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      close();
      form.reset();
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to create journal entry');
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => accountingApi.submitForApproval(id),
    onSuccess: () => {
      toast.success('Entry submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to submit entry');
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: number; action: 'approve' | 'reject'; reason?: string }) =>
      accountingApi.processApproval(id, action, reason),
    onSuccess: (_, variables) => {
      toast.success(`Entry ${variables.action}d successfully`);
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      closeApproval();
      setRejectionReason('');
      setApprovalAction(null);
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to process approval');
    },
  });

  const postMutation = useMutation({
    mutationFn: (id: number) => accountingApi.postJournalEntry(id),
    onSuccess: () => {
      toast.success('Entry posted successfully');
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Failed to post entry');
    },
  });

  useEffect(() => {
    if (error) {
      toast.apiError(error, 'Failed to load journal entries');
    }
  }, [error]);

  const entries: JournalEntry[] = entriesData?.data?.entries || [];
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
      minimumFractionDigits: 2,
    }).format(num || 0);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'gray',
      PENDING_APPROVAL: 'yellow',
      APPROVED: 'blue',
      REJECTED: 'red',
      POSTED: 'green',
      VOIDED: 'dark',
    };
    return colors[status] || 'gray';
  };

  const handleAddLine = () => {
    form.insertListItem('lines', { accountId: '', debitAmount: 0, creditAmount: 0, description: '' });
  };

  const handleRemoveLine = (index: number) => {
    if (form.values.lines.length > 2) {
      form.removeListItem('lines', index);
    }
  };

  const handleSubmit = (values: typeof form.values) => {
    const totalDebit = values.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredit = values.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast.error('Total debits must equal total credits');
      return;
    }

    const data = {
      entryDate: values.entryDate.toISOString(),
      description: values.description,
      reference: values.reference || undefined,
      lines: values.lines
        .filter((line) => line.accountId && (line.debitAmount > 0 || line.creditAmount > 0))
        .map((line) => ({
          accountId: parseInt(line.accountId),
          debitAmount: line.debitAmount || 0,
          creditAmount: line.creditAmount || 0,
          description: line.description || undefined,
        })),
    };

    createMutation.mutate(data);
  };

  const handleView = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    openView();
  };

  const handleApprovalAction = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    openApproval();
  };

  const totalDebit = form.values.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
  const totalCredit = form.values.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

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
          Journal Entries
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Record and manage accounting journal entries
        </p>
      </div>

      {/* Actions Bar */}
      <Card withBorder padding="md" mb="xl">
        <Group justify="space-between">
          <Group>
            <Select
              placeholder="Filter by status"
              data={STATUS_OPTIONS}
              value={filterStatus}
              onChange={(value) => setFilterStatus(value || '')}
              w={200}
            />
            <TextInput
              placeholder="Search entries..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={250}
            />
          </Group>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New Entry
          </Button>
        </Group>
      </Card>

      {/* Entries Table */}
      {entries.length === 0 ? (
        <Alert icon={<IconFileAnalytics size={20} />} title="No Entries Found" color="blue">
          <Text size="sm">
            No journal entries found. Click "New Entry" to create your first journal entry.
          </Text>
        </Alert>
      ) : (
        <Card withBorder padding={0}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Entry #</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Debit</Table.Th>
                <Table.Th>Credit</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th w={80}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entries.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>
                    <Text fw={500}>{entry.entryNumber}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(entry.entryDate).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text lineClamp={1}>{entry.description}</Text>
                    {entry.reference && (
                      <Text size="xs" c="dimmed">Ref: {entry.reference}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>{formatCurrency(entry.totalDebit)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>{formatCurrency(entry.totalCredit)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(entry.status)} variant="light">
                      {entry.status.replace(/_/g, ' ')}
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
                          leftSection={<IconEye size={14} />}
                          onClick={() => handleView(entry)}
                        >
                          View Details
                        </Menu.Item>
                        {entry.status === 'DRAFT' && (
                          <>
                            <Menu.Item
                              leftSection={<IconSend size={14} />}
                              onClick={() => submitMutation.mutate(entry.id)}
                            >
                              Submit for Approval
                            </Menu.Item>
                          </>
                        )}
                        {entry.status === 'PENDING_APPROVAL' && (
                          <Menu.Item
                            leftSection={<IconCheck size={14} />}
                            onClick={() => handleApprovalAction(entry)}
                          >
                            Review
                          </Menu.Item>
                        )}
                        {entry.status === 'APPROVED' && (
                          <Menu.Item
                            leftSection={<IconCheck size={14} />}
                            color="green"
                            onClick={() => postMutation.mutate(entry.id)}
                          >
                            Post Entry
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
      )}

      {/* Create Entry Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title="New Journal Entry"
        size="xl"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Group grow>
              <DateInput
                label="Entry Date"
                required
                {...form.getInputProps('entryDate')}
              />
              <TextInput
                label="Reference"
                placeholder="Optional reference number"
                {...form.getInputProps('reference')}
              />
            </Group>

            <Textarea
              label="Description"
              placeholder="Describe this journal entry"
              required
              {...form.getInputProps('description')}
            />

            <Divider label="Entry Lines" labelPosition="center" />

            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Account</Table.Th>
                  <Table.Th w={150}>Debit</Table.Th>
                  <Table.Th w={150}>Credit</Table.Th>
                  <Table.Th>Memo</Table.Th>
                  <Table.Th w={50}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {form.values.lines.map((_, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Select
                        data={accountOptions}
                        placeholder="Select account"
                        searchable
                        {...form.getInputProps(`lines.${index}.accountId`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        min={0}
                        decimalScale={2}
                        thousandSeparator=","
                        {...form.getInputProps(`lines.${index}.debitAmount`)}
                        onChange={(value) => {
                          form.setFieldValue(`lines.${index}.debitAmount`, value || 0);
                          if (value && Number(value) > 0) {
                            form.setFieldValue(`lines.${index}.creditAmount`, 0);
                          }
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        min={0}
                        decimalScale={2}
                        thousandSeparator=","
                        {...form.getInputProps(`lines.${index}.creditAmount`)}
                        onChange={(value) => {
                          form.setFieldValue(`lines.${index}.creditAmount`, value || 0);
                          if (value && Number(value) > 0) {
                            form.setFieldValue(`lines.${index}.debitAmount`, 0);
                          }
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        placeholder="Line memo"
                        {...form.getInputProps(`lines.${index}.description`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemoveLine(index)}
                        disabled={form.values.lines.length <= 2}
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
                    <Button variant="subtle" size="xs" onClick={handleAddLine}>
                      + Add Line
                    </Button>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={700}>{formatCurrency(totalDebit)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={700}>{formatCurrency(totalCredit)}</Text>
                  </Table.Td>
                  <Table.Td colSpan={2}>
                    <Badge color={isBalanced ? 'green' : 'red'}>
                      {isBalanced ? 'Balanced' : 'Not Balanced'}
                    </Badge>
                  </Table.Td>
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
                disabled={!isBalanced}
              >
                Create Entry
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* View Entry Modal */}
      <Modal
        opened={viewOpened}
        onClose={closeView}
        title={`Journal Entry: ${selectedEntry?.entryNumber}`}
        size="lg"
      >
        {selectedEntry && (
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed">Date</Text>
                <Text>{new Date(selectedEntry.entryDate).toLocaleDateString()}</Text>
              </div>
              <Badge color={getStatusColor(selectedEntry.status)} size="lg">
                {selectedEntry.status.replace(/_/g, ' ')}
              </Badge>
            </Group>

            <div>
              <Text size="sm" c="dimmed">Description</Text>
              <Text>{selectedEntry.description}</Text>
            </div>

            {selectedEntry.reference && (
              <div>
                <Text size="sm" c="dimmed">Reference</Text>
                <Text>{selectedEntry.reference}</Text>
              </div>
            )}

            <Divider />

            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Account</Table.Th>
                  <Table.Th>Debit</Table.Th>
                  <Table.Th>Credit</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedEntry.lines.map((line) => (
                  <Table.Tr key={line.id}>
                    <Table.Td>
                      <Text>{line.accountCode} - {line.accountName}</Text>
                      {line.description && (
                        <Text size="xs" c="dimmed">{line.description}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {parseFloat(String(line.debitAmount)) > 0 && formatCurrency(line.debitAmount)}
                    </Table.Td>
                    <Table.Td>
                      {parseFloat(String(line.creditAmount)) > 0 && formatCurrency(line.creditAmount)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Td><Text fw={700}>Total</Text></Table.Td>
                  <Table.Td><Text fw={700}>{formatCurrency(selectedEntry.totalDebit)}</Text></Table.Td>
                  <Table.Td><Text fw={700}>{formatCurrency(selectedEntry.totalCredit)}</Text></Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </Stack>
        )}
      </Modal>

      {/* Approval Modal */}
      <Modal
        opened={approvalOpened}
        onClose={closeApproval}
        title="Review Journal Entry"
        size="md"
      >
        {selectedEntry && (
          <Stack gap="md">
            <Paper withBorder p="md">
              <Text fw={500}>{selectedEntry.entryNumber}</Text>
              <Text size="sm" c="dimmed">{selectedEntry.description}</Text>
              <Text size="sm" mt="xs">Amount: {formatCurrency(selectedEntry.totalDebit)}</Text>
            </Paper>

            <Textarea
              label="Rejection Reason (required if rejecting)"
              placeholder="Enter reason for rejection"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.currentTarget.value)}
            />

            <Group justify="flex-end">
              <Button
                variant="light"
                color="red"
                leftSection={<IconX size={16} />}
                onClick={() => {
                  if (!rejectionReason) {
                    toast.error('Please provide a rejection reason');
                    return;
                  }
                  setApprovalAction('reject');
                  approveMutation.mutate({
                    id: selectedEntry.id,
                    action: 'reject',
                    reason: rejectionReason,
                  });
                }}
                loading={approveMutation.isPending && approvalAction === 'reject'}
                disabled={approveMutation.isPending && approvalAction === 'approve'}
              >
                Reject
              </Button>
              <Button
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={() => {
                  setApprovalAction('approve');
                  approveMutation.mutate({
                    id: selectedEntry.id,
                    action: 'approve',
                  });
                }}
                loading={approveMutation.isPending && approvalAction === 'approve'}
                disabled={approveMutation.isPending && approvalAction === 'reject'}
              >
                Approve
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}
