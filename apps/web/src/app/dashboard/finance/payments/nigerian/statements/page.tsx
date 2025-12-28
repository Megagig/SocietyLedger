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
  Modal,
  Select,
  FileInput,
  LoadingOverlay,
  Pagination,
  Tabs,
  Alert,
  Progress,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconUpload,
  IconFileSpreadsheet,
  IconCheck,
  IconX,
  IconAlertCircle,
} from '@tabler/icons-react';
import Link from 'next/link';
import {
  getStatementImports,
  getStatementEntries,
  importBankStatement,
  getBankAccounts,
  StatementImport,
  StatementEntry,
} from '@/lib/api/nigerian-payments';

export default function StatementsPage() {
  const queryClient = useQueryClient();
  const [importPage, setImportPage] = useState(1);
  const [entryPage, setEntryPage] = useState(1);
  const [matchStatusFilter, setMatchStatusFilter] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedEntries, setParsedEntries] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const { data: importsData, isLoading: importsLoading } = useQuery({
    queryKey: ['statement-imports', importPage],
    queryFn: () => getStatementImports(importPage, 10),
  });

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['statement-entries', entryPage, matchStatusFilter],
    queryFn: () =>
      getStatementEntries({
        page: entryPage,
        limit: 20,
        matchStatus: matchStatusFilter || undefined,
      }),
  });

  const { data: bankAccountsData } = useQuery({
    queryKey: ['bank-accounts-active'],
    queryFn: () => getBankAccounts(true),
  });

  const imports = importsData?.data?.imports || [];
  const importsPagination = importsData?.data?.pagination;
  const entries = entriesData?.data?.entries || [];
  const entriesPagination = entriesData?.data?.pagination;
  const bankAccounts = bankAccountsData?.data?.accounts || [];

  const importMutation = useMutation({
    mutationFn: importBankStatement,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['statement-imports'] });
      queryClient.invalidateQueries({ queryKey: ['statement-entries'] });
      notifications.show({
        title: 'Success',
        message: `Imported ${data.data?.entriesCreated || 0} entries successfully`,
        color: 'green',
      });
      closeUploadModal();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to import statement',
        color: 'red',
      });
    },
  });

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());
        
        if (lines.length < 2) {
          setParseError('CSV file must have at least a header row and one data row');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const entries = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim());
          const entry: any = {};

          // Map common CSV column names
          headers.forEach((header, index) => {
            const value = values[index];
            if (header.includes('date') && !header.includes('value')) {
              entry.transactionDate = value;
            } else if (header.includes('value') && header.includes('date')) {
              entry.valueDate = value;
            } else if (header.includes('ref')) {
              entry.reference = value;
            } else if (header.includes('desc') || header.includes('narration')) {
              entry.description = value;
            } else if (header.includes('debit') || header.includes('withdrawal')) {
              entry.debitAmount = parseFloat(value.replace(/[^0-9.-]/g, '')) || undefined;
            } else if (header.includes('credit') || header.includes('deposit')) {
              entry.creditAmount = parseFloat(value.replace(/[^0-9.-]/g, '')) || undefined;
            } else if (header.includes('balance')) {
              entry.balance = parseFloat(value.replace(/[^0-9.-]/g, '')) || undefined;
            }
          });

          if (entry.transactionDate && entry.description) {
            entries.push(entry);
          }
        }

        if (entries.length === 0) {
          setParseError('No valid entries found in CSV. Ensure columns include: date, description, and credit/debit amounts');
          return;
        }

        setParsedEntries(entries);
        setParseError(null);
      } catch (err) {
        setParseError('Failed to parse CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (file: File | null) => {
    setCsvFile(file);
    setParsedEntries([]);
    setParseError(null);
    if (file) {
      parseCSV(file);
    }
  };

  const handleImport = () => {
    if (!selectedBankAccount || parsedEntries.length === 0) return;

    importMutation.mutate({
      bankAccountId: parseInt(selectedBankAccount),
      filename: csvFile?.name || 'statement.csv',
      entries: parsedEntries,
    });
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    setSelectedBankAccount(null);
    setCsvFile(null);
    setParsedEntries([]);
    setParseError(null);
  };

  const formatCurrency = (amount: string | number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const getMatchStatusColor = (status: string) => {
    switch (status) {
      case 'UNMATCHED':
        return 'yellow';
      case 'AUTO_MATCHED':
        return 'blue';
      case 'MANUAL_MATCHED':
        return 'green';
      case 'REJECTED':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getImportStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'green';
      case 'PROCESSING':
        return 'blue';
      case 'FAILED':
        return 'red';
      default:
        return 'gray';
    }
  };

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
            <Title order={2}>Bank Statements</Title>
            <Text c="dimmed">Import and manage bank statement entries</Text>
          </div>
        </Group>
        <Button leftSection={<IconUpload size={16} />} onClick={() => setUploadModalOpen(true)}>
          Import Statement
        </Button>
      </Group>

      <Tabs defaultValue="entries">
        <Tabs.List>
          <Tabs.Tab value="entries" leftSection={<IconFileSpreadsheet size={16} />}>
            Statement Entries
          </Tabs.Tab>
          <Tabs.Tab value="imports" leftSection={<IconUpload size={16} />}>
            Import History
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="entries" pt="md">
          <Card padding="lg" radius="md" withBorder pos="relative">
            <LoadingOverlay visible={entriesLoading} />
            <Group mb="md">
              <Select
                placeholder="Filter by match status"
                data={[
                  { value: '', label: 'All Statuses' },
                  { value: 'UNMATCHED', label: 'Unmatched' },
                  { value: 'AUTO_MATCHED', label: 'Auto Matched' },
                  { value: 'MANUAL_MATCHED', label: 'Manual Matched' },
                ]}
                value={matchStatusFilter}
                onChange={setMatchStatusFilter}
                clearable
              />
            </Group>
            {entries.length > 0 ? (
              <>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Reference</Table.Th>
                      <Table.Th>Description</Table.Th>
                      <Table.Th>Credit</Table.Th>
                      <Table.Th>Debit</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {entries.map((entry: StatementEntry) => (
                      <Table.Tr key={entry.id}>
                        <Table.Td>
                          <Text size="sm">
                            {new Date(entry.transactionDate).toLocaleDateString()}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" ff="monospace">
                            {entry.reference || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" lineClamp={1} style={{ maxWidth: 200 }}>
                            {entry.description}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="green" fw={entry.creditAmount ? 500 : 400}>
                            {formatCurrency(entry.creditAmount)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="red" fw={entry.debitAmount ? 500 : 400}>
                            {formatCurrency(entry.debitAmount)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getMatchStatusColor(entry.matchStatus)} size="sm">
                            {entry.matchStatus.replace('_', ' ')}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {entriesPagination && entriesPagination.totalPages > 1 && (
                  <Group justify="center" mt="md">
                    <Pagination
                      value={entryPage}
                      onChange={setEntryPage}
                      total={entriesPagination.totalPages}
                    />
                  </Group>
                )}
              </>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                No statement entries found. Import a bank statement to get started.
              </Text>
            )}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="imports" pt="md">
          <Card padding="lg" radius="md" withBorder pos="relative">
            <LoadingOverlay visible={importsLoading} />
            {imports.length > 0 ? (
              <>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Filename</Table.Th>
                      <Table.Th>Bank Account</Table.Th>
                      <Table.Th>Import Date</Table.Th>
                      <Table.Th>Entries</Table.Th>
                      <Table.Th>Matched</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {imports.map((imp: StatementImport) => (
                      <Table.Tr key={imp.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {imp.filename}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {imp.bankAccount?.bankName} - {imp.bankAccount?.accountNumber}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {new Date(imp.importDate).toLocaleDateString()}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{imp.totalEntries}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Progress
                              value={(imp.matchedEntries / imp.totalEntries) * 100}
                              size="sm"
                              style={{ width: 60 }}
                            />
                            <Text size="xs" c="dimmed">
                              {imp.matchedEntries}/{imp.totalEntries}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getImportStatusColor(imp.status)} size="sm">
                            {imp.status}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {importsPagination && importsPagination.totalPages > 1 && (
                  <Group justify="center" mt="md">
                    <Pagination
                      value={importPage}
                      onChange={setImportPage}
                      total={importsPagination.totalPages}
                    />
                  </Group>
                )}
              </>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                No statement imports yet.
              </Text>
            )}
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* Upload Modal */}
      <Modal
        opened={uploadModalOpen}
        onClose={closeUploadModal}
        title="Import Bank Statement"
        size="lg"
      >
        <Stack gap="md">
          <Select
            label="Bank Account"
            placeholder="Select the bank account"
            data={bankAccounts.map((a: any) => ({
              value: String(a.id),
              label: `${a.bankName} - ${a.accountNumber}`,
            }))}
            value={selectedBankAccount}
            onChange={setSelectedBankAccount}
            required
          />

          <FileInput
            label="CSV File"
            placeholder="Select CSV file"
            accept=".csv"
            value={csvFile}
            onChange={handleFileChange}
            leftSection={<IconFileSpreadsheet size={16} />}
            required
          />

          <Alert color="blue" icon={<IconAlertCircle size={16} />}>
            <Text size="sm">
              CSV should have columns: Date, Reference, Description, Credit/Deposit, Debit/Withdrawal, Balance
            </Text>
          </Alert>

          {parseError && (
            <Alert color="red" icon={<IconX size={16} />}>
              {parseError}
            </Alert>
          )}

          {parsedEntries.length > 0 && (
            <Alert color="green" icon={<IconCheck size={16} />}>
              Found {parsedEntries.length} valid entries ready to import
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={closeUploadModal}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              loading={importMutation.isPending}
              disabled={!selectedBankAccount || parsedEntries.length === 0}
            >
              Import {parsedEntries.length} Entries
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
