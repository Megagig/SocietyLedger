'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Title,
  Text,
  Stack,
  Table,
  Badge,
  Button,
  Group,
  TextInput,
  Select,
  LoadingOverlay,
  Alert,
  ActionIcon,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Search, Download, FileText, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { exportsApi, type ExportHistoryItem } from '@/lib/api/exports';

export default function ExportHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [exports, setExports] = useState<ExportHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [format, setFormat] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [debounced] = useDebouncedValue(search, 500);

  useEffect(() => {
    loadHistory();
  }, [page, debounced, type, format]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await exportsApi.getExportHistory({
        page,
        limit: 20,
        type: type || undefined,
        format: format as any || undefined,
      });
      setExports(res.data.exports);
      setTotal(res.data.total);
    } catch (err: any) {
      console.error('Error loading export history:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to load export history',
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

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const getFormatIcon = (format: string) => {
    return format === 'pdf' ? <FileText size={16} /> : <FileSpreadsheet size={16} />;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      financial_summary: 'Financial Summary',
      member_statement: 'Member Statement',
      members_list: 'All Members',
      transactions: 'Transactions',
    };
    return labels[type] || type;
  };

  return (
    <Can
      permission="REPORT_VIEW"
      fallback={<Alert color="red">You don't have permission to view export history</Alert>}
    >
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Export History</Title>
            <Text size="sm" c="dimmed">
              View and download previously generated exports
            </Text>
          </div>
          <Button variant="light" onClick={() => window.history.back()}>
            Back
          </Button>
        </Group>

        {/* Filters */}
        <Card withBorder padding="md">
          <Stack gap="md">
            <Group>
              <TextInput
                placeholder="Search exports..."
                leftSection={<Search size={16} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <Select
                placeholder="Type"
                value={type}
                onChange={(value) => setType(value || '')}
                data={[
                  { value: '', label: 'All Types' },
                  { value: 'financial_summary', label: 'Financial Summary' },
                  { value: 'member_statement', label: 'Member Statement' },
                  { value: 'members_list', label: 'All Members' },
                ]}
                style={{ width: 200 }}
                clearable
              />
              <Select
                placeholder="Format"
                value={format}
                onChange={(value) => setFormat(value || '')}
                data={[
                  { value: '', label: 'All Formats' },
                  { value: 'pdf', label: 'PDF' },
                  { value: 'excel', label: 'Excel' },
                ]}
                style={{ width: 150 }}
                clearable
              />
            </Group>

            <Group>
              <DatePickerInput
                placeholder="Start date"
                value={startDate}
                onChange={setStartDate}
                clearable
                style={{ flex: 1 }}
              />
              <DatePickerInput
                placeholder="End date"
                value={endDate}
                onChange={setEndDate}
                clearable
                style={{ flex: 1 }}
              />
            </Group>
          </Stack>
        </Card>

        {/* Exports Table */}
        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />

          {exports.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No exports found
            </Text>
          ) : (
            <>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Filename</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Format</Table.Th>
                    <Table.Th>Size</Table.Th>
                    <Table.Th>Created By</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Expires</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {exports.map((exportItem) => (
                    <Table.Tr key={exportItem.id}>
                      <Table.Td>
                        <Group gap="xs">
                          {getFormatIcon(exportItem.format)}
                          <Text size="sm">{exportItem.filename}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{getTypeLabel(exportItem.type)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={exportItem.format === 'pdf' ? 'red' : 'green'}
                          size="sm"
                        >
                          {exportItem.format.toUpperCase()}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatFileSize(exportItem.fileSize)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <div>
                          <Text size="sm">{exportItem.createdBy.name}</Text>
                          <Text size="xs" c="dimmed">
                            {exportItem.createdBy.email}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {new Date(exportItem.createdAt).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {isExpired(exportItem.expiresAt) ? (
                          <Badge color="red" size="sm">
                            Expired
                          </Badge>
                        ) : (
                          <Text size="sm">
                            {new Date(exportItem.expiresAt).toLocaleDateString()}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {!isExpired(exportItem.expiresAt) ? (
                          <ActionIcon
                            variant="light"
                            onClick={() => exportsApi.downloadExport(exportItem.id)}
                          >
                            <Download size={16} />
                          </ActionIcon>
                        ) : (
                          <Text size="xs" c="dimmed">
                            Unavailable
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {/* Pagination */}
              {total > 20 && (
                <Group justify="space-between" mt="md">
                  <Text size="sm" c="dimmed">
                    Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total}{' '}
                    exports
                  </Text>
                  <Group>
                    <Button
                      variant="light"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Text size="sm">
                      Page {page} of {Math.ceil(total / 20)}
                    </Text>
                    <Button
                      variant="light"
                      disabled={page >= Math.ceil(total / 20)}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </Group>
                </Group>
              )}
            </>
          )}
        </Card>

        <Alert icon={<AlertCircle size={16} />} color="blue">
          <Text size="sm">
            Exported files are automatically deleted after 7 days for security. Download them
            promptly.
          </Text>
        </Alert>
      </Stack>
    </Can>
  );
}
