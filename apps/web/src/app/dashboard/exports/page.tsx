'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Stack,
  Group,
  Button,
  Select,
  Alert,
  LoadingOverlay,
  Badge,
  Divider,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Users,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { exportsApi, type ExportResult } from '@/lib/api/exports';

export default function ExportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState<string>('financial');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [period, setPeriod] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [memberStatus, setMemberStatus] = useState<string>('all');
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);

  const handleExport = async () => {
    try {
      setLoading(true);
      let result: ExportResult;

      if (exportType === 'financial') {
        const params = {
          period: period || undefined,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          includeComparison: true,
        };

        if (format === 'pdf') {
          const res = await exportsApi.exportFinancialPDF(params);
          result = res.data;
        } else {
          const res = await exportsApi.exportFinancialExcel(params);
          result = res.data;
        }
      } else if (exportType === 'members') {
        const res = await exportsApi.exportAllMembersExcel({
          status: memberStatus as any,
        });
        result = res.data;
      } else {
        throw new Error('Invalid export type');
      }

      setLastExport(result);

      notifications.show({
        title: 'Export Generated',
        message: 'Your export is ready for download',
        color: 'green',
      });

      // Auto-download
      exportsApi.downloadExport(result.id);
    } catch (err: any) {
      console.error('Error generating export:', err);
      notifications.show({
        title: 'Export Failed',
        message: err.message || 'Failed to generate export',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Can
      permission={PERMISSIONS.EXPORT_FINANCIAL}
      fallback={<Alert color="red">You don't have permission to generate exports</Alert>}
    >
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Export Data</Title>
            <Text size="sm" c="dimmed">
              Generate and download financial and member reports
            </Text>
          </div>
          <Button
            variant="light"
            onClick={() => router.push('/dashboard/exports/history')}
          >
            Export History
          </Button>
        </Group>

        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />

          <Stack gap="md">
            <Title order={4}>Export Settings</Title>

            {/* Export Type */}
            <Select
              label="Export Type"
              placeholder="Select export type"
              value={exportType}
              onChange={(value) => setExportType(value || 'financial')}
              data={[
                {
                  value: 'financial',
                  label: 'Financial Summary',
                },
                {
                  value: 'members',
                  label: 'All Members',
                },
              ]}
              required
            />

            {/* Format Selection */}
            {exportType === 'financial' && (
              <Select
                label="Format"
                placeholder="Select format"
                value={format}
                onChange={(value) => setFormat(value as 'pdf' | 'excel')}
                data={[
                  { value: 'pdf', label: 'PDF Document' },
                  { value: 'excel', label: 'Excel Spreadsheet' },
                ]}
                required
              />
            )}

            <Divider />

            {/* Financial Export Options */}
            {exportType === 'financial' && (
              <Stack gap="sm">
                <Title order={5}>Financial Report Options</Title>

                <Select
                  label="Period"
                  placeholder="Select period or custom range"
                  value={period}
                  onChange={(value) => setPeriod(value || '')}
                  data={[
                    { value: 'this_month', label: 'This Month' },
                    { value: 'last_month', label: 'Last Month' },
                    { value: 'this_quarter', label: 'This Quarter' },
                    { value: 'last_quarter', label: 'Last Quarter' },
                    { value: 'this_year', label: 'This Year' },
                    { value: 'last_year', label: 'Last Year' },
                    { value: 'custom', label: 'Custom Range' },
                  ]}
                  clearable
                />

                {(period === 'custom' || !period) && (
                  <Group grow>
                    <DatePickerInput
                      label="Start Date"
                      placeholder="Select start date"
                      value={startDate}
                      onChange={setStartDate}
                      clearable
                    />
                    <DatePickerInput
                      label="End Date"
                      placeholder="Select end date"
                      value={endDate}
                      onChange={setEndDate}
                      clearable
                    />
                  </Group>
                )}

                <Alert icon={<AlertCircle size={16} />} color="blue">
                  <Text size="sm">
                    Financial summary includes income, expenses, member dues, levies, and
                    overall financial health metrics.
                  </Text>
                </Alert>
              </Stack>
            )}

            {/* Members Export Options */}
            {exportType === 'members' && (
              <Stack gap="sm">
                <Title order={5}>Members Export Options</Title>

                <Select
                  label="Member Status"
                  placeholder="Select member status filter"
                  value={memberStatus}
                  onChange={(value) => setMemberStatus(value || 'all')}
                  data={[
                    { value: 'all', label: 'All Members' },
                    { value: 'with_balance', label: 'Members with Outstanding Balance' },
                    { value: 'overdue', label: 'Members with Overdue Payments' },
                  ]}
                  required
                />

                <Alert icon={<AlertCircle size={16} />} color="blue">
                  <Text size="sm">
                    Members export includes contact details, financial balances, dues status,
                    and payment history.
                  </Text>
                </Alert>
              </Stack>
            )}

            <Divider />

            {/* Export Button */}
            <Group justify="flex-end">
              <Button
                leftSection={
                  exportType === 'financial' && format === 'pdf' ? (
                    <FileText size={16} />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )
                }
                onClick={handleExport}
                loading={loading}
                size="md"
              >
                Generate Export
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* Last Export Info */}
        {lastExport && (
          <Card withBorder padding="lg">
            <Group justify="space-between">
              <div>
                <Text size="sm" fw={500}>
                  Last Export
                </Text>
                <Text size="xs" c="dimmed">
                  {lastExport.filename}
                </Text>
                <Badge size="sm" mt={4}>
                  {formatFileSize(lastExport.fileSize)}
                </Badge>
              </div>
              <Button
                leftSection={<Download size={16} />}
                onClick={() => exportsApi.downloadExport(lastExport.id)}
                variant="light"
              >
                Download Again
              </Button>
            </Group>
          </Card>
        )}

        {/* Quick Export Cards */}
        <Group grow>
          <Card withBorder padding="lg">
            <Stack gap="xs">
              <Group>
                <DollarSign size={24} color="green" />
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={500}>
                    Financial Summary
                  </Text>
                  <Text size="xs" c="dimmed">
                    Income, expenses, and balance
                  </Text>
                </div>
              </Group>
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  setExportType('financial');
                  setFormat('pdf');
                  setPeriod('this_month');
                  handleExport();
                }}
              >
                Export This Month
              </Button>
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Stack gap="xs">
              <Group>
                <Users size={24} color="blue" />
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={500}>
                    All Members
                  </Text>
                  <Text size="xs" c="dimmed">
                    Complete member list with balances
                  </Text>
                </div>
              </Group>
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  setExportType('members');
                  setMemberStatus('all');
                  handleExport();
                }}
              >
                Export All Members
              </Button>
            </Stack>
          </Card>
        </Group>
      </Stack>
    </Can>
  );
}
