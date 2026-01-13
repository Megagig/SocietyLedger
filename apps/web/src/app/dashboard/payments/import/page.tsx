'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Select,
  FileInput,
  LoadingOverlay,
  Alert,
  Table,
  Badge,
  Paper,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import {
  Upload,
  Download,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  nigerianPaymentsApi,
  type BankAccount,
} from '@/lib/api/nigerian-payments';
import { notifications } from '@mantine/notifications';
import { useEffect } from 'react';

interface StatementEntry {
  transactionDate: string;
  description: string;
  debitAmount?: number;
  creditAmount?: number;
  balance?: number;
  reference?: string;
}

export default function StatementImportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StatementEntry[]>([]);
  const [importing, setImporting] = useState(false);

  const form = useForm({
    initialValues: {
      bankAccountId: '',
      startDate: null as Date | null,
      endDate: null as Date | null,
    },
    validate: {
      bankAccountId: (value) => (!value ? 'Please select a bank account' : null),
    },
  });

  useEffect(() => {
    loadBankAccounts();
  }, []);

  const loadBankAccounts = async () => {
    try {
      const response = await nigerianPaymentsApi.getBankAccounts();
      setBankAccounts(response || []);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) {
      setCsvFile(null);
      setPreview([]);
      return;
    }

    setCsvFile(file);

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].toLowerCase().split(',');

      const entries: StatementEntry[] = [];

      for (let i = 1; i < Math.min(lines.length, 11); i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',');
        const entry: any = {};

        headers.forEach((header, index) => {
          const value = values[index]?.trim() || '';
          
          if (header.includes('date')) {
            entry.transactionDate = value;
          } else if (header.includes('description') || header.includes('narration')) {
            entry.description = value;
          } else if (header.includes('debit')) {
            entry.debitAmount = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
          } else if (header.includes('credit')) {
            entry.creditAmount = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
          } else if (header.includes('balance')) {
            entry.balance = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
          } else if (header.includes('reference') || header.includes('ref')) {
            entry.reference = value;
          }
        });

        if (entry.transactionDate && entry.description) {
          entries.push(entry);
        }
      }

      setPreview(entries);

      if (entries.length > 0) {
        notifications.show({
          title: 'File Loaded',
          message: `Preview showing first ${entries.length} entries`,
          color: 'blue',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to parse CSV file. Please check the format.',
        color: 'red',
      });
      setCsvFile(null);
      setPreview([]);
    }
  };

  const handleImport = async (values: typeof form.values) => {
    if (!csvFile) {
      notifications.show({
        title: 'Error',
        message: 'Please select a CSV file',
        color: 'red',
      });
      return;
    }

    try {
      setImporting(true);

      const text = await csvFile.text();
      const lines = text.split('\n');
      const headers = lines[0].toLowerCase().split(',');

      const entries: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',');
        const entry: any = {};

        headers.forEach((header, index) => {
          const value = values[index]?.trim() || '';
          
          if (header.includes('date')) {
            entry.transactionDate = value;
          } else if (header.includes('description') || header.includes('narration')) {
            entry.description = value;
          } else if (header.includes('debit')) {
            const amount = parseFloat(value.replace(/[^0-9.-]/g, ''));
            if (amount > 0) entry.debitAmount = amount;
          } else if (header.includes('credit')) {
            const amount = parseFloat(value.replace(/[^0-9.-]/g, ''));
            if (amount > 0) entry.creditAmount = amount;
          } else if (header.includes('balance')) {
            const amount = parseFloat(value.replace(/[^0-9.-]/g, ''));
            if (amount) entry.balance = amount;
          } else if (header.includes('reference') || header.includes('ref')) {
            entry.reference = value;
          }
        });

        if (entry.transactionDate && entry.description) {
          entries.push(entry);
        }
      }

      await nigerianPaymentsApi.importStatement(csvFile);

      notifications.show({
        title: 'Success',
        message: `Imported ${entries.length} statement entries successfully`,
        color: 'green',
      });

      router.push('/dashboard/payments/reconciliation');
    } catch (error: any) {
      console.error('Error importing statement:', error);
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to import statement',
        color: 'red',
      });
    } finally {
      setImporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const bankAccountOptions = bankAccounts.map((account) => ({
    value: account.id.toString(),
    label: `${account.bankName} - ${account.accountNumber}`,
  }));

  return (
    <Can permission={PERMISSIONS.PAYMENT_RECORD}>
      <Stack gap="lg">
        <Group>
          <Button
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => router.back()}
          >
            Back
          </Button>
        </Group>

        <Card withBorder padding="lg" style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
          <LoadingOverlay visible={loading} />

          <Stack gap="lg">
            <div>
              <Title order={2}>Import Bank Statement</Title>
              <Text size="sm" c="dimmed">
                Import bank statement entries for reconciliation
              </Text>
            </div>

            <Alert icon={<AlertCircle size={16} />} color="blue" title="CSV Format Requirements">
              <Text size="sm">
                Your CSV file should include columns for: Date, Description, Debit, Credit, Balance, and Reference (optional)
              </Text>
            </Alert>

            <Paper withBorder p="md" bg="gray.0">
              <Group justify="space-between">
                <Text size="sm" fw={500}>Download Sample CSV Template</Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<Download size={14} />}
                  onClick={() => {
                    const csv = 'Date,Description,Debit,Credit,Balance,Reference\n2024-01-15,Payment from John Doe,0,50000,100000,TXN001\n2024-01-16,ATM Withdrawal,10000,0,90000,ATM123';
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'bank-statement-template.csv';
                    a.click();
                  }}
                >
                  Download Template
                </Button>
              </Group>
            </Paper>

            <form onSubmit={form.onSubmit(handleImport)}>
              <Stack gap="md">
                <Select
                  label="Bank Account"
                  placeholder="Select bank account"
                  data={bankAccountOptions}
                  required
                  {...form.getInputProps('bankAccountId')}
                />

                <Group grow>
                  <DatePickerInput
                    label="Statement Start Date (Optional)"
                    placeholder="Select start date"
                    {...form.getInputProps('startDate')}
                  />
                  <DatePickerInput
                    label="Statement End Date (Optional)"
                    placeholder="Select end date"
                    {...form.getInputProps('endDate')}
                  />
                </Group>

                <FileInput
                  label="CSV File"
                  placeholder="Upload bank statement CSV"
                  accept=".csv"
                  leftSection={<Upload size={16} />}
                  value={csvFile}
                  onChange={handleFileUpload}
                  required
                />

                {preview.length > 0 && (
                  <div>
                    <Group justify="space-between" mb="sm">
                      <Text size="sm" fw={500}>Preview (First 10 entries)</Text>
                      <Badge color="blue" size="lg">
                        {preview.length} entries
                      </Badge>
                    </Group>
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Date</Table.Th>
                          <Table.Th>Description</Table.Th>
                          <Table.Th>Debit</Table.Th>
                          <Table.Th>Credit</Table.Th>
                          <Table.Th>Balance</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {preview.map((entry, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>{entry.transactionDate}</Table.Td>
                            <Table.Td>{entry.description}</Table.Td>
                            <Table.Td>
                              {entry.debitAmount ? formatCurrency(entry.debitAmount) : '-'}
                            </Table.Td>
                            <Table.Td>
                              {entry.creditAmount ? formatCurrency(entry.creditAmount) : '-'}
                            </Table.Td>
                            <Table.Td>
                              {entry.balance ? formatCurrency(entry.balance) : '-'}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </div>
                )}

                <Group justify="flex-end" mt="md">
                  <Button
                    variant="light"
                    onClick={() => router.back()}
                    disabled={importing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={importing}
                    leftSection={<CheckCircle size={16} />}
                    disabled={!csvFile || preview.length === 0}
                  >
                    Import Statement
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Card>
      </Stack>
    </Can>
  );
}
